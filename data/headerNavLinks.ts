const headerNavLinks = [
  { href: '/', title: 'Главная' },
  ...(process.env.NEXT_PUBLIC_GITHUB_PAGES === 'true'
    ? []
    : [{ href: '/planner', title: 'Planner' }]),
  { href: 'https://discord.gg/KzUqYFtXmf', title: 'Приходите в чат фералов' },
]

export default headerNavLinks
