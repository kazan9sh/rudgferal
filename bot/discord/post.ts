/**
 * Постинг и синхронизация дайджеста в канале.
 *
 * Баннеры разделов уходят вложениями — так они выглядят в прошлых гайдах.
 * Discord ограничивает частоту сообщений, поэтому шлём последовательно с паузой
 * и уважаем retry_after.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { validateDiscordConfig } from './config'
import { buildDigest, digestHeader, MESSAGE_LIMIT, type DigestMessage } from './digest'

const API = 'https://discord.com/api/v10'
const PAUSE_MS = 1200
const PUBLIC_DIR = path.join(process.cwd(), 'public')

export type QueueItem = { section: string; message: DigestMessage }

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Общий вызов с обработкой rate limit. */
async function call(url: string, init: RequestInit): Promise<Response> {
  const { token } = validateDiscordConfig()

  for (let attempt = 0; attempt < 3; attempt++) {
    const headers = { ...(init.headers as Record<string, string>), Authorization: `Bot ${token}` }
    const res = await fetch(url, { ...init, headers })

    if (res.status === 429) {
      const body = (await res.json()) as { retry_after?: number }
      await sleep((body.retry_after ?? 1) * 1000 + 250)
      continue
    }

    if (!res.ok && res.status !== 404) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }

    return res
  }

  throw new Error('не удалось выполнить запрос после трёх попыток из-за rate limit')
}

async function sendText(channelId: string, content: string): Promise<void> {
  await call(`${API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  })
}

export function imageFileName(imagePath: string): string {
  return path.basename(imagePath)
}

async function sendImage(channelId: string, imagePath: string): Promise<void> {
  const file = path.join(PUBLIC_DIR, imagePath)
  const bytes = await readFile(file)
  const name = imageFileName(imagePath)

  const form = new FormData()
  form.append('payload_json', JSON.stringify({ attachments: [{ id: 0, filename: name }] }))
  form.append('files[0]', new Blob([new Uint8Array(bytes)]), name)

  await call(`${API}/channels/${channelId}/messages`, { method: 'POST', body: form })
}

async function send(channelId: string, message: DigestMessage): Promise<void> {
  if (message.kind === 'image') return sendImage(channelId, message.path)
  return sendText(channelId, message.content)
}

/** Полная очередь сообщений: шапка, затем разделы по порядку. */
export async function buildQueue(sectionFilter?: string[]): Promise<QueueItem[]> {
  const sections = await buildDigest(sectionFilter)

  const queue: QueueItem[] = [
    { section: 'Шапка', message: { kind: 'text', content: digestHeader() } },
    ...sections.flatMap((s) => s.messages.map((message) => ({ section: s.title, message }))),
  ]

  const tooLong = queue.filter(
    (item) => item.message.kind === 'text' && item.message.content.length > MESSAGE_LIMIT
  )
  if (tooLong.length) {
    throw new Error(
      `${tooLong.length} сообщений длиннее ${MESSAGE_LIMIT} символов — постинг отменён`
    )
  }

  return queue
}

/** Первичная заливка. Ничего не удаляет и не редактирует. */
export async function postDigest(channelId: string, sectionFilter?: string[]): Promise<number> {
  const queue = await buildQueue(sectionFilter)

  for (const [index, item] of queue.entries()) {
    await send(channelId, item.message)
    const what = item.message.kind === 'image' ? 'картинка' : 'текст'
    console.log(`  [${index + 1}/${queue.length}] ${item.section} — ${what}`)
    await sleep(PAUSE_MS)
  }

  return queue.length
}

type ExistingMessage = { id: string; content: string; attachment: string | null }

/** Свои сообщения канала в хронологическом порядке. */
async function ownMessages(channelId: string): Promise<ExistingMessage[]> {
  const { clientId } = validateDiscordConfig()
  const collected: ExistingMessage[] = []
  let before: string | undefined

  for (;;) {
    const query = new URLSearchParams({ limit: '100' })
    if (before) query.set('before', before)

    const res = await call(`${API}/channels/${channelId}/messages?${query}`, { method: 'GET' })
    const batch = (await res.json()) as {
      id: string
      content: string
      author: { id: string }
      attachments: { filename: string }[]
    }[]

    if (!batch.length) break

    for (const message of batch) {
      if (message.author.id === clientId) {
        collected.push({
          id: message.id,
          content: message.content,
          attachment: message.attachments[0]?.filename ?? null,
        })
      }
    }

    before = batch[batch.length - 1].id
    if (batch.length < 100) break
  }

  return collected.reverse()
}

/** Совпадает ли уже отправленное сообщение с желаемым. */
function matches(existing: ExistingMessage, wanted: DigestMessage): boolean {
  if (wanted.kind === 'image') return existing.attachment === imageFileName(wanted.path)
  return existing.attachment === null && existing.content === wanted.content
}

/**
 * Полная перезаливка: сносим свои сообщения и пишем заново.
 *
 * Нужна, когда меняется структура (например, между текстами появились баннеры):
 * порядок сообщений в Discord задаётся временем отправки, вставить сообщение
 * в середину нельзя — только переписать всё.
 */
export async function resetChannel(channelId: string, sectionFilter?: string[]): Promise<number> {
  const existing = await ownMessages(channelId)

  // bulk-delete умеет до 100 сообщений и только моложе двух недель.
  const ids = existing.map((m) => m.id)
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)

    if (batch.length > 1) {
      await call(`${API}/channels/${channelId}/messages/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: batch }),
      })
    } else if (batch.length === 1) {
      await call(`${API}/channels/${channelId}/messages/${batch[0]}`, { method: 'DELETE' })
    }

    await sleep(PAUSE_MS)
  }

  console.log(`  удалено старых сообщений: ${ids.length}`)
  return postDigest(channelId, sectionFilter)
}

