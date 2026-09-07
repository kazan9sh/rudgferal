/**
 * Секционный разбор компендиума.
 *
 * Гайд держится на кастомных MDX-компонентах (<Checkbox>, <Talents>, <Wowhead>,
 * <Timeline>, <RotationPresetPicker>) и баннерах разделов, поэтому файл целиком мы
 * не перезаписываем никогда. Работаем блоками внутри секций: JSX и картинки
 * переносятся как есть, сравнивается только текст.
 *
 * Наш русский гайд реструктурирован относительно английского: EN «Stat Priority»
 * у нас вынесен в отдельный раздел «Характеристики», «Gems and Enchants» — в
 * «Чары», а EN «Rotation» и «Talents» слиты в «Таланты и ротация». Поэтому
 * секции матчатся по заголовкам второго уровня через явный маппинг в config.ts,
 * а не по позиции.
 */

export type Section = {
  /** Заголовок без решёток, например «Чары». */
  title: string
  /** Строка с решётками, как в файле. */
  heading: string
  /** Уровень заголовка: 1 или 2. */
  depth: number
  /** Тело секции без строки заголовка. */
  body: string
  /** Номер строки заголовка в исходном файле, с единицы. */
  line: number
}

export type ParsedGuide = {
  frontmatter: string
  sections: Section[]
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/

/** Блок, который нельзя трогать при сравнении: JSX-компонент или картинка. */
export function isProtectedBlock(block: string): boolean {
  const trimmed = block.trimStart()
  return trimmed.startsWith('<') || trimmed.startsWith('![')
}

/**
 * Режет документ на секции по заголовкам уровня 1 и 2.
 * Тело секции уровня 1 включает вложенные в неё секции уровня 2.
 */
export function parseGuide(source: string, maxDepth = 2): ParsedGuide {
  const fm = source.match(FRONTMATTER)
  const frontmatter = fm ? fm[0] : ''
  const rest = fm ? source.slice(fm[0].length) : source

  const offset = frontmatter ? frontmatter.split('\n').length - 1 : 0
  const lines = rest.split('\n')

  const sections: Section[] = []
  const open: Section[] = []
  let inCodeFence = false

  const closeDeeperThan = (depth: number, endIndex: number) => {
    while (open.length && open[open.length - 1].depth >= depth) {
      const section = open.pop()!
      section.body = lines
        .slice(section.line - offset, endIndex)
        .join('\n')
        .replace(/\s+$/, '')
      sections.push(section)
    }
  }

  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) inCodeFence = !inCodeFence
    if (inCodeFence) return

    const match = line.match(/^(#{1,6})\s+(.*)$/)
    if (!match) return

    const depth = match[1].length
    if (depth > maxDepth) return

    closeDeeperThan(depth, index)

    open.push({
      title: match[2].trim(),
      heading: line,
      depth,
      body: '',
      line: offset + index + 1,
    })
  })

  closeDeeperThan(1, lines.length)

  return { frontmatter, sections: sections.sort((a, b) => a.line - b.line) }
}

/** Найти секцию по заголовку. Сравнение без учёта регистра и markdown-ссылок. */
export function findSection(guide: ParsedGuide, title: string): Section | undefined {
  const normalize = (s: string) => stripLinks(s).toLowerCase().trim()
  const wanted = normalize(title)

  return guide.sections.find((s) => normalize(s.title) === wanted)
}

/** «[Omnium Folio](https://...)» → «Omnium Folio» */
export function stripLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
}

/** Режем тело секции на блоки по пустым строкам, не разрывая кодовые заборы. */
export function splitBlocks(body: string): string[] {
  const blocks: string[] = []
  let buffer: string[] = []
  let inCodeFence = false

  for (const line of body.split('\n')) {
    if (/^\s*```/.test(line)) inCodeFence = !inCodeFence

    if (!inCodeFence && line.trim() === '') {
      if (buffer.length) {
        blocks.push(buffer.join('\n'))
        buffer = []
      }
      continue
    }

    buffer.push(line)
  }

  if (buffer.length) blocks.push(buffer.join('\n'))

  return blocks
}

/** Текстовые блоки секции — то, что вообще подлежит переводу и сверке. */
export function textBlocks(section: Section): string[] {
  return splitBlocks(section.body).filter((b) => !isProtectedBlock(b) && !/^#{1,6}\s/.test(b))
}
