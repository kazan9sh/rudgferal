import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const disabledRoot = path.join(root, '.pages-disabled')
const appDir = path.join(root, 'app')
const apiDir = path.join(appDir, 'api')
const plannerDir = path.join(appDir, '(planner)')
const disabledPlannerDir = path.join(disabledRoot, '(planner)')
const disabledRoutesDir = path.join(disabledRoot, 'api-routes')
const baseEnv = {
  ...process.env,
  GITHUB_PAGES: 'true',
  NEXT_PUBLIC_GITHUB_PAGES: 'true',
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || '/rudgferal',
  INIT_CWD: root,
}

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...baseEnv, ...extraEnv },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exitCode = result.status || 1
    throw new Error(`${command} ${args.join(' ')} failed`)
  }
}

function collectApiRoutes(dir, routes = []) {
  if (!existsSync(dir)) return routes

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectApiRoutes(entryPath, routes)
    } else if (entry.isFile() && entry.name === 'route.ts') {
      routes.push(entryPath)
    }
  }

  return routes
}

const movedRoutes = []
let plannerMoved = false

try {
  mkdirSync(disabledRoot, { recursive: true })
  mkdirSync(disabledRoutesDir, { recursive: true })
  rmSync(path.join(root, '.next'), { recursive: true, force: true })
  rmSync(path.join(root, 'out'), { recursive: true, force: true })

  if (existsSync(disabledPlannerDir)) {
    rmSync(disabledPlannerDir, { recursive: true, force: true })
  }

  if (existsSync(plannerDir)) {
    renameSync(plannerDir, disabledPlannerDir)
    plannerMoved = true
  }

  for (const routePath of collectApiRoutes(apiDir)) {
    const relativeRoutePath = path.relative(apiDir, routePath)
    const disabledRoutePath = path.join(disabledRoutesDir, relativeRoutePath)
    mkdirSync(path.dirname(disabledRoutePath), { recursive: true })
    renameSync(routePath, disabledRoutePath)
    movedRoutes.push([routePath, disabledRoutePath])
  }

  run('pnpm', ['exec', 'next', 'build', '--webpack'], {
    NODE_OPTIONS: '--disable-warning=DEP0040',
  })
  run('node', ['./scripts/postbuild.mjs'], {
    NODE_OPTIONS: '--experimental-json-modules --disable-warning=DEP0040',
  })

  writeFileSync(path.join(root, 'out', '.nojekyll'), '')
} finally {
  for (const [routePath, disabledRoutePath] of movedRoutes.reverse()) {
    if (existsSync(disabledRoutePath) && !existsSync(routePath)) {
      renameSync(disabledRoutePath, routePath)
    }
  }

  if (plannerMoved && existsSync(disabledPlannerDir) && !existsSync(plannerDir)) {
    renameSync(disabledPlannerDir, plannerDir)
  }
}
