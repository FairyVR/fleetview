import { saveSecret, readSecret, deleteSecret } from './secure-storage'
import { mergeSharedConfig } from '@shared/models'
import type { SharedLeConfig } from '@shared/models'

/**
 * Shared LE config library backed by a private GitHub repo — no server to run.
 * The whole library is one `library.json` in the repo; contributing does a
 * read-merge-write with GitHub's `sha` check catching concurrent writers.
 *
 * This is the GitHub API, not the Orion Drift API — it deliberately does NOT go
 * through the endpoint registry, and never touches game infrastructure.
 */

export const SHARE_REPO = 'FairyVR/fleetview-shared-library'
const FILE_PATH = 'library.json'
const GITHUB_API = 'https://api.github.com'
/** Reserved id in the secret vault (alongside API keys, same encryption). */
const TOKEN_ID = '__github_share_token__'

interface ShareResult<T = undefined> {
  ok: boolean
  error?: string
  data?: T
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
}

export function hasShareToken(): boolean {
  return readSecret(TOKEN_ID) !== null
}

export function clearShareToken(): void {
  deleteSecret(TOKEN_ID)
}

/** Validate the token against the shared repo before storing it. */
export async function setShareToken(token: string): Promise<ShareResult> {
  const t = token.trim()
  if (!t) return { ok: false, error: 'Token is empty.' }
  try {
    const res = await fetch(`${GITHUB_API}/repos/${SHARE_REPO}`, { headers: ghHeaders(t) })
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 404
            ? `Token works but cannot see ${SHARE_REPO} — ask to be added as a collaborator, and make sure the token has access to that repo.`
            : `GitHub rejected the token (HTTP ${res.status}).`
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  saveSecret(TOKEN_ID, t)
  return { ok: true }
}

async function fetchLibrary(
  token: string
): Promise<{ configs: SharedLeConfig[]; sha?: string } | { error: string }> {
  const res = await fetch(`${GITHUB_API}/repos/${SHARE_REPO}/contents/${FILE_PATH}`, {
    headers: ghHeaders(token)
  })
  if (res.status === 404) return { configs: [] } // repo exists but no library.json yet
  if (!res.ok) return { error: `GitHub read failed (HTTP ${res.status}).` }
  const body = (await res.json()) as { content?: string; sha?: string }
  try {
    const parsed = JSON.parse(Buffer.from(body.content ?? '', 'base64').toString('utf8')) as {
      configs?: SharedLeConfig[]
    }
    return { configs: Array.isArray(parsed.configs) ? parsed.configs : [], sha: body.sha }
  } catch {
    return { error: 'library.json in the shared repo is not valid JSON.' }
  }
}

export async function listShared(): Promise<ShareResult<SharedLeConfig[]>> {
  const token = readSecret(TOKEN_ID)
  if (!token) return { ok: false, error: 'No GitHub token configured.' }
  try {
    const lib = await fetchLibrary(token)
    if ('error' in lib) return { ok: false, error: lib.error }
    return { ok: true, data: lib.configs }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Merge one config into the shared library (replaces an entry with the same id). */
export async function contributeShared(config: SharedLeConfig): Promise<ShareResult> {
  const token = readSecret(TOKEN_ID)
  if (!token) return { ok: false, error: 'No GitHub token configured.' }

  // ponytail: one retry on sha conflict; real contention needs per-config files.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const lib = await fetchLibrary(token)
      if ('error' in lib) return { ok: false, error: lib.error }
      const configs = mergeSharedConfig(lib.configs, config)
      const content = Buffer.from(
        JSON.stringify({ version: 1, configs }, null, 2),
        'utf8'
      ).toString('base64')
      const res = await fetch(`${GITHUB_API}/repos/${SHARE_REPO}/contents/${FILE_PATH}`, {
        method: 'PUT',
        headers: ghHeaders(token),
        body: JSON.stringify({
          message: `share: ${config.name} (by ${config.sharedBy})`,
          content,
          ...(lib.sha ? { sha: lib.sha } : {})
        })
      })
      if (res.ok) return { ok: true }
      if (res.status === 409 && attempt === 0) continue // someone else wrote first — re-read and retry
      return { ok: false, error: `GitHub write failed (HTTP ${res.status}).` }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
  return { ok: false, error: 'Conflicting updates — try again.' }
}
