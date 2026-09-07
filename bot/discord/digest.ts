/**
 * Превращает компендиум в набор сообщений для Discord.
 *
 * Discord понимает не тот markdown, что наш сайт: таблиц нет вовсе, JSX-компонентов
 * тоже, а на каждое сообщение отведено 2000 символов. Поэтому таблицы разворачиваются
 * в списки, компоненты — в текст, а документ режется по заголовкам.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseGuide, type Section } from './mdx'

export const MESSAGE_LIMIT = 2000
const GUIDE_PATH = 'data/blog/feral/compendium.mdx'
const SITE = 'https://feral.rip'

/** !102401|Дикий рывок! → ссылка на Wowhead без превью. */
function spells(text: string): string {
  return text
    .replace(
      /!(\d+)\|([^!]+)!/g,
      (_, id, name) => `[${name}](<https://www.wowhead.com/ru/spell=${id}>)`
    )
    .replace(/!([A-Za-zА-Яа-я' ]+)!/g, '**$1**')
}

/** Ссылки на сайте оборачиваем в <>, иначе Discord навалит превью на каждую. */
function links(text: string): string {
  return text.replace(/\]\((https?:\/\/[^)<][^)]*)\)/g, '](<$1>)')
}

/** Таблица markdown → список. Discord таблицы не рисует вообще. */
function tables(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const isRow = (s: string) => /^\s*\|.*\|\s*$/.test(s)
    const isDivider = (s: string) => /^\s*\|[\s:|-]+\|\s*$/.test(s)

    if (isRow(lines[i]) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const cells = (s: string) =>
        s
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim())

      i += 2
      while (i < lines.length && isRow(lines[i])) {
        const row = cells(lines[i]).filter(Boolean)
        if (row.length) {
          const [head, ...rest] = row
          out.push(rest.length ? `- ${head} — ${rest.join(' ')}` : `- ${head}`)
        }
        i++
      }
      continue
    }

    out.push(lines[i])
    i++
  }

  return out.join('\n')
}

/** <Talents name={"..."} talents={"..."} comment={"..."} /> → заголовок, код, примечание. */
function talents(text: string): string {
  return text.replace(/<Talents\s([^>]*?)\/>/g, (_, attrs: string) => {
    const grab = (key: string) => {
      const m = attrs.match(new RegExp(`${key}=\\{"((?:[^"\\\\]|\\\\[^])*)"\\}`))
      return m ? m[1].replace(/\\"/g, '"') : ''
    }

    const name = grab('name')
    const code = grab('talents')
    const comment = grab('comment')

    const parts = [name ? `**${name}**` : '', code ? `\`\`\`\n${code}\n\`\`\`` : '']
    if (comment) parts.push(`-# ${comment}`)

    return parts.filter(Boolean).join('\n')
  })
}

/** Всё остальное, что Discord не покажет. */
function strip(text: string): string {
  return (
    text
      // Парный <Talents> — это визуализация дерева талантов с раскраской узлов.
      // В Discord её воспроизвести нечем, поэтому отправляем на сайт.
      .replace(
        /<Talents[^>]*>[\s\S]*?<\/Talents>/g,
        `-# Дерево талантов с раскраской — на сайте: <${SITE}/blog/feral/compendium>`
      )
      .replace(/<RotationPresetPicker[^>]*\/>/g, '')
      .replace(/<Timeline[^>]*>[\s\S]*?<\/Timeline>/g, '')
      .replace(/<Checkbox[^>]*>([\s\S]*?)<\/Checkbox>/g, '$1')
      .replace(/<Wowhead[^>]*\/>/g, '')
      .replace(/<summary[^>]*>([\s\S]*?)<\/summary>/g, '**$1**')
      .replace(/<\/?details[^>]*>|<\/?div[^>]*>/g, '')
      .replace(/<span[^>]*>([\s\S]*?)<\/span>/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[\*[^\]]+\]\s*/g, '')
      .replace(/>\s*\[!TIP\]/g, '> 💡')
      .replace(/>\s*\[!WARNING\]/g, '> ⚠️')
      .replace(/>\s*\[!NOTE\]/g, '> ℹ️')
      // Остатки JSX и html. Ссылки вида <https://...> не трогаем — это разметка Discord.
      .replace(/<(?!https?:\/\/)[^>]*>/g, '')
      .replace(/^\s*[-*]\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
  )
}

export function toDiscord(markdown: string): string {
  return strip(talents(tables(links(spells(markdown))))).trim()
}

/** Режет текст на сообщения, не разрывая абзацы и кодовые блоки. */
export function chunk(text: string, limit = MESSAGE_LIMIT): string[] {
  const messages: string[] = []
  let current = ''

  const push = () => {
    if (current.trim()) messages.push(current.trim())
    current = ''
  }

  for (const block of text.split('\n\n')) {
    const piece = block.trim()
    if (!piece) continue

    if (piece.length > limit) {
      push()
      // Абзац сам по себе длиннее лимита — режем по строкам.
      let buffer = ''
      for (const line of piece.split('\n')) {
        if (buffer.length + line.length + 1 > limit) {
          if (buffer.trim()) messages.push(buffer.trim())
          buffer = ''
        }
        buffer += `${line}\n`
      }
      if (buffer.trim()) messages.push(buffer.trim())
      continue
    }

    if (current.length + piece.length + 2 > limit) push()
    current += `${piece}\n\n`
  }

  push()
  return messages
}

export type DigestSection = {
  title: string
  messages: string[]
}

/**
 * Собирает дайджест по разделам верхнего уровня.
 * Каждый раздел — отдельная пачка сообщений, чтобы их можно было постить
 * по одному посту на тему и потом редактировать точечно.
 */
export async function buildDigest(sectionFilter?: string[]): Promise<DigestSection[]> {
  const source = await readFile(path.join(process.cwd(), GUIDE_PATH), 'utf8')
  const guide = parseGuide(source, 1)

  const wanted = (s: Section) =>
    !sectionFilter?.length ||
    sectionFilter.some((f) => s.title.toLowerCase().includes(f.toLowerCase()))

  return guide.sections.filter(wanted).map((section) => {
    const body = toDiscord(section.body)
    const header = `## ${section.title}`

    return {
      title: section.title,
      messages: chunk(`${header}\n\n${body}`),
    }
  })
}

export function digestHeader(): string {
  return [
    '# СИЛА ЗВЕРЯ — гайд по фералу, патч 12.1',
    '',
    `Автосборка из компендиума на <${SITE}>. Полная версия со всеми таблицами,`,
    'калькулятором талантов и таймлайнами опенера — на сайте.',
    `-# Обновлено: ${new Date().toLocaleDateString('ru-RU')}`,
  ].join('\n')
}
