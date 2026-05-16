import { redirect } from 'next/navigation'
import Link from '@/components/Link'

// Force static generation
export const dynamic = 'force-static'

export default function Page() {
  if (process.env.GITHUB_PAGES !== 'true') {
    redirect('/blog/feral/compendium')
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="mb-4 text-3xl font-bold text-[#ffcf4a]">СИЛА ЗВЕРЯ</h1>
      <p className="mb-6 text-[#e8ddd9]">Русский компедиум по друиду специализации Сила Зверя.</p>
      <Link
        href="/blog/feral/compendium"
        className="text-main underline decoration-2 underline-offset-4"
      >
        Открыть гайд
      </Link>
    </main>
  )
}
