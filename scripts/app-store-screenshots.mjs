// App Store screenshots at Apple's exact iPhone pixel sizes, captured from the design preview.
// 393x852 @3x = 1179x2556 (6.1"), 402x874 @3x = 1206x2622 (6.3").
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'store-assets/ios')
const previewUrl = 'http://127.0.0.1:5241'
const debugPort = 9341
const sleep = ms => new Promise(r => setTimeout(r, ms))

const devices = [
  { name: '1179x2556', width: 393, height: 852 },
  { name: '1206x2622', width: 402, height: 874 },
]
const screens = [
  { name: '01-feed', route: '/feed' },
  { name: '02-map', route: '/map' },
  { name: '03-groups', route: '/groups' },
  { name: '04-chats', route: '/chats' },
  { name: '05-chat', route: '/chats/chat-0' },
  { name: '06-profile', route: '/profile' },
  { name: '07-login', route: '/login' },
]
const chromePaths = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

async function waitFor(url, attempts = 120) {
  for (let i = 0; i < attempts; i++) {
    try { const res = await fetch(url); if (res.ok) return res } catch { /* not up yet */ }
    await sleep(500)
  }
  throw Error(`${url} 응답 없음`)
}

async function connect() {
  const targets = await (await waitFor(`http://127.0.0.1:${debugPort}/json`)).json()
  const target = targets.find(t => t.type === 'page')
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise(r => ws.addEventListener('open', r, { once: true }))
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (!m.id) return
    const p = pending.get(m.id); pending.delete(m.id)
    m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result)
  })
  return {
    close: () => ws.close(),
    send: (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) }),
  }
}

const preview = spawn(process.execPath, [path.join(root, 'scripts/design-preview.mjs')], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })
const chromePath = chromePaths.find(p => fs.existsSync(p))
if (!chromePath) throw Error('Chrome/Edge를 찾지 못했습니다. CHROME_PATH 환경변수를 지정해 주세요.')
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spotit-store-chrome-'))
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' })

try {
  await waitFor(`${previewUrl}/feed`)
  const c = await connect()
  await c.send('Page.enable')
  for (const device of devices) {
    const dir = path.join(outDir, device.name)
    fs.mkdirSync(dir, { recursive: true })
    await c.send('Emulation.setDeviceMetricsOverride', { width: device.width, height: device.height, deviceScaleFactor: 3, mobile: true })
    await c.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    for (const screen of screens) {
      await c.send('Page.navigate', { url: previewUrl + screen.route })
      await sleep(4000)
      const shot = await c.send('Page.captureScreenshot', { format: 'png' })
      const file = path.join(dir, `${screen.name}.png`)
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'))
      console.log(path.relative(root, file))
    }
  }
  c.close()
} finally {
  chrome.kill()
  preview.kill()
  await sleep(1500)
  try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch { /* Chrome may still hold files; OS temp cleans up */ }
}
