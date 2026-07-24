import { app, BrowserWindow, Menu, shell } from 'electron'
import { join } from 'node:path'
import { appendFileSync } from 'node:fs'
import { registerIpc } from './ipc'
import { settingsStore } from './stores'

/** The only origin the window is ever allowed to load (dev server in dev, packaged files in prod). */
const APP_ORIGIN = process.env.ELECTRON_RENDERER_URL ?? 'file://'

/** Surface renderer crashes/load failures to the main log (and an optional diag file). */
function attachDiagnostics(win: BrowserWindow): void {
  const diag = process.env.FLEETVIEW_DIAG
  const write = (line: string) => {
    console.error(`[renderer] ${line}`)
    if (diag) {
      try {
        appendFileSync(diag, line + '\n')
      } catch {
        /* ignore */
      }
    }
  }
  const wc = win.webContents
  wc.on('did-fail-load', (_e, code, desc, url) => write(`did-fail-load ${code} ${desc} ${url}`))
  wc.on('render-process-gone', (_e, details) => write(`render-process-gone ${details.reason}`))
  wc.on('console-message', (_e, level, message) => {
    if (level >= 2) write(`console[${level}] ${message}`)
  })
  if (diag) {
    wc.on('did-finish-load', () => {
      write('did-finish-load')
      setTimeout(() => app.quit(), 1500)
    })
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // No File/Edit/View menu bar. This also drops its accelerators, so the two
  // worth keeping (devtools, reload) are re-bound below via before-input-event.
  Menu.setApplicationMenu(null)
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0b0f17',
    title: 'FleetView',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // preload needs Node to reach ipcRenderer; renderer stays isolated
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  attachDiagnostics(mainWindow)

  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F12' || (input.control && input.shift && input.key.toUpperCase() === 'I')) {
      // DevTools drives the full window.api surface; keep it out of packaged builds unless
      // the operator explicitly opts in via the Developer Mode setting.
      if (process.env.ELECTRON_RENDERER_URL || settingsStore.get('developerMode')) {
        mainWindow?.webContents.toggleDevTools()
      }
    } else if (input.key === 'F5' || (input.control && input.key.toUpperCase() === 'R')) {
      mainWindow?.webContents.reload()
    }
  })

  // Never navigate the app window itself to a remote origin — that would hand the preload's
  // window.api (keys, requests) to attacker-controlled page code and escape the local CSP.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(APP_ORIGIN)) e.preventDefault()
  })

  // Open external links in the OS browser, never in-app — and only real web links.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc(() => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
