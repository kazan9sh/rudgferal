import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { upstreamConfig } from './config'

const PUBLIC_DIR = path.join(process.cwd(), 'public')
const MAX_BYTES = 10 * 1024 * 1024

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(([^)\s]+)/g
const JSX_SRC = /\bsrc=["']([^"']+)["']/g

export type ImageResult = {
  ref: string
  status: 'downloaded' | 'unchanged' | 'exists' | 'skipped' | 'failed'
  reason?: string
  bytes?: number
}

/** Все ссылки на картинки из MDX: и markdown, и src= в JSX. */
export function extractImageRefs(source: string): string[] {
  const refs = new Set<string>()

  for (const match of source.matchAll(MARKDOWN_IMAGE)) refs.add(match[1])
  for (const match of source.matchAll(JSX_SRC)) refs.add(match[1])

  return [...refs].filter(isImageRef)
}

function isImageRef(ref: string): boolean {
  if (ref.startsWith('data:')) return false
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(ref.split('?')[0])
}

/** Локальный путь, куда ляжет картинка. Абсолютные URL кладём в static/images/external. */
function targetFor(ref: string): string {
  if (ref.startsWith('/')) return path.join(PUBLIC_DIR, ref)

  const name = path.basename(new URL(ref).pathname)
  return path.join(PUBLIC_DIR, 'static', 'images', 'external', name)
}

function sourceUrlFor(ref: string): string {
  if (!ref.startsWith('/')) return ref

  const { repo, branch } = upstreamConfig()
  return `https://raw.githubusercontent.com/${repo}/${branch}/public${ref}`
}

async function exists(file: string): Promise<boolean> {
  try {
    await readFile(file)
    return true
  } catch {
    return false
  }
}

async function sha256OfFile(file: string): Promise<string | null> {
  try {
    return createHash('sha256')
      .update(await readFile(file))
      .digest('hex')
  } catch {
    return null
  }
}

/**
 * Скачивает картинку, если её нет или содержимое отличается.
 * Побайтово совпавшие файлы не перезаписываем, чтобы не мусорить в git.
 */
export async function downloadImage(ref: string, overwrite = false): Promise<ImageResult> {
  const target = targetFor(ref)

  // Часть картинок у нас локализована (баннеры разделов рисовались под русский
  // гайд, в upstream их нет вовсе). Молча затирать их английскими нельзя.
  if (!overwrite && (await exists(target))) {
    return { ref, status: 'exists' }
  }

  let res: Response
  try {
    res = await fetch(sourceUrlFor(ref), { headers: { 'User-Agent': 'feral-rip-guide-bot' } })
  } catch (error) {
    return { ref, status: 'failed', reason: (error as Error).message }
  }

  if (!res.ok) {
    return { ref, status: 'failed', reason: `HTTP ${res.status}` }
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) {
    return { ref, status: 'skipped', reason: `не картинка (${contentType || 'без типа'})` }
  }

  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) {
    return { ref, status: 'skipped', reason: `${(bytes.byteLength / 1024 / 1024).toFixed(1)} МБ` }
  }

  const incoming = createHash('sha256').update(bytes).digest('hex')
  if ((await sha256OfFile(target)) === incoming) {
    return { ref, status: 'unchanged', bytes: bytes.byteLength }
  }

  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, bytes)

  return { ref, status: 'downloaded', bytes: bytes.byteLength }
}

/** Качаем последовательно — upstream не любит параллельные пачки. */
export async function downloadAll(refs: string[], overwrite = false): Promise<ImageResult[]> {
  const results: ImageResult[] = []
  for (const ref of refs) results.push(await downloadImage(ref, overwrite))
  return results
}
