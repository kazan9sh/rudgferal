import { redirect } from 'next/navigation'

// Force static generation
export const dynamic = 'force-static'

export default function Page() {
  redirect('/blog/feral/compendium')
}
