import { app } from 'electron'
// electron-updater is CommonJS; the ESM main bundle can only take its default export.
import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater

/**
 * Auto-update against GitHub Releases on FairyVR/fleetview (feed configured in
 * electron-builder.yml). Checks on launch, downloads in the background, installs on quit.
 *
 * Dev runs have no update feed, and a failed check (offline, rate-limited, no release yet)
 * must never block startup — the app works fine on whatever version is installed.
 */
export function initUpdater(): void {
  if (!app.isPackaged) return
  autoUpdater.on('error', (err) => console.error('[updater]', err.message))
  autoUpdater.on('update-downloaded', (info) =>
    console.log(`[updater] ${info.version} downloaded; installs on quit`)
  )
  void autoUpdater.checkForUpdatesAndNotify().catch(() => {
    /* offline or no release yet */
  })
}
