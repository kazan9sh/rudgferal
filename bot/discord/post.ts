/**
 * Постинг дайджеста в канал.
 *
 * Discord ограничивает частоту сообщений в канале, поэтому шлём последовательно
 * с паузой и уважаем retry_after, если всё-таки упёрлись в лимит.
 */
import { validateDiscordConfig } from './config'
import { buildDigest, digestHeader, MESSAGE_LIMIT } from './digest'

const API = 'https://discord.com/api/v10'
const PAUSE_MS = 1200

export type PostResult = {
  index: number
  section: string
  status: 'ok' | 'failed'
  messageId?: string
  reason?: string
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendMessage(channelId: string, content: string): Promise<string> {
  const { token } = validateDiscordConfig()

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    })

    if (res.status === 429) {
      const body = (await res.json()) as { retry_after?: number }
      await sleep((body.retry_after ?? 1) * 1000 + 250)
      continue
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }

    return ((await res.json()) as { id: string }).id
  }

  throw new Error('не удалось отправить после трёх попыток из-за rate limit')
}

/** Собирает дайджест и постит его в канал. Ничего не удаляет и не редактирует. */
export async function postDigest(
  channelId: string,
  sectionFilter?: string[]
): Promise<PostResult[]> {
  const sections = await buildDigest(sectionFilter)

  const queue: { section: string; content: string }[] = [
    { section: 'Шапка', content: digestHeader() },
    ...sections.flatMap((s) => s.messages.map((content) => ({ section: s.title, content }))),
  ]

  const tooLong = queue.filter((m) => m.content.length > MESSAGE_LIMIT)
  if (tooLong.length) {
    throw new Error(
      `${tooLong.length} сообщений длиннее ${MESSAGE_LIMIT} символов — постинг отменён`
    )
  }

  const results: PostResult[] = []

  for (const [index, message] of queue.entries()) {
    try {
      const messageId = await sendMessage(channelId, message.content)
      results.push({ index: index + 1, section: message.section, status: 'ok', messageId })
      console.log(`  [${index + 1}/${queue.length}] ${message.section} — отправлено`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      results.push({ index: index + 1, section: message.section, status: 'failed', reason })
      console.error(`  [${index + 1}/${queue.length}] ${message.section} — ОШИБКА: ${reason}`)
    }

    await sleep(PAUSE_MS)
  }

  return results
}
