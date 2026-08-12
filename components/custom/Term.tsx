interface TermProps {
  spellId: string | number
  formal: string
  slang: string
  children: React.ReactNode
}

export default function Term({ spellId, formal, slang, children }: TermProps) {
  const tooltip = `${slang} = ${formal}`
  const href = `https://www.wowhead.com/ru/spell=${spellId}`
  return (
    <a
      className="glossary-term"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={tooltip}
      data-slang={slang}
      data-formal={formal}
    >
      {children}
    </a>
  )
}
