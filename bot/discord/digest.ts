/**
 * Превращает компендиум в набор сообщений для Discord.
 *
 * Discord понимает не тот markdown, что наш сайт: таблиц нет вовсе, JSX-компонентов
 * тоже, а на каждое сообщение отведено 2000 символов. Поэтому таблицы разворачиваются
 * в списки, компоненты — в текст, а документ режется по заголовкам.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { emojiFor, loadEmojiCache, type EmojiCache } from './emoji'
import { parseGuide, type Section } from './mdx'

export const MESSAGE_LIMIT = 2000
const GUIDE_PATH = 'data/blog/feral/compendium.mdx'
const SITE = 'https://feral.rip'

/**
 * !5217|Тигриное неистовство! → эмодзи сервера плюс название ссылкой.
 * Эмодзи — как в прошлых гайдах; название оставляем, чтобы текст читался,
 * даже если эмодзи не отрисуется.
 */
function spells(text: string, cache: EmojiCache): string {
  return text
    .replace(/!(\d+)\|([^!]+)!/g, (_, id: string, name: string) => {
      const link = `[${name}](<https://www.wowhead.com/ru/spell=${id}>)`
      const icon = emojiFor(id, cache)
      return icon ? `${icon} ${link}` : link
    })
    .replace(/!([A-Za-zА-Яа-я' ]+)!/g, '**$1**')
}

/** <Wowhead id="5217" name="..." type="spell" /> — то же оформление, что и у !id|name!. */
function wowhead(text: string, cache: EmojiCache): string {
  return text.replace(/<Wowhead\s([^>]*?)\/>/g, (_, attrs: string) => {
    const get = (key: string) => attrs.match(new RegExp(`${key}="([^"]*)"`))?.[1] ?? ''

    const id = get('id')
    const name = get('name')
    if (!id || !name) return name

    const kind = get('type') === 'item' ? 'item' : 'spell'
    const link = `[${name}](<https://www.wowhead.com/ru/${kind}=${id}>)`
    const icon = kind === 'spell' ? emojiFor(id, cache) : null

    return icon ? `${icon} ${link}` : link
  })
}

/**
 * HTML-таблица → список. Первая ячейка строки становится подписью, остальные
 * значениями через точку: в Discord это единственный способ не потерять смысл
 * таблицы, потому что таблиц он не рисует.
 */
function htmlTables(text: string): string {
  return text.replace(/<table[^>]*>([\s\S]*?)<\/table>/g, (_, body: string) => {
    const rowsOf = (html: string) =>
      [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
        [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) =>
          cell[1].replace(/\s+/g, ' ').trim()
        )
      )

    const rows = rowsOf(body).filter((cells) => cells.length)
    if (!rows.length) return ''

    const [head, ...rest] = rows
    const lines: string[] = []

    if (head.length > 1) {
      lines.push(`**${head[0]}** — колонки: ${head.slice(1).join(' · ')}`)
      lines.push('')
    }

    for (const cells of rest) {
      const [label, ...values] = cells
      lines.push(values.length ? `- **${label}** — ${values.join(' · ')}` : `- ${label}`)
    }

    return lines.join('\n')
  })
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
      // <details> с чекбоксами — это фильтр APL на сайте. В Discord фильтровать
      // нечем, а подписи блоков остались бы висеть без содержимого.
      .replace(/<details[^>]*>(?:(?!<\/details>)[\s\S])*?<Checkbox[\s\S]*?<\/details>/g, '')
      // Призыв «заходите в чат» в теле абзаца: ссылка на чат и так есть
      // в «Полезных ссылках» в конце канала, второй раз ни к чему.
      .replace(/^(?![-*|])(.*)$/gm, (line) =>
        line.includes('discord.gg')
          ? line
              .split(/(?<=\.)\s+/)
              .filter((sentence) => !sentence.includes('discord.gg'))
              .join(' ')
              .trim()
          : line
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
      // Алерты сайта сливаем с текстом, иначе значок висит отдельной строкой.
      .replace(/>\s*\[!TIP\]\s*\n>\s*/g, '> 💡 **Совет:** ')
      .replace(/>\s*\[!WARNING\]\s*\n>\s*/g, '> ⚠️ **Важно:** ')
      .replace(/>\s*\[!NOTE\]\s*\n>\s*/g, '> ℹ️ ')
      .replace(/>\s*\[!(TIP|WARNING|NOTE)\]/g, '>')
      // Остатки JSX и html. Ссылки <https://...> и эмодзи <:name:id> не трогаем.
      .replace(/<(?!https?:\/\/|a?:)[^>]*>/g, '')
      .replace(/^\s*[-*]\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
  )
}

/**
 * Заголовок раздела мы ставим на второй уровень, поэтому всё, что внутри,
 * опускаем на ступень: иначе подраздел выглядит ровней своему разделу.
 * Глубже третьего уровня Discord не рисует, там останавливаемся.
 */
function demote(text: string): string {
  return text.replace(/^##(?!#)\s+/gm, '### ')
}

/** Наивная основа слова — чтобы «Приоритет» и «Приоритеты» считались одним. */
function stem(word: string): string {
  return word.toLowerCase().slice(0, 5)
}

/**
 * Убирает подпись свёрнутого блока, если она повторяет заголовок над ней:
 * на сайте это подпись раскрывающегося блока, в Discord — лишняя строка.
 */
function dropEchoedLabels(text: string): string {
  const lines = text.split('\n')
  let lastHeading: string[] = []

  return lines
    .filter((line) => {
      const heading = line.match(/^#{1,3}\s+(.*)$/)
      if (heading) {
        lastHeading = heading[1].split(/\s+/).map(stem)
        return true
      }

      const label = line.match(/^\*\*([^*]+)\*\*$/)
      if (label && lastHeading.length) {
        const words = label[1].split(/\s+/).map(stem)
        if (words.every((w) => lastHeading.includes(w))) return false
      }

      if (line.trim()) lastHeading = lastHeading.length && !label ? [] : lastHeading
      return true
    })
    .join('\n')
}

/** 🔸 в подзаголовках — так размечены прошлые гайды в Discord. */
function headings(text: string): string {
  return text.replace(/^(#{2,3})\s+(?!🔸)(.+)$/gm, '$1 🔸 $2')
}

export function toDiscord(markdown: string, cache: EmojiCache = {}): string {
  const withSpells = wowhead(spells(markdown, cache), cache)
  return headings(
    dropEchoedLabels(demote(strip(talents(tables(htmlTables(links(withSpells)))))))
  ).trim()
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

/**
 * Сообщение дайджеста: либо текст, либо картинка-баннер раздела.
 * В прошлых гайдах баннер шёл отдельным сообщением перед текстом — повторяем.
 */
export type DigestMessage =
  | { kind: 'text'; content: string }
  | { kind: 'image'; path: string; alt: string }

export type DigestSection = {
  title: string
  messages: DigestMessage[]
}

const IMAGE_IN_MDX = /!\[([^\]]*)\]\((\/[^)\s]+\.(?:png|jpe?g|gif|webp))\)/g

/** Режет тело раздела на куски текста и картинки, сохраняя их порядок. */
function splitByImages(body: string): { text?: string; image?: { path: string; alt: string } }[] {
  const parts: { text?: string; image?: { path: string; alt: string } }[] = []
  let last = 0

  for (const match of body.matchAll(IMAGE_IN_MDX)) {
    const before = body.slice(last, match.index)
    if (before.trim()) parts.push({ text: before })

    parts.push({ image: { alt: match[1], path: match[2] } })
    last = (match.index ?? 0) + match[0].length
  }

  const tail = body.slice(last)
  if (tail.trim()) parts.push({ text: tail })

  return parts
}

/**
 * Собирает дайджест по разделам верхнего уровня.
 * Каждый раздел — отдельная пачка сообщений, чтобы их можно было постить
 * по одному посту на тему и потом редактировать точечно.
 */
export async function buildDigest(sectionFilter?: string[]): Promise<DigestSection[]> {
  const [source, cache] = await Promise.all([
    readFile(path.join(process.cwd(), GUIDE_PATH), 'utf8'),
    loadEmojiCache(),
  ])
  const guide = parseGuide(source, 1)
  const labels = checkboxLabels(source)

  const wanted = (s: Section) =>
    !sectionFilter?.length ||
    sectionFilter.some((f) => s.title.toLowerCase().includes(f.toLowerCase()))

  return guide.sections.filter(wanted).map((section, sectionIndex) => {
    const messages: DigestMessage[] = []
    let headerUsed = false

    for (const part of splitByImages(section.body)) {
      if (part.image) {
        messages.push({ kind: 'image', path: part.image.path, alt: part.image.alt })
        continue
      }

      const body = toDiscord(splitApl(part.text ?? '', labels), cache)
      if (!body) continue

      // Заголовок раздела ставим к первому текстовому куску, после баннера.
      // Напоминание про сайт ставим в самый первый раздел, сразу под заголовком.
      const callout = sectionIndex === 0 && !headerUsed ? `${siteCallout()}\n\n` : ''
      const withHeader = headerUsed ? body : `## 🔸 ${section.title}\n\n${callout}${body}`
      headerUsed = true

      for (const content of chunk(withHeader)) messages.push({ kind: 'text', content })
    }

    return { title: section.title, messages }
  })
}

export function digestHeader(): string {
  return [
    '# СИЛА ЗВЕРЯ — гайд по фералу, патч 12.1',
    '',
    `## 📖 [Гайд на сайте](<${SITE}>) — рекомендуется к изучению`,
    '',
    `Полная версия: <${SITE}/blog/feral/compendium>`,
    '',
    'Здесь автосборка гайда. На сайте к ней прилагается калькулятор талантов,',
    'таймлайны опенера и фильтры APL под конкретный билд — в Discord их нет.',
    `-# Обновлено: ${new Date().toLocaleDateString('ru-RU')}`,
  ].join('\n')
}

/** Строка-напоминание про сайт, которую вставляем в начало первого раздела. */
export function siteCallout(): string {
  return `> 📖 **Гайд на сайте:** <${SITE}> — там фильтры APL, калькулятор талантов и таймлайны.`
}

/** Подписи фильтров APL, взятые из <Checkbox> на сайте: id → человеческое имя. */
export function checkboxLabels(source: string): Record<string, string> {
  const labels: Record<string, string> = {}

  for (const match of source.matchAll(/<Checkbox\b([^>]*)>/g)) {
    const attrs = match[1]
    const id = attrs.match(/\bid="([^"]*)"/)?.[1]
    const name = attrs.match(/\bname="([^"]*)"/)?.[1]
    if (id && name) labels[id] = name
  }

  return labels
}

type AplItem = { text: string; conditions: string[] }

function describeConditions(raw: string[], labels: Record<string, string>): string {
  // Знаками, а не предлогами: русские названия талантов в родительном и
  // творительном падеже склонять неоткуда, вышло бы «с Жажда сверххищника».
  const parts = raw.map((token) => {
    const negated = token.startsWith('~')
    const key = negated ? token.slice(1) : token
    const label = labels[key] ?? key.replace(/ AOE$/, '')
    return `${negated ? '−' : '+'} ${label}`
  })

  return parts.length ? ` *(${parts.join(', ')})*` : ''
}

/**
 * APL на сайте — один список, который фильтруется чекбоксами «одна цель / АоЕ».
 * В Discord фильтров нет, и без разделения соседние строки выглядят дублями,
 * поэтому режем список на два и подписываем условия билда явно.
 */
export function splitApl(body: string, labels: Record<string, string>): string {
  const lines = body.split('\n')
  const single: AplItem[] = []
  const aoe: AplItem[] = []

  let start = -1
  let end = -1

  lines.forEach((line, index) => {
    const match = line.match(/^\s*\d+\.\s*\[\*([^\]]+)\]\s*(.*)$/)
    if (!match) return

    if (start === -1) start = index
    end = index

    const tokens = match[1].split('&&').map((t) => t.trim())
    const rotation = tokens.shift() ?? ''
    const item: AplItem = { text: match[2].trim(), conditions: tokens }

    if (rotation.startsWith('AOE')) aoe.push(item)
    else single.push(item)
  })

  if (start === -1) return body

  const render = (title: string, items: AplItem[]) =>
    items.length
      ? [
          `**${title}**`,
          '',
          ...items.map(
            (item, i) => `${i + 1}. ${item.text}${describeConditions(item.conditions, labels)}`
          ),
          '',
        ]
      : []

  const replacement = [...render('Одна цель', single), ...render('AoE / M+', aoe)]

  return [...lines.slice(0, start), ...replacement, ...lines.slice(end + 1)].join('\n')
}
