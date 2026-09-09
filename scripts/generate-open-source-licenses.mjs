import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = join(root, 'src/data/openSourceLicenses.json')
const projects = [
  { directory: '', runtime: 'app', lockfile: 'package-lock.json' },
  { directory: 'functions', runtime: 'server', lockfile: 'functions/package-lock.json' },
]
const hash = value => createHash('sha256').update(value).digest('hex')
const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const cachePath = join(root, '.verification.local/license-partial.json')
const previous = existsSync(outputPath) ? readJson(outputPath)
  : process.argv.includes('--resume') && existsSync(cachePath) ? readJson(cachePath) : null
const sources = {}
const dependencies = new Map()

for (const project of projects) {
  const lock = readJson(join(root, project.lockfile))
  sources[project.lockfile] = hash(JSON.stringify(lock))
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path) continue
    const name = entry.name || path.split('node_modules/').at(-1)
    const key = `${name}@${entry.version}`
    const scope = entry.dev ? 'development' : project.runtime
    const direct = Object.hasOwn(lock.packages[''].dependencies || {}, name)
      || Object.hasOwn(lock.packages[''].devDependencies || {}, name)
    const dependency = dependencies.get(key) || {
      name, version: entry.version, license: entry.license,
      integrity: entry.integrity, scopes: new Set(), direct: false, directories: [],
    }
    dependency.scopes.add(scope)
    dependency.direct ||= direct
    dependency.directories.push(join(root, project.directory, path))
    dependencies.set(key, dependency)
  }
}

function validate(data) {
  const regenerate = 'npm run licenses:generate를 실행하고 src/data/openSourceLicenses.json을 잠금 파일과 함께 커밋해 주세요.'
  if (!data || !Array.isArray(data.packages) || !data.texts) {
    throw new Error(`라이선스 목록이 없거나 올바르지 않습니다. ${regenerate}`)
  }
  // sources records the lockfiles used during generation. npm can rewrite peer
  // flags and other metadata without changing any packages, so validate the
  // actual inventory and notices instead of requiring whole-file hashes to match.
  const indexed = new Map(data.packages.map(entry => [`${entry.name}@${entry.version}`, entry]))
  if (indexed.size !== data.packages.length) throw new Error(`라이선스 목록에 중복이 있습니다. ${regenerate}`)
  const missing = [...dependencies.keys()].filter(key => !indexed.has(key))
  const extra = [...indexed.keys()].filter(key => !dependencies.has(key))
  if (missing.length || extra.length) {
    throw new Error(`라이선스 목록이 의존성과 다릅니다. 누락: ${missing.join(', ') || '없음'}. 불필요: ${extra.join(', ') || '없음'}. ${regenerate}`)
  }
  for (const [key, dependency] of dependencies) {
    const entry = indexed.get(key)
    if (!entry?.license || entry.integrity !== dependency.integrity
      || (dependency.license && entry.license !== dependency.license)
      || JSON.stringify(entry.scopes) !== JSON.stringify([...dependency.scopes].sort(compare))
      || entry.direct !== dependency.direct || !Array.isArray(entry.documents) || !entry.documents.length) {
      throw new Error(`${key}: 라이선스 정보가 누락되었거나 오래되었습니다. ${regenerate}`)
    }
    for (const document of entry.documents) {
      const text = data.texts[document.textId]
      if (!text?.trim() || hash(text) !== document.textId || !document.source) {
        throw new Error(`${key}: 라이선스 원문을 확인해 주세요.`)
      }
    }
  }
}

if (process.argv.includes('--check')) {
  validate(previous)
  console.log(`Open-source licenses verified: ${previous.packages.length} packages, both lockfiles covered.`)
  process.exit(0)
}

const texts = {}
const packages = []
const failures = []
const remoteCache = new Map()

async function getText(url) {
  if (!remoteCache.has(url)) {
    remoteCache.set(url, (async () => {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (response.status === 404) return null
      if (!response.ok) throw new Error(`${response.status}: ${url}`)
      return response.text()
    })())
  }
  return remoteCache.get(url)
}

