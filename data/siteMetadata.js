const repositoryUrl = process.env.NEXT_PUBLIC_SITE_REPO || 'https://github.com/kazan9sh/rudgferal'
const repositoryBranch = process.env.NEXT_PUBLIC_SITE_BRANCH || 'master'

/** @type {Record<string, any>} */
const siteMetadata = {
  title: 'СИЛА ЗВЕРЯ',
  author: 'Казаняш',
  authorUrl: 'https://github.com/kazan9sh',
  headerTitle: 'СИЛА ЗВЕРЯ',
  description:
    'Русский компендиум по друиду специализации Сила Зверя: ротация, таланты, экипировка и полезные ресурсы.',
  language: 'ru',
  theme: 'dark',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://kazan9sh.github.io/rudgferal',
  siteRepo: repositoryUrl,
  repositoryBranch,
  siteLogo: '/static/images/rotation-logo.png',
  socialBanner: '/static/images/twitter-card.png',
  github: repositoryUrl,
  locale: 'ru-RU',
  analytics: {
    umamiAnalytics: {
      umamiWebsiteId: process.env.NEXT_UMAMI_ID,
    },
  },
  newsletter: {
    //provider: 'buttondown',
  },
  comments: {
    //provider: 'giscus', // supported providers: giscus, utterances, disqus
    //giscusConfig: {
    //  repo: process.env.NEXT_PUBLIC_GISCUS_REPO,
    //  repositoryId: process.env.NEXT_PUBLIC_GISCUS_REPOSITORY_ID,
    //  category: process.env.NEXT_PUBLIC_GISCUS_CATEGORY,
    //  categoryId: process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID,
    //  mapping: 'pathname',
    //  reactions: '0',
    //  metadata: '0',
    //  theme: 'light',
    //  darkTheme: 'transparent_dark',
    //  themeURL: '',
    //  lang: 'en',
    //},
  },
  search: {
    provider: 'kbar',
    kbarConfig: {
      searchDocumentsPath: 'search.json',
    },
    // provider: 'algolia',
    // algoliaConfig: {
    //   // The application ID provided by Algolia
    //   appId: 'R2IYF7ETH7',
    //   // Public API key: it is safe to commit it
    //   apiKey: '599cec31baffa4868cae4e79f180729b',
    //   indexName: 'docsearch',
    // },
  },
}

module.exports = siteMetadata
