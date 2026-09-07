/**
 * Кастомные эмодзи сервера вместо названий способностей — так оформлены
 * предыдущие гайды в Discord, и так их читают.
 *
 * Маппинг составлен по id, которые реально встречаются в компендиуме: у части
 * способностей в spellData.json лежит другой id (например Prowl — 102547 против
 * 5215 в гайде), поэтому автоматическому матчингу по имени здесь доверять нельзя.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const CACHE_PATH = path.join(process.cwd(), 'bot', 'discord', 'emoji-cache.json')

/** id заклинания → имя эмодзи на сервере. */
export const SPELL_EMOJI: Record<string, string> = {
  '1079': 'cat_rip',
  '1126': 'mark',
  '1822': 'rake',
  '5215': 'prowl',
  '5217': 'tiger_fury',
  '5221': 'shred',
  '16870': 'clearcast',
  '22568': 'ferocious_bite',
  '24858': 'balance_form',
  '102401': 'wild_charge',
  '102543': 'incarnation',
  '106785': 'swipe',
  '106830': 'thrash',
  '106951': 'berserk',
  '155580': 'moonfire',
  '158478': 'sotf',
  '202028': 'brutal_slash',
  '236068': 'moc',
  '274838': 'feral_frenzy',
  '285381': 'PW',
  '319439': 'bloodtalons',
  '319454': 'HOTW',
  '390772': 'pouncing_strikes',
  '391528': 'convoke',
  '391881': 'apex',
  '391969': 'circle',
  '439528': 'wildstalker',
  '441583': 'dotc',
  '441809': 'dreadful_wound',
  '1243807': 'frenzy',
  '1244258': 'chomp',
}

export type EmojiCache = Record<string, string>

/** Забирает эмодзи гильдии и кладёт в кэш, чтобы превью работало без сети. */
export async function refreshEmojiCache(guildId: string, token: string): Promise<EmojiCache> {
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/emojis`, {
    headers: { Authorization: `Bot ${token}` },
  })

  if (!res.ok) throw new Error(`Не удалось получить эмодзи: HTTP ${res.status}`)

  const list = (await res.json()) as { name: string; id: string }[]
  const cache: EmojiCache = {}
  for (const emoji of list) cache[emoji.name] = emoji.id

  await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`)
  return cache
}

export async function loadEmojiCache(): Promise<EmojiCache> {
  try {
    return JSON.parse(await readFile(CACHE_PATH, 'utf8')) as EmojiCache
  } catch {
    return {}
  }
}

/** <:tiger_fury:846370721478344755> — разметка Discord для кастомного эмодзи. */
export function emojiFor(spellId: string, cache: EmojiCache): string | null {
  const name = SPELL_EMOJI[spellId]
  if (!name) return null

  const id = cache[name]
  return id ? `<:${name}:${id}>` : null
}
