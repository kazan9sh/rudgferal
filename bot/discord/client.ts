import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  type ChatInputCommandInteraction,
} from 'discord.js'
import { commands, renderGuideCheck, renderImageSync } from './commands'
import { validateDiscordConfig } from './config'

const config = validateDiscordConfig()

// Только Guilds: slash-команды приходят как interaction, читать чужие сообщения
// не нужно, поэтому привилегированный MESSAGE CONTENT не запрашиваем.
const client = new Client({ intents: [GatewayIntentBits.Guilds] })

async function registerCommands(guildId: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.token)

  await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), { body: commands })
  console.log(`Команды зарегистрированы на гильдии ${guildId}`)
}

function isAllowed(interaction: ChatInputCommandInteraction): boolean {
  if (!config.adminRoleId) return true

  const roles = interaction.member?.roles
  if (!roles || Array.isArray(roles)) return false

  return roles.cache.has(config.adminRoleId)
}

async function handle(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!isAllowed(interaction)) {
    await interaction.reply({
      content: 'Команда доступна только роли администратора гайда.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  // Сверка ходит в GitHub и качает файлы — почти всегда дольше 3 секунд,
  // поэтому сначала defer, иначе Discord закроет interaction.
  await interaction.deferReply()

  try {
    const embed =
      interaction.commandName === 'guide-images'
        ? await renderImageSync()
        : await renderGuideCheck()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Команда ${interaction.commandName} упала:`, error)

    await interaction.editReply(`Не сработало: ${message}`)
  }
}

client.once(Events.ClientReady, async (ready) => {
  console.log(`Logged in as ${ready.user.tag}`)

  const guilds = config.guildId ? [config.guildId] : [...ready.guilds.cache.keys()]

  if (!guilds.length) {
    console.warn('Бот не состоит ни в одной гильдии — команды регистрировать некуда.')
    return
  }

  for (const guildId of guilds) {
    try {
      await registerCommands(guildId)
    } catch (error) {
      console.error(`Не удалось зарегистрировать команды на ${guildId}:`, error)
    }
  }
})

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return
  await handle(interaction)
})

client.on(Events.Error, (error) => console.error('Ошибка клиента Discord:', error))

process.on('SIGTERM', () => {
  console.log('SIGTERM — закрываю соединение')
  client.destroy().finally(() => process.exit(0))
})

client.login(config.token).catch((error) => {
  console.error('Логин не прошёл:', error)
  process.exit(1)
})