function repositoryUrl(repository) {
  const url = typeof repository === 'string' ? repository : repository?.url || ''
  return url.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '')
}

function documentFiles(directory, prefix = '', depth = 0) {
  const result = []
  for (const entry of readdirSync(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory() && depth < 4 && !['node_modules', '.git'].includes(entry.name)) {
      result.push(...documentFiles(directory, path, depth + 1))
    } else if (entry.isFile() && /(?:^|[._-])(licen[cs]e|notice|copying|copyright)(?:[._-]|$)/i.test(entry.name)
      && !/\.(?:js|ts|map|json|html)$/i.test(entry.name)) {
      result.push(path)
    }
  }
  return result.sort(compare)
}

function localDocuments(directory, metadata) {
  const files = documentFiles(directory)
  if (files.length) return files.map(path => ({
    title: path, text: readFileSync(join(directory, path), 'utf8'),
    source: `${metadata.name}@${metadata.version}/${path}`,
  }))
  // Some published packages keep their complete license inside a README or source header.
  const candidates = readdirSync(directory).filter(path => /^readme(?:\.|$)/i.test(path))
  if (metadata.main && existsSync(join(directory, metadata.main))) candidates.push(metadata.main)
  for (const path of candidates) {
    const contents = readFileSync(join(directory, path), 'utf8')
    const match = /(?:^|\n)(?:#{1,6}\s*)?Licen[cs]e[^\n]*\n/i.exec(contents)
    const section = match ? contents.slice(match.index).trimStart().split(/\n#{1,6} /)[0] : contents.match(/^\/\*[\s\S]*?\*\//)?.[0]
    if (section && /(?:permission is hereby granted|redistribution and use)/i.test(section)
      && /(?:SOFTWARE|DAMAGE)/.test(section)) {
      return [{ title: `${path} (license)`, text: section.trim(), source: `${metadata.name}@${metadata.version}/${path}` }]
    }
  }
  return []
}

async function upstreamDocuments(metadata, registry) {
  // This release's publishing tree contains no separate license file.
  if (metadata.name === 'tr46' && metadata.version === '0.0.3') return []
  const repository = repositoryUrl(registry.repository || metadata.repository)
  const githubPath = /^https:\/\/github\.com\/([^/]+\/[^/#]+)/.exec(repository)?.[1]
  if (!githubPath) return []
  // The registry's publishing commit anchors the notice to the installed version.
  const refs = registry.gitHead ? [registry.gitHead] : [`v${metadata.version}`, metadata.version]
  const subdirectory = registry.repository?.directory || metadata.repository?.directory
  const directories = subdirectory ? [subdirectory, '']
    : metadata.name === '@humanfs/types' ? ['packages/core', ''] : ['']
  for (const ref of refs) {
    for (const directory of directories) {
      const base = `https://raw.githubusercontent.com/${githubPath}/${ref}/${directory ? `${directory}/` : ''}`
      for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'LICENCE', 'COPYING']) {
        const source = base + file
        const text = await getText(source)
        if (text?.trim()) {
          const result = [{ title: file, text, source }]
          for (const notice of ['NOTICE', 'NOTICE.txt']) {
            const noticeText = await getText(base + notice)
            if (noticeText?.trim()) result.push({ title: notice, text: noticeText, source: base + notice })
          }
          return result
        }
      }
    }
  }
  return []
}

async function collect(dependency) {
  const key = `${dependency.name}@${dependency.version}`
  const cached = previous?.packages.find(item => `${item.name}@${item.version}` === key && item.integrity === dependency.integrity
    && (!dependency.license || item.license === dependency.license))
  if (cached) {
    for (const document of cached.documents) texts[document.textId] = previous.texts[document.textId]
    packages.push({ ...cached, scopes: [...dependency.scopes].sort(compare), direct: dependency.direct })
    return
  }
  let metadata
  let documents = []
  for (const directory of dependency.directories) {
    if (!existsSync(join(directory, 'package.json'))) continue
    const installed = readJson(join(directory, 'package.json'))
    if (installed.version !== dependency.version || installed.name !== dependency.name) continue
    metadata = installed
    documents = localDocuments(directory, metadata)
    if (documents.length) break
  }
  let registry
  if (!metadata || !documents.length) {
    registry = JSON.parse(await getText(`https://registry.npmjs.org/${encodeURIComponent(dependency.name)}/${dependency.version}`))
    metadata ||= registry
  }
  const license = dependency.license || metadata.license || metadata.licenses?.map(item => item.type).join(' OR ')
  if (!documents.length) documents = await upstreamDocuments(metadata, registry)
  if (!documents.length && license === 'MIT') {
    // A few publishers declare MIT but ship no license file, including at their publishing commit.
    // Preserve their actual attribution separately; never invent a copyright owner or year.
    const source = `https://registry.npmjs.org/${encodeURIComponent(dependency.name)}/${dependency.version}`
    documents.push({
      title: 'Package license declaration and attribution', source,
      text: JSON.stringify({ name: metadata.name, version: metadata.version, license,
        author: metadata.author, contributors: metadata.contributors, repository: metadata.repository }, null, 2),
    })
    for (const directory of dependency.directories) {
      if (!existsSync(join(directory, 'package.json'))) continue
      for (const file of readdirSync(directory).filter(path => /^readme(?:\.|$)/i.test(path))) {
        const contents = readFileSync(join(directory, file), 'utf8')
        const match = /(?:^|\n)(?:#{1,6}\s*)?Licen[cs]e[^\n]*\n/i.exec(contents)
        if (match) documents.push({ title: `${file} (license declaration)`,
          text: contents.slice(match.index).trimStart().split(/\n#{1,6} /)[0],
          source: `${metadata.name}@${metadata.version}/${file}` })
      }
      break
    }
    const standardSource = 'https://raw.githubusercontent.com/spdx/license-list-data/v3.26.0/json/details/MIT.json'
    const standard = JSON.parse(await getText(standardSource)).licenseText
    // SPDX's copyright line is a placeholder, not an attribution for these packages.
    documents.push({ title: 'MIT standard license terms (attribution above)', source: standardSource,
      text: standard.slice(standard.indexOf('Permission is hereby granted')) })
  }
  if (!license || !documents.length) throw new Error(`${key}: license/notice missing (gitHead: ${registry?.gitHead || 'none'})`)
  const uniqueDocuments = new Map()
  for (const document of documents) {
    const text = document.text.replace(/\r\n/g, '\n').trim()
    const textId = hash(text)
    texts[textId] = text
    uniqueDocuments.set(textId, { title: document.title, textId, source: document.source })
  }
  packages.push({
    name: dependency.name, version: dependency.version, license,
    integrity: dependency.integrity, scopes: [...dependency.scopes].sort(compare),
    direct: dependency.direct, repository: repositoryUrl(metadata.repository),
    documents: [...uniqueDocuments.values()],
  })
}

const queue = [...dependencies.values()]
await Promise.all(Array.from({ length: 6 }, async () => {
  for (;;) {
    const dependency = queue.shift()
    if (!dependency) break
    try { await collect(dependency) } catch (error) { failures.push(String(error)); console.error(String(error)) }
  }
}))
if (failures.length) {
  // Keep successful collection in an ignored cache for troubleshooting, never publish incomplete notices.
  mkdirSync(join(root, '.verification.local'), { recursive: true })
  writeFileSync(join(root, '.verification.local/license-partial.json'), JSON.stringify({ sources, packages, texts }))
  throw new Error(`Failed to collect ${failures.length} licenses. No published file was changed.`)
}
packages.sort((a, b) => Number(b.direct) - Number(a.direct) || compare(a.name, b.name) || compare(a.version, b.version))
const data = { sources, packages, texts: Object.fromEntries(Object.entries(texts).sort(([a], [b]) => compare(a, b))) }
validate(data)
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`)
console.log(`Generated ${packages.length} packages and ${Object.keys(texts).length} license/notice texts.`)
