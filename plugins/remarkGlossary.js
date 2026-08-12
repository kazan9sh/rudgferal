import { visit } from 'unist-util-visit'

// Словарик ферала: соответствие сленга → официальное название способности/таланта.
// `suffixed: true` — слово склоняется по падежам (добавляем стандартные суффиксы).
// `suffixed: false` — точное совпадение (англоязычные сокращения).
// `slangName` — подпись в подсказке, если видимый алиас не должен быть левой частью подсказки.
const glossary = [
  { aliases: ['Шред'], suffixed: true, spellId: 5221, formalName: 'Полоснуть' },
  { aliases: ['Рейк'], suffixed: true, spellId: 1822, formalName: 'Глубокая рана' },
  { aliases: ['Свайп'], suffixed: true, spellId: 106785, formalName: 'Размах' },
  { aliases: ['Треш'], suffixed: true, spellId: 106830, formalName: 'Взбучка' },
  { aliases: ['Рип'], suffixed: true, spellId: 1079, formalName: 'Разорвать' },
  { aliases: ['ФБ', 'Байт', 'Кусь'], suffixed: false, spellId: 22568, formalName: 'Свирепый укус' },
  { aliases: ['ТФ', 'TF'], suffixed: false, spellId: 5217, formalName: 'Тигриное неистовство' },
  { aliases: ['ОоС', 'клиркаст'], suffixed: true, spellId: 16864, formalName: 'Знамение ясности' },
  { aliases: ['Берс'], suffixed: true, spellId: 106951, formalName: 'Берсерк' },
  { aliases: ['Стелс', 'стелс'], suffixed: true, spellId: 5215, formalName: 'Крадущийся зверь' },
  {
    aliases: ['Инкарна', 'Инкарнация'],
    suffixed: true,
    spellId: 102543,
    formalName: 'Воплощение: аватара Пеплошкурой',
  },
  {
    aliases: ['Бруталы', 'БРС'],
    suffixed: false,
    spellId: 202028,
    formalName: 'Жестокий удар когтями',
  },
  { aliases: ['ПВ', 'PW'], suffixed: false, spellId: 285381, formalName: 'Первобытный гнев' },
  { aliases: ['МоК', 'MoC'], suffixed: false, spellId: 236068, formalName: 'Момент ясности' },
  { aliases: ['БТ'], suffixed: false, spellId: 319439, formalName: 'Кровавые когти' },
  {
    aliases: ['ФФ', 'ферал френзи'],
    suffixed: false,
    spellId: 274838,
    formalName: 'Дикое бешенство',
  },
  { aliases: ['Апекс'], suffixed: true, spellId: 391881, formalName: 'Жажда сверххищника' },
  { aliases: ['Конвок'], suffixed: true, spellId: 391528, formalName: 'Созыв духов' },
  { aliases: ['Круг'], suffixed: true, spellId: 391969, formalName: 'Круг жизни и смерти' },
  { aliases: ['Иннер'], suffixed: true, spellId: 29166, formalName: 'Озарение' },
  { aliases: ['Лапа'], suffixed: true, spellId: 1126, formalName: 'Знак дикой природы' },
  {
    aliases: ['WS', 'ВС'],
    suffixed: false,
    spellId: 439528,
    formalName: 'Сталкер',
    slangName: 'WS / ВС',
  },
  {
    aliases: ['Сталкер'],
    suffixed: true,
    spellId: 439528,
    formalName: 'Сталкер',
    slangName: 'WS / ВС',
  },
  { aliases: ['ДОТС'], suffixed: false, spellId: 441583, formalName: 'Друид-хищник' },
  {
    aliases: ['Друид-хищник'],
    suffixed: true,
    spellId: 441583,
    formalName: 'Друид-хищник',
    slangName: 'ДОТС',
  },
]

// Допустимые падежные окончания для русских существительных.
// Не претендуем на полноту морфологии — берём самое частое.
const RU_SUFFIX = '(?:ами|ами|ах|ам|ой|ою|ев|ов|ы|и|у|ю|е|а|ом)?'

