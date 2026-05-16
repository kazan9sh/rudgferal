'use client'
import NextImage, { ImageProps } from 'next/image'
import { useState } from 'react'
import styles from './image.module.css'
import { withBasePath } from '@/lib/utils/basePath'

const Image = ({ ...rest }: ImageProps) => {
  const [isFullScreen, setIsFullScreen] = useState(false)

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen)
  }

  return (
    <div className={isFullScreen ? styles.fullScreen : ''} onClick={toggleFullScreen}>
      <NextImage {...rest} src={withBasePath(rest.src)} />
    </div>
  )
}

export default Image
