// Copies release metadata from the root package.json into every publishable
// package before publishing, so all packages share one version and the same
// author/repository/license fields. Run by scripts/publish.sh.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FIELDS = ['version', 'author', 'repository', 'bugs', 'homepage', 'license']
const INTERNAL_SCOPE = '@cisstech/node-lens-'
const root = JSON.parse(readFileSync('package.json', 'utf8'))
const packagesDir = 'packages'

// Keep every @cisstech/node-lens-* dependency in sync with the release version.
function alignInternalDeps(deps) {
  if (!deps) return
  for (const dep of Object.keys(deps)) {
    if (dep.startsWith(INTERNAL_SCOPE)) deps[dep] = `^${root.version}`
  }
}

for (const name of readdirSync(packagesDir)) {
  const file = join(packagesDir, name, 'package.json')
  if (!existsSync(file)) continue

  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  if (pkg.private) continue

  for (const field of FIELDS) {
    if (root[field] !== undefined) pkg[field] = root[field]
  }
  alignInternalDeps(pkg.dependencies)
  alignInternalDeps(pkg.peerDependencies)

  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`synced ${pkg.name} -> ${root.version}`)
}
