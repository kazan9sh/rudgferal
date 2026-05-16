'use client'

import { useEffect, useMemo, useState } from 'react'
import ClientTocItem, { getIdFromUrl } from './ClientTocItem'
import ClientCollapsible from './ClientCollapsible'

interface Chapter {
  value: string
  depth: number
  url: string
}

export default function TableOfContents({
  chapters,
  inSidebar = false,
  toggleNav = () => {},
}: {
  chapters: Chapter[]
  inSidebar?: boolean
  toggleNav?: () => void
}) {
  const visibleChapters = useMemo(() => chapters.filter((item) => item.depth < 3), [chapters])
  const headingIds = useMemo(
    () => visibleChapters.map((item) => getIdFromUrl(item.url)),
    [visibleChapters]
  )
  const [activeId, setActiveId] = useState(() => headingIds[0] || '')

  useEffect(() => {
    if (headingIds.length === 0) return

    let frame = 0

    const updateActiveHeading = () => {
      const offset = window.innerWidth >= 1024 ? 174 : 122
      const scrollLine = window.scrollY + offset
      let currentId = headingIds[0]

      for (const id of headingIds) {
        const element = document.getElementById(id)
        if (!element) continue

        const top = element.getBoundingClientRect().top + window.scrollY
        if (top <= scrollLine) {
          currentId = id
        } else {
          break
        }
      }

      setActiveId(currentId)
    }

    const requestUpdate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(updateActiveHeading)
    }

    updateActiveHeading()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    window.addEventListener('hashchange', requestUpdate)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      window.removeEventListener('hashchange', requestUpdate)
    }
  }, [headingIds])

  if (inSidebar) {
    return (
      <nav
        className="mb-8 flex items-center self-start overflow-auto px-12 pt-9"
        aria-label="Table of Contents"
      >
        <ol className="w-full list-none space-y-3">
          {renderCollapsibleItems(chapters, toggleNav, activeId, setActiveId)}
        </ol>
      </nav>
    )
  }

  return (
    <nav className="flex self-start" aria-label="Table of Contents">
      <ol className="list-none">
        {chapters.map((item, index) => {
          if (item.depth < 3) {
            return (
              <ClientTocItem key={index} item={item} activeId={activeId} onActivate={setActiveId} />
            )
          }
          return null
        })}
      </ol>
    </nav>
  )
}

function renderCollapsibleItems(
  items: Chapter[],
  toggleNav: () => void,
  activeId: string,
  setActiveId: (id: string) => void
) {
  const collapsibleItems: React.ReactNode[] = []
  let currentDepth1Item: Chapter | null = null
  let currentDepth2Items: Chapter[] = []

  for (let i = 0; i < items.length; i++) {
    if (items[i].depth === 1) {
      if (currentDepth1Item) {
        collapsibleItems.push(
          <ClientCollapsible key={collapsibleItems.length} name={currentDepth1Item.value}>
            <ol className="list-none space-y-3">
              {currentDepth2Items.map((subItem, idx) => (
                <ClientTocItem
                  key={idx}
                  item={subItem}
                  inSidebar={true}
                  toggleNav={toggleNav}
                  activeId={activeId}
                  onActivate={setActiveId}
                />
              ))}
            </ol>
          </ClientCollapsible>
        )
      }
      currentDepth1Item = items[i]
      currentDepth2Items = []
    } else if (items[i].depth === 2) {
      currentDepth2Items.push(items[i])
    }
  }

  if (currentDepth1Item) {
    collapsibleItems.push(
      <ClientCollapsible key={collapsibleItems.length} name={currentDepth1Item.value}>
        <ol className="list-none space-y-3">
          {currentDepth2Items.map((subItem, subIndex) => (
            <ClientTocItem
              key={subIndex}
              item={subItem}
              inSidebar={true}
              toggleNav={toggleNav}
              activeId={activeId}
              onActivate={setActiveId}
            />
          ))}
        </ol>
      </ClientCollapsible>
    )
  }

  return collapsibleItems
}
