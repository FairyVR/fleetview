import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { appendFileSync } from 'node:fs'
import { registerIpc } from './ipc'

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

  // Open external links in the OS browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
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
