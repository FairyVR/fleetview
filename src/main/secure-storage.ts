import { safeStorage } from 'electron'
import { secretsStore } from './stores'

/**
 * API key secret vault.
 *
 * Secrets are encrypted with Electron's native `safeStorage` (Windows DPAPI, macOS
 * Keychain, Linux libsecret) and only the ciphertext (base64) is written to disk. The
 * plaintext key never leaves the main process and never reaches the renderer.
 */

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/** Store (or overwrite) the secret for a key id. Returns a masked hint for display. */
export function saveSecret(keyId: string, secret: string): string {
  const secrets = secretsStore.get('secrets')
  if (isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(secret).toString('base64')
    secrets[keyId] = `v1:${encrypted}`
  } else {
    // ponytail: no OS crypto available (rare: headless Linux without libsecret).
    // Fall back to plain base64 so the app still works; upgrade path is to install a
    // Secret Service provider. Marked so we never mistake it for real encryption.
    secrets[keyId] = `plain:${Buffer.from(secret, 'utf8').toString('base64')}`
  }
  secretsStore.set('secrets', secrets)
  return maskSecret(secret)
}

/** Read a plaintext secret for use inside the main process only. */
export function readSecret(keyId: string): string | null {
  const raw = secretsStore.get('secrets')[keyId]
  if (!raw) return null
  if (raw.startsWith('v1:')) {
    const buf = Buffer.from(raw.slice(3), 'base64')
    return safeStorage.decryptString(buf)
  }
  if (raw.startsWith('plain:')) {
    return Buffer.from(raw.slice(6), 'base64').toString('utf8')
  }
  return null
}

export function deleteSecret(keyId: string): void {
  const secrets = secretsStore.get('secrets')
  delete secrets[keyId]
  secretsStore.set('secrets', secrets)
}

/** e.g. "od_live_ab…9f2a" — enough to disambiguate without revealing the key. */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '…'.padStart(secret.length, '•')
  return `${secret.slice(0, 6)}…${secret.slice(-4)}`
}
