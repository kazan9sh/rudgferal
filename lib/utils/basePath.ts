export function withBasePath(path: string): string
export function withBasePath<T>(path: T): T
export function withBasePath(path: unknown): unknown {
  if (typeof path !== 'string') {
    return path
  }

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

  if (
    !basePath ||
    !path.startsWith('/') ||
    path.startsWith(`${basePath}/`) ||
    path.startsWith('//')
  ) {
    return path
  }

  return `${basePath}${path}`
}
