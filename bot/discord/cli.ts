/**
 * Запуск логики бота без Discord — удобно проверять на месте:
 *   pnpm bot:check    — что разошлось с upstream
 *   pnpm bot:images   — скачать картинки
 */
import { buildDigest, digestHeader, MESSAGE_LIMIT } from './digest'
import { refreshEmojiCache } from './emoji'
import { postDigest } from './post'
import { checkGuide, syncImages } from './sync'

async function check(): Promise<void> {
  const report = await checkGuide()

  console.log(`Наш компендиум правился ${report.since.slice(0, 10)}`)
  console.log(`Коммитов upstream с тех пор: ${report.commits.length}`)
  for (const c of report.commits) console.log(`  ${c.date.slice(0, 10)}  ${c.message}`)

  console.log('\nСекции:')
  for (const d of report.drift) {
    const target = d.ourTitle ? `→ «${d.ourTitle}»` : '→ (нет маппинга)'
    console.log(
      `  [${d.status}] ${d.upstreamTitle} ${target} блоков ${d.upstreamBlocks}/${d.ourBlocks}`
    )
  }

  if (report.missingDungeons.length) {
    console.log(`\nНет подземелий (${report.missingDungeons.length}):`)
    console.log(`  ${report.missingDungeons.join(', ')}`)
  }

  if (report.missingRaids.length) {
    console.log(`\nНет рейдов (${report.missingRaids.length}):`)
    console.log(`  ${report.missingRaids.join(', ')}`)
  }
}

async function images(): Promise<void> {
  const results = await syncImages()

  for (const r of results) {
    const extra = r.reason ? ` — ${r.reason}` : ''
    console.log(`  [${r.status}] ${r.ref}${extra}`)
  }

  const count = (s: string) => results.filter((r) => r.status === s).length
  console.log(
    `\nВсего ${results.length}: скачано ${count('downloaded')}, ` +
      `без изменений ${count('unchanged')}, пропущено ${count('skipped')}, ошибок ${count('failed')}`
  )
}

/** Печатает готовые сообщения с разделителями — превью перед постингом. */
async function digest(): Promise<void> {
  const filter = process.argv.slice(3)
  const sections = await buildDigest(filter)

  const header = digestHeader()
  console.log(`>>> сообщение 1 (${header.length} симв.)`)
  console.log(header)

  let n = 1
  for (const section of sections) {
    for (const message of section.messages) {
      n++
      const flag = message.length > MESSAGE_LIMIT ? ' ПРЕВЫШЕН ЛИМИТ' : ''
      console.log(`\n>>> сообщение ${n} — ${section.title} (${message.length} симв.)${flag}`)
      console.log(message)
    }
  }

  console.log(`\n=== всего сообщений: ${n} ===`)
}

/** Постинг в канал: pnpm bot:post <channelId> [раздел...] */
async function post(): Promise<void> {
  const channelId = process.argv[3]
  if (!channelId) throw new Error('нужен id канала: pnpm bot:post <channelId> [раздел...]')

  const results = await postDigest(channelId, process.argv.slice(4))
  const failed = results.filter((r) => r.status === 'failed')

  console.log(`\nОтправлено ${results.length - failed.length} из ${results.length}`)
  if (failed.length) process.exitCode = 1
}

/** Обновляет кэш эмодзи сервера: pnpm bot:emoji */
async function emoji(): Promise<void> {
  const { validateDiscordConfig } = await import('./config')
  const config = validateDiscordConfig()

  const guildId = config.guildId || process.argv[3]
  if (!guildId) throw new Error('нужен DISCORD_GUILD_ID или id гильдии аргументом')

  const cache = await refreshEmojiCache(guildId, config.token)
  console.log(`эмодзи в кэше: ${Object.keys(cache).length}`)
}

const command = process.argv[2]

const run =
  command === 'emoji'
    ? emoji
    : command === 'post'
      ? post
      : command === 'images'
        ? images
        : command === 'digest'
          ? digest
          : check

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
