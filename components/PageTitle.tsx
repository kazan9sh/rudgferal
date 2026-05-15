import { Fragment, ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

function renderTitle(children: ReactNode) {
  if (typeof children !== 'string') return children

  const parts = children.split(/(СИЛА ЗВЕРЯ|Сила Зверя)/)
  return parts.map((part, index) =>
    part === 'СИЛА ЗВЕРЯ' || part === 'Сила Зверя' ? (
      <span key={index} className="text-[#f2c94c]">
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  )
}

export default function PageTitle({ children, className = '' }: Props) {
  return (
    <h1
      className={`text-3xl leading-9 font-bold tracking-tight text-[#f3f3f3] sm:text-4xl sm:leading-10 ${className}`}
    >
      {renderTitle(children)}
    </h1>
  )
}
