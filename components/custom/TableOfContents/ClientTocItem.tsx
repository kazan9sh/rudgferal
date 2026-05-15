'use client'

import { useState, useEffect } from 'react'

interface Chapter {
  value: string
  depth: number
  url: string
}

type ClientTocItemProps = {
  item: Chapter
  inSidebar?: boolean
  toggleNav?: () => void
  initialActive?: boolean
}

function getIdFromUrl(url: string): string {
  return url.replace(/-\d+$/, '') // Remove '#' and the trailing '-{number}'
}

function scrollToTarget(targetUrl: string, onBeforeScroll?: () => void, delay = 0) {
  const element = document.querySelector(targetUrl)
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
  initialActive = false,
}: ClientTocItemProps) {
  const [isActive, setIsActive] = useState(initialActive)
  const targetUrl = getIdFromUrl(item.url)

  useEffect(() => {
    if (inSidebar) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsActive(true)
          } else {
            setIsActive(false)
          }
        })
      },
      {
        rootMargin: '-9% 0px -89% 0px',
      }
    )

    const elementId = `container-${getIdFromUrl(item.url.slice(1))}`
    const element = document.getElementById(elementId)
    if (element) {
      observer.observe(element)
    }

    return () => {
      observer.disconnect()
    }
  }, [item.url, inSidebar])

  if (inSidebar && toggleNav) {
    return (
      <li
        className={`text-md my-2 font-bold text-gray-800 dark:text-gray-400`}
        style={{
          marginLeft: `${(item.depth - 1) * 25}px`,
          marginTop: item.depth === 1 ? '0' : '5px',
        }}
      >
        <a
          onClick={(e) => {
            e.preventDefault()
            scrollToTarget(targetUrl, toggleNav, 300)
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
          scrollToTarget(targetUrl)
        }}
        href={targetUrl}
      >
        {item.value}
      </a>
    </li>
  )
}
