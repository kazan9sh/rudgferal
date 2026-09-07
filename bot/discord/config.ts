export type DiscordConfig = {
  token: string
  clientId: string
  guildId?: string
  channelId?: string
  adminRoleId?: string
}

export type UpstreamConfig = {
  repo: string
  branch: string
  githubToken?: string
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value.trim()
}

export function validateDiscordConfig(): DiscordConfig {
  return {
    token: required('DISCORD_BOT_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    guildId: process.env.DISCORD_GUILD_ID?.trim(),
    channelId: process.env.DISCORD_CHANNEL_ID?.trim(),
    adminRoleId: process.env.DISCORD_ADMIN_ROLE_ID?.trim(),
  }
}

export function upstreamConfig(): UpstreamConfig {
  return {
    repo: process.env.GUIDE_UPSTREAM_REPO?.trim() || 'dreamgrove/dreamgrove',
    branch: process.env.GUIDE_UPSTREAM_BRANCH?.trim() || 'master',
    githubToken: process.env.GITHUB_TOKEN?.trim(),
  }
}

// Пути, за которыми следим. Ключ — что показываем в Discord.
export const WATCHED_PATHS = {
  'Компендиум (EN)': 'data/blog/feral/compendium.mdx',
  'Компендиум (KR)': 'data/blog/feral/kr/compendium.mdx',
} as const

export const WATCHED_DIRS = {
  Подземелья: 'data/dungeons',
  Рейды: 'data/raids',
} as const

/**
 * Соответствие секций английского компендиума нашим.
 *
 * Один в один не ложится: наш гайд реструктурирован. EN «Rotation» и «Talents»
 * слиты у нас в «Таланты и ротация», а «Stat Priority» и «Gems and Enchants»
 * вынесены из EN «Gearing» в самостоятельные разделы. Ключ — заголовок в
 * upstream, значение — наш заголовок.
 */
export const SECTION_MAP: Record<string, string> = {
  News: 'Новости',
  Rotation: 'Таланты и ротация',
  Talents: 'Таланты и ротация',
  'Single Target': 'Билды и ротация',
  'Multi Target': 'Билды и ротация',
  'Raid Talents': 'Рейдовые билды',
  'Dungeon Talents': 'Билды под ключи',
  Gearing: 'Крафт, тринкеты, гиринг',
  'Stat Priority': 'Характеристики',
  'Gems and Enchants': 'Чары',
  Crafting: 'Крафт',
  Trinkets: 'Тринкеты',
  Consumables: 'Химия',
  Miscellaneous: 'Дополнительно',
  'What is snapshotting?': 'Что такое снапшот?',
  'What is “pandemic range?”': 'Что такое пандемия?',
  Macros: 'Макросы',
  'Feral Druid Abbreviations': 'Словарик ферала',
  'Talent Tree changes': 'Перестановки в дереве талантов',
  '12.1 Tier Set Bonus': 'Сет-бонусы 12.1',
  'Nebulous Voidcores': 'Туманные сердечники Бездны',
  'Omnium Folio': 'Фолиант омниума',
}

/** Наши разделы, у которых нет источника в upstream — их бот не трогает. */
export const OURS_ONLY = ['Полезные ссылки', 'Радиус способностей', 'WeakAuras и аддоны']
