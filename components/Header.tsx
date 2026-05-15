'use client'
import siteMetadata from '@/data/siteMetadata'
import headerNavLinks from '@/data/headerNavLinks'
import Link from './Link'
import MobileNav from './MobileNav'
import ThemeSwitch from './ThemeSwitch'
import HeaderAprilFools from '../app/components/HeaderAprilFools'
import styles from './Header.module.css'
import { memo } from 'react'
import { useTheme } from 'next-themes'

interface Chapter {
  value: string
  depth: number
  url: string
}

interface HeaderProps {
  toc?: Chapter[]
  title?: string
  showTitle?: boolean
  isBlog?: boolean
}

// Base header component that never changes internally
const BaseHeader = memo(function BaseHeader(props: HeaderProps) {
  const { toc, title, showTitle = true } = props
  const isMainPage = title === 'Main'

  return (
    <header
      className={`${styles.headerScrollShadow} top-0 z-20 box-border flex min-h-[70px] w-full justify-center bg-[#100f0f] pt-6 text-center sm:static sm:pt-8 md:mt-0 md:pt-8 dark:bg-[#100f0f] ${
        !isMainPage ? 'sticky' : ''
      }`}
    >
      <div className="xl:max-w-8xl mx-auto w-full max-w-7xl px-6 sm:px-12 xl:px-6">
        <div className="relative flex w-full items-end justify-between pb-7 sm:pb-8">
          {title && title !== '' && showTitle && (
            <div className="absolute right-0 bottom-0 left-0 hidden h-px bg-gray-600 opacity-35 md:block"></div>
          )}
          <div className="z-10 flex h-full items-center">
            <Link
              href="/"
              aria-label={siteMetadata.headerTitle}
              className="title-effect text-lg font-bold sm:text-xl lg:text-2xl"
            >
              <span className="title-effect-front site-title">
                <span className="site-title-accent">СИЛА ЗВЕРЯ</span>
              </span>
            </Link>
          </div>

          <div className="mb-[-2px] flex h-full items-center">
            <div className="hidden space-x-3 sm:inline-flex sm:items-end lg:space-x-3">
              {headerNavLinks
                .filter((link) => link.href !== '/')
                .map((link) => (
                  <div className="title-effect sm:text-xl lg:text-lg" key={link.title}>
                    <Link href={link.href} className="font-semibold">
                      <span className="title-effect-front">{link.title}</span>
                    </Link>
                  </div>
                ))}
            </div>
            <div className="ml-2 flex h-[31px] items-center sm:ml-6 sm:hidden">
              {false && <ThemeSwitch />}
              <MobileNav toc={toc} />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
})

// April Fools component is also memoized
const MemoizedAprilFools = memo(HeaderAprilFools)

// Main Header component
function Header(props: HeaderProps) {
  const { theme } = useTheme()

  if (theme === 'april-fools') {
    return <MemoizedAprilFools {...props} />
  }

  return <BaseHeader {...props} />
}

export default Header
