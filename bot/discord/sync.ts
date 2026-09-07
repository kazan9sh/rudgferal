import { execFile } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { OURS_ONLY, SECTION_MAP, WATCHED_DIRS, WATCHED_PATHS } from './config'
import { downloadAll, extractImageRefs, ImageResult } from './images'
import { findSection, parseGuide, stripLinks, textBlocks } from './mdx'
import { commitsSince, compareDir, fetchFile, listDir, listTree, UpstreamCommit } from './upstream'

const exec = promisify(execFile)
const OUR_GUIDE = 'data/blog/feral/compendium.mdx'

export type SectionDrift = {
  upstreamTitle: string
  ourTitle: string | null
  /** Блоков текста в upstream против наших — грубая оценка объёма правки. */
  upstreamBlocks: number
  ourBlocks: number
  status: 'нет у нас' | 'не размечена' | 'разошлись' | 'совпадает'
}

export type GuideReport = {
  since: string
  commits: UpstreamCommit[]
  drift: SectionDrift[]
  missingDungeons: string[]
  missingRaids: string[]
}

/** Дата последнего коммита, тронувшего наш компендиум. От неё считаем отставание. */
export async function lastSyncDate(): Promise<string> {
  try {
    const { stdout } = await exec('git', ['log', '-1', '--format=%aI', '--', OUR_GUIDE], {
      cwd: process.cwd(),
    })
    const date = stdout.trim()
    if (date) return date
  } catch {
    // репозиторий недоступен — откатываемся на месяц назад
  }

  const fallback = new Date()
  fallback.setMonth(fallback.getMonth() - 1)
  return fallback.toISOString()
}

async function ourGuideSource(): Promise<string> {
  return readFile(path.join(process.cwd(), OUR_GUIDE), 'utf8')
}

async function ourMdxFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(path.join(process.cwd(), dir))
    return entries.filter((f) => f.endsWith('.mdx'))
  } catch {
    return []
  }
}

/**
 * Сверяет наш гайд с upstream по секциям.
 *
 * Текст на английском в русский файл не подставляется — это задача перевода,
 * не мержа. Отчёт показывает, какие наши разделы затронуты, чтобы правку делал
 * человек (или отдельный шаг перевода).
 */
export async function checkGuide(): Promise<GuideReport> {
  const since = await lastSyncDate()

  const [commits, theirSource, ourSource] = await Promise.all([
    commitsSince(WATCHED_PATHS['Компендиум (EN)'], since),
    fetchFile(WATCHED_PATHS['Компендиум (EN)']),
    ourGuideSource(),
  ])

  const theirs = parseGuide(theirSource)
  // Наш файл разбираем на уровень глубже: часть разделов upstream у нас лежит
  // подпунктами («Рейдовые билды», «Билды под ключи» — третий уровень).
  const ours = parseGuide(ourSource, 3)

  const drift: SectionDrift[] = theirs.sections.map((section) => {
    const cleanTitle = stripLinks(section.title)
    const mapped = SECTION_MAP[cleanTitle]
    const upstreamBlocks = textBlocks(section).length

    if (!mapped) {
      return {
        upstreamTitle: cleanTitle,
        ourTitle: null,
        upstreamBlocks,
        ourBlocks: 0,
        status: 'не размечена',
      }
    }

    const ourSection = findSection(ours, mapped)
    if (!ourSection) {
      return {
        upstreamTitle: cleanTitle,
        ourTitle: mapped,
        upstreamBlocks,
        ourBlocks: 0,
        status: 'нет у нас',
      }
    }

    const ourBlocks = textBlocks(ourSection).length

    return {
      upstreamTitle: cleanTitle,
      ourTitle: mapped,
      upstreamBlocks,
      ourBlocks,
      status: upstreamBlocks === ourBlocks ? 'совпадает' : 'разошлись',
    }
  })

  const [theirDungeons, ourDungeons, theirRaids, ourRaids] = await Promise.all([
    listDir(WATCHED_DIRS['Подземелья']),
    ourMdxFiles(WATCHED_DIRS['Подземелья']),
    listDir(WATCHED_DIRS['Рейды']),
    ourMdxFiles(WATCHED_DIRS['Рейды']),
  ])

  return {
    since,
    commits,
    drift,
    missingDungeons: compareDir(ourDungeons, theirDungeons).missing,
    missingRaids: compareDir(ourRaids, theirRaids).missing,
  }
}

const IMAGES_PREFIX = 'public/static/images'

/**
 * Тянет картинки, которых у нас нет.
 *
 * По тексту гайда искать бесполезно: в английском компендиуме markdown-картинок
 * нет вообще, всё визуальное идёт через <Wowhead> и наши собственные баннеры.
 * Поэтому сравниваем дерево public/static/images целиком и добираем недостающее.
 * Существующие файлы не трогаем — часть из них локализована под русский гайд.
 */
export async function syncImages(overwrite = false): Promise<ImageResult[]> {
  const [tree, guideSource] = await Promise.all([
    listTree(IMAGES_PREFIX),
    fetchFile(WATCHED_PATHS['Компендиум (EN)']),
  ])

  const fromTree = tree
    .map((entry) => entry.path.replace(/^public/, ''))
    .filter((ref) => /\.(png|jpe?g|gif|webp|svg)$/i.test(ref))

  // На случай, если в гайде когда-нибудь появятся прямые ссылки на картинки.
  const refs = [...new Set([...fromTree, ...extractImageRefs(guideSource)])]

  return downloadAll(refs, overwrite)
}

/** Наши разделы, которых нет в маппинге и которые бот сознательно не трогает. */
export function untouchedSections(): string[] {
  return [...OURS_ONLY]
}