// Символ считается «частью слова» если это буква (RU/EN) или цифра.
const WORD_CHAR = '[А-Яа-яёЁA-Za-z0-9]'

// Собираем единый regex.
// Группа suffixed-терминов (Берс, Шред…) — допускаем русское окончание.
// Группа exact-терминов (TF, PW, BT…) — точное совпадение.
function buildRegex() {
  const suffixed = []
  const exact = []
  for (const entry of glossary) {
    for (const alias of entry.aliases) {
      if (entry.suffixed) suffixed.push(escapeRegex(alias))
      else exact.push(escapeRegex(alias))
    }
  }
  // Длинные алиасы вперёд — чтобы «Инкарнация» не съел «Инкарна».
  suffixed.sort((a, b) => b.length - a.length)
  exact.sort((a, b) => b.length - a.length)

  const parts = []
  if (suffixed.length) parts.push(`(?:${suffixed.join('|')})${RU_SUFFIX}`)
  if (exact.length) parts.push(`(?:${exact.join('|')})`)

  // Lookbehind / lookahead — чтобы не цеплять середину слова.
  return new RegExp(`(?<!${WORD_CHAR})(${parts.join('|')})(?!${WORD_CHAR})`, 'g')
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Для совпадения нужно определить, какому алиасу оно принадлежит — чтобы достать spellId/formalName.
function findEntry(match) {
  // match — это вся подстрока (например, «Берсом» или «TF»).
  // Сначала пробуем точное (exact-термины).
  for (const entry of glossary) {
    if (!entry.suffixed) {
      for (const alias of entry.aliases) {
        if (alias === match) return { entry, alias }
      }
    }
  }
  // Потом — суффиксированные: ищем самый длинный алиас-префикс.
  let best = null
  for (const entry of glossary) {
    if (!entry.suffixed) continue
    for (const alias of entry.aliases) {
      if (match.startsWith(alias)) {
        if (!best || alias.length > best.alias.length) best = { entry, alias }
      }
    }
  }
  return best
}

const TERM_REGEX = buildRegex()

export default function remarkGlossary() {
  return (tree) => {
    // Бежим по text-нодам.
    visit(tree, 'text', (node, index, parent) => {
      if (!parent) return

      // Пропускаем содержимое полностью «жирных» (`**...**`) узлов словарика,
      // чтобы не подсвечивать сами заголовочные термины в списке словаря.
      if (parent.type === 'strong' && parent.children?.length === 1) return

      // Пропускаем содержимое блоков кода и встроенного кода (visit к ним и так
      // обычно не дойдёт — но на всякий случай).
      if (parent.type === 'code' || parent.type === 'inlineCode') return

      const value = node.value
      // Сброс lastIndex т.к. regex с флагом g — глобальный stateful объект.
      TERM_REGEX.lastIndex = 0
      const matches = [...value.matchAll(TERM_REGEX)]
      if (!matches.length) return

      const newNodes = []
      let lastIndex = 0

      for (const match of matches) {
        const [full] = match
        const start = match.index
        const end = start + full.length

        if (lastIndex < start) {
          newNodes.push({ type: 'text', value: value.slice(lastIndex, start) })
        }

        const found = findEntry(full)
        if (!found) {
          // Не должно случиться, но fallback.
          newNodes.push({ type: 'text', value: full })
        } else {
          newNodes.push({
            type: 'mdxJsxTextElement',
            name: 'Term',
            attributes: [
              { type: 'mdxJsxAttribute', name: 'spellId', value: String(found.entry.spellId) },
              { type: 'mdxJsxAttribute', name: 'formal', value: found.entry.formalName },
              {
                type: 'mdxJsxAttribute',
                name: 'slang',
                value: found.entry.slangName || found.alias,
              },
            ],
            children: [{ type: 'text', value: full }],
          })
        }

        lastIndex = end
      }

      if (lastIndex < value.length) {
        newNodes.push({ type: 'text', value: value.slice(lastIndex) })
      }

      parent.children.splice(index, 1, ...newNodes)
      return [visit.SKIP, index + newNodes.length]
    })
  }
}
