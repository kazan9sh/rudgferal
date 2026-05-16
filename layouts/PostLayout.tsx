import { ReactNode } from 'react'
import { CoreContent } from '@/lib/utils/contentlayer'
import type { Blog } from 'contentlayer/generated'
import PageTitle from '@/components/PageTitle'
import SectionContainer from '@/components/SectionContainer'
import ScrollTopAndComment from '@/components/ScrollTopAndComment'
import TableOfContents from '@/components/custom/TableOfContents/TableOfContents'
import { FaHistory } from 'react-icons/fa'
import CheckboxProvider from '@/components/custom/CheckboxProvider'

interface LayoutProps {
  content: CoreContent<Blog>
  authorDetails: string[]
  next?: { path: string; title: string }
  prev?: { path: string; title: string }
  children: ReactNode
  toc: any
}

export default function PostLayout({ content, children, toc }: LayoutProps) {
  const { patch, title, lastModified, changelogUrl } = content

  return (
    <SectionContainer>
      <ScrollTopAndComment />
      <article>
        <div>
          <header className="h-auto pt-4 pb-12 lg:h-28 lg:py-0">
            <div className="text-center lg:h-full">
              <div className="lg:hidden">
                <PageTitle>{title}</PageTitle>
              </div>

              <div className="flex h-full flex-col lg:flex-row lg:items-center lg:justify-between">
                <div className="pt-4 lg:h-full lg:content-around lg:self-end lg:pt-0" />
                <div className="pt-4 text-base leading-6 font-medium text-gray-500 lg:pt-0 lg:text-right dark:text-gray-400">
                  <div>
                    Патч: <span className="text-main">{patch}</span>
                  </div>
                  <div>
                    Обновлено: <span className="text-main">{lastModified}</span>
                  </div>
                  <div className="hidden lg:inline">
                    <a
                      href={changelogUrl}
                      className="text-main mt-[-2px] text-base underline decoration-2 underline-offset-4"
                    >
                      <FaHistory className="mr-2 inline" />
                      <span className="inline">История</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <div className="mb-5 h-px bg-gradient-to-r from-transparent via-gray-400/40 to-transparent dark:via-gray-600/40"></div>
          <div className="grid-rows-[auto_1fr] pb-8 lg:grid lg:grid-cols-12 lg:gap-x-8 lg:divide-y-0 lg:divide-gray-200 lg:dark:divide-gray-700">
            <aside className="hidden overflow-y-auto lg:sticky lg:top-0 lg:col-span-3 lg:block lg:h-svh lg:pt-5">
              {toc && Array.isArray(toc) ? <TableOfContents chapters={toc} /> : null}
            </aside>

            <div id="main" className="relative pt-4 lg:col-span-9 lg:pt-5 lg:pb-0 lg:pl-6">
              <div className="absolute top-[-5px] right-0 sm:top-[-50px] sm:-right-[0px] sm:left-auto lg:hidden">
                <a
                  href={changelogUrl}
                  className="text-main ml-0 text-sm font-medium underline decoration-2 underline-offset-4 sm:-ml-6 sm:text-base"
                >
                  <FaHistory className="mr-2 inline" />
                  <span className="inline align-top">История</span>
                </a>
              </div>
              <div
                style={{ counterReset: 'heading' }}
                className="prose dark:prose-invert max-w-none pt-4 pb-8 text-base sm:pt-0"
              >
                <CheckboxProvider>{children}</CheckboxProvider>
              </div>
            </div>
          </div>
        </div>
      </article>
    </SectionContainer>
  )
}
