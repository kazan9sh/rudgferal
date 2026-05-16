'use client'

interface Chapter {
  value: string
  depth: number
  url: string
}

type ClientTocItemProps = {
  item: Chapter
  inSidebar?: boolean
  toggleNav?: () => void
  activeId?: string
  onActivate?: (id: string) => void
}

export function getIdFromUrl(url: string): string {
  return url.replace(/^#/, '').replace(/-\d+$/, '')
}

function scrollToTarget(targetId: string, onBeforeScroll?: () => void, delay = 0) {
  const element = document.getElementById(targetId)
  if (!element) return

  onBeforeScroll?.()

  window.setTimeout(() => {
    const headerOffset = window.innerWidth >= 1024 ? 164 : 112
    const elementTop = element.getBoundingClientRect().top + window.scrollY

    window.scrollTo({
      top: Math.max(elementTop - headerOffset, 0),
      behavior: 'smooth',
    })
  }, delay)
}

export default function ClientTocItem({
  item,
  inSidebar = false,
  toggleNav = () => {},
  activeId = '',
  onActivate = () => {},
}: ClientTocItemProps) {
  const targetId = getIdFromUrl(item.url)
  const targetUrl = `#${targetId}`
  const isActive = activeId === targetId

  if (inSidebar && toggleNav) {
    return (
      <li
        className={`toc-item text-md my-2 font-bold text-gray-800 dark:text-gray-400 ${
          isActive ? 'toc-item--active' : ''
        }`}
        style={{
          marginLeft: `${(item.depth - 1) * 25}px`,
          marginTop: item.depth === 1 ? '0' : '5px',
        }}
      >
        <a
          onClick={(e) => {
            e.preventDefault()
            onActivate(targetId)
            scrollToTarget(targetId, toggleNav, 300)
          }}
          href={targetUrl}
        >
          {item.value}
        </a>
      </li>
    )
  }

  return (
    <li
      className={`toc-item ${isActive ? 'toc-item--active' : ''}`}
      style={{
        marginLeft: `${(item.depth - 1) * 25}px`,
        marginTop: item.depth === 1 ? '0' : '5px',
      }}
    >
      <a
        onClick={(e) => {
          e.preventDefault()
          onActivate(targetId)
          scrollToTarget(targetId)
        }}
        href={targetUrl}
      >
        {item.value}
      </a>
    </li>
  )
}
