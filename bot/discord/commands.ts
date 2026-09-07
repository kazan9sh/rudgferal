import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import { checkGuide, syncImages, untouchedSections } from './sync'
import type { ImageResult } from './images'

export const commands = [
  new SlashCommandBuilder()
    .setName('guide-check')
    .setDescription('Показать, чем гайд в dreamgrove отличается от нашего')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('guide-images')
    .setDescription('Скачать картинки, на которые ссылается свежий гайд upstream')
    .toJSON(),
]

const COLOR_OK = 0x3ba55d
const COLOR_WARN = 0xe67e22

function truncate(text: string, limit = 1024): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`
}

export async function renderGuideCheck(): Promise<EmbedBuilder> {
  const report = await checkGuide()

  const drifted = report.drift.filter((d) => d.status === 'разошлись')
  const unmapped = report.drift.filter((d) => d.status === 'не размечена')
  const absent = report.drift.filter((d) => d.status === 'нет у нас')

  const hasWork =
    report.commits.length > 0 ||
    drifted.length > 0 ||
    report.missingDungeons.length > 0 ||
    report.missingRaids.length > 0

  const embed = new EmbedBuilder()
    .setTitle('Сверка с dreamgrove')
    .setColor(hasWork ? COLOR_WARN : COLOR_OK)
    .setDescription(
      `Наш компендиум последний раз правился ${report.since.slice(0, 10)}.\n` +
        (hasWork ? 'Есть расхождения — ниже подробности.' : 'Расхождений не найдено.')
    )
    .setTimestamp(new Date())

  if (report.commits.length) {
    const lines = report.commits
      .slice(0, 10)
      .map((c) => `\`${c.date.slice(0, 10)}\` ${c.message}`)
      .join('\n')

    embed.addFields({
      name: `Коммиты upstream (${report.commits.length})`,
      value: truncate(lines),
    })
  }

  if (drifted.length) {
    const lines = drifted
      .map((d) => `**${d.upstreamTitle}** → «${d.ourTitle}» (${d.upstreamBlocks} / ${d.ourBlocks})`)
      .join('\n')

    embed.addFields({
      name: 'Секции разошлись по объёму (upstream / наш)',
      value: truncate(lines),
    })
  }

  if (absent.length) {
    embed.addFields({
      name: 'Размечены, но не найдены в нашем файле',
      value: truncate(absent.map((d) => `${d.upstreamTitle} → «${d.ourTitle}»`).join('\n')),
    })
  }

  if (unmapped.length) {
    embed.addFields({
      name: 'Новые секции upstream без маппинга',
      value: truncate(unmapped.map((d) => d.upstreamTitle).join(', ')),
    })
  }

  if (report.missingDungeons.length) {
    embed.addFields({
      name: `Нет подземелий (${report.missingDungeons.length})`,
      value: truncate(report.missingDungeons.join(', ')),
    })
  }

  if (report.missingRaids.length) {
    embed.addFields({
      name: `Нет рейдов (${report.missingRaids.length})`,
      value: truncate(report.missingRaids.join(', ')),
    })
  }

  embed.setFooter({
    text: `Не трогаем: ${untouchedSections().join(', ')}. Текст переводится вручную.`,
  })

  return embed
}

export async function renderImageSync(): Promise<EmbedBuilder> {
  const results = await syncImages()

  const by = (status: ImageResult['status']) => results.filter((r) => r.status === status)
  const downloaded = by('downloaded')
  const failed = by('failed')

  const embed = new EmbedBuilder()
    .setTitle('Синхронизация картинок')
    .setColor(failed.length ? COLOR_WARN : COLOR_OK)
    .setDescription(
      `Ссылок в гайде: ${results.length}. ` +
        `Скачано: ${downloaded.length}, без изменений: ${by('unchanged').length}, ` +
        `пропущено: ${by('skipped').length}, ошибок: ${failed.length}.`
    )
    .setTimestamp(new Date())

  if (downloaded.length) {
    embed.addFields({ name: 'Скачано', value: truncate(downloaded.map((r) => r.ref).join('\n')) })
  }

  if (failed.length) {
    embed.addFields({
      name: 'Ошибки',
      value: truncate(failed.map((r) => `${r.ref} — ${r.reason}`).join('\n')),
    })
  }

  if (downloaded.length) {
    embed.setFooter({ text: 'Файлы лежат в public/, закоммить их отдельно.' })
  }

  return embed
}