/** Совпадает ли последовательность типов сообщений с тем, что уже в канале. */
export function structureMatches(
  existing: { attachment: string | null }[],
  queue: QueueItem[]
): boolean {
  if (existing.length !== queue.length) return false

  return queue.every((item, index) => {
    const isImage = item.message.kind === 'image'
    return isImage === (existing[index].attachment !== null)
  })
}

export type SyncSummary = {
  edited: number
  added: number
  removed: number
  unchanged: number
}

/**
 * Приводит канал к текущему состоянию гайда: правит текст на месте, дописывает
 * недостающее, убирает лишнее. Вложение отредактировать нельзя, поэтому
 * несовпавшую картинку пересоздаём.
 */
export async function syncDigest(
  channelId: string,
  sectionFilter?: string[]
): Promise<SyncSummary> {
  const queue = await buildQueue(sectionFilter)
  const existing = await ownMessages(channelId)

  if (existing.length && !structureMatches(existing, queue)) {
    throw new Error(
      'структура канала разошлась с гайдом (сместились картинки или число сообщений) — ' +
        'нужна перезаливка: pnpm bot:reset <channelId>'
    )
  }

  const summary: SyncSummary = { edited: 0, added: 0, removed: 0, unchanged: 0 }

  for (const [index, item] of queue.entries()) {
    const current = existing[index]

    if (current && matches(current, item.message)) {
      summary.unchanged++
      continue
    }

    if (!current) {
      await send(channelId, item.message)
      summary.added++
      console.log(`  [${index + 1}] добавлено`)
    } else if (item.message.kind === 'text' && current.attachment === null) {
      await call(`${API}/channels/${channelId}/messages/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: item.message.content, allowed_mentions: { parse: [] } }),
      })
      summary.edited++
      console.log(`  [${index + 1}] обновлено`)
    } else {
      // Тип сообщения поменялся — старое убираем, шлём заново.
      await call(`${API}/channels/${channelId}/messages/${current.id}`, { method: 'DELETE' })
      await sleep(PAUSE_MS)
      await send(channelId, item.message)
      summary.edited++
      console.log(`  [${index + 1}] пересоздано`)
    }

    await sleep(PAUSE_MS)
  }

  for (const stale of existing.slice(queue.length)) {
    await call(`${API}/channels/${channelId}/messages/${stale.id}`, { method: 'DELETE' })
    summary.removed++
    console.log('  лишнее сообщение удалено')
    await sleep(PAUSE_MS)
  }

  return summary
}
