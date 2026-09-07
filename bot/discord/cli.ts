/**
 * Запуск логики бота без Discord — удобно проверять на месте:
 *   pnpm bot:check    — что разошлось с upstream
 *   pnpm bot:images   — скачать картинки
 */
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

const command = process.argv[2]

const run = command === 'images' ? images : check

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
