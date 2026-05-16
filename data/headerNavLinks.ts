const headerNavLinks = [
  { href: '/', title: 'Главная' },
  ...(process.env.NEXT_PUBLIC_GITHUB_PAGES === 'true'
    ? []
    : [{ href: '/planner', title: 'Planner' }]),
  { href: 'https://discord.gg/FJPK3JftP4', title: 'Discord' },
]

export default headerNavLinks
