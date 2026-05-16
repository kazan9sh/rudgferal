import { ThemeProvider } from 'next-themes'
import siteMetadata from '@/data/siteMetadata'

export default function ThemeProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={siteMetadata.theme}
      forcedTheme={siteMetadata.theme}
      enableSystem={false}
      themes={['dark']}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  )
}
