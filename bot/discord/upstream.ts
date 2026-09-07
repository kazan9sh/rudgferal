import { upstreamConfig } from './config'

const API = 'https://api.github.com'

export type UpstreamCommit = {
  sha: string
  date: string
  message: string
  author: string
}

export type DirDiff = {
  missing: string[]
  extra: string[]
}

function headers(): Record<string, string> {
  const { githubToken } = upstreamConfig()
  const base: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'feral-rip-guide-bot',
  }
  if (githubToken) base.Authorization = `Bearer ${githubToken}`
  return base
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: headers() })

  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = res.headers.get('x-ratelimit-reset')
    const at = reset ? new Date(Number(reset) * 1000).toISOString() : 'неизвестно'
    throw new Error(`GitHub rate limit исчерпан, сбросится в ${at}. Задай GITHUB_TOKEN.`)
  }

  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} на ${path}`)
  }

  return (await res.json()) as T
}

/** Коммиты upstream, затронувшие путь, начиная с даты. */
export async function commitsSince(path: string, since: string): Promise<UpstreamCommit[]> {
  const { repo, branch } = upstreamConfig()
  const query = new URLSearchParams({ path, since, sha: branch, per_page: '50' })

  const raw = await api<any[]>(`/repos/${repo}/commits?${query}`)

  return raw.map((c) => ({
    sha: c.sha,
    date: c.commit.author.date,
    message: c.commit.message.split('\n')[0],
    author: c.commit.author.name,
  }))
}

/** Список .mdx файлов в каталоге upstream. */
export async function listDir(path: string): Promise<string[]> {
  const { repo, branch } = upstreamConfig()
  const raw = await api<any[]>(`/repos/${repo}/contents/${path}?ref=${branch}`)

  return raw.filter((e) => e.type === 'file' && e.name.endsWith('.mdx')).map((e) => e.name)
}

/** Сырое содержимое файла из upstream. */
export async function fetchFile(path: string): Promise<string> {
  const { repo, branch } = upstreamConfig()
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`

  const res = await fetch(url, { headers: { 'User-Agent': 'feral-rip-guide-bot' } })
  if (!res.ok) throw new Error(`Не удалось скачать ${path}: HTTP ${res.status}`)

  return res.text()
}

/** Чего не хватает у нас по сравнению с upstream и что есть только у нас. */
export function compareDir(ours: string[], theirs: string[]): DirDiff {
  const oursSet = new Set(ours)
  const theirsSet = new Set(theirs)

  return {
    missing: theirs.filter((f) => !oursSet.has(f)).sort(),
    extra: ours.filter((f) => !theirsSet.has(f)).sort(),
  }
}

export type TreeEntry = {
  path: string
  size: number
}

/**
 * Дерево файлов upstream под указанным префиксом.
 * Нужен, чтобы находить картинки, которых у нас ещё нет: в тексте гайда
 * ссылок на них нет — там всё через <Wowhead> и наши баннеры.
 */
export async function listTree(prefix: string): Promise<TreeEntry[]> {
  const { repo, branch } = upstreamConfig()

  const tree = await api<{ tree: any[]; truncated: boolean }>(
    `/repos/${repo}/git/trees/${branch}?recursive=1`
  )

  if (tree.truncated) {
    throw new Error('Дерево upstream пришло обрезанным — нужен обход по каталогам.')
  }

  return tree.tree
    .filter((e) => e.type === 'blob' && e.path.startsWith(prefix))
    .map((e) => ({ path: e.path, size: e.size ?? 0 }))
}
