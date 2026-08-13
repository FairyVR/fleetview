import { createConnection, type Socket } from 'node:net'
import type { PresenceActivity } from '@shared/ipc'

/**
 * Minimal Discord rich-presence client, spoken straight over Discord's local IPC socket
 * (named pipe on Windows, unix socket elsewhere). Framing is [int32LE op][int32LE len][json].
 * Ops used: 0 HANDSHAKE, 1 FRAME, 2 CLOSE, 3 PING, 4 PONG.
 *
 * No dependency: the whole protocol we need is a handshake plus SET_ACTIVITY.
 */

/**
 * FleetView's own Discord application ID — the name and icon everyone's presence shows.
 * An application ID is public (it ships in every RPC app's binary), so it is shared by all
 * users and no per-user setup exists. Empty = presence is a no-op; fill it in from
 * discord.com/developers/applications → your app → Application ID.
 */
const CLIENT_ID = '1537558824498630777'

let sock: Socket | null = null
let ready = false
let queued: PresenceActivity | null = null
let lastFailAt = 0
let nonce = 0
const startedAt = Date.now()

function ipcPath(i: number): string {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${i}`
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp'
  return `${base.replace(/\/+$/, '')}/discord-ipc-${i}`
}

function encode(op: number, data: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(data), 'utf8')
  const head = Buffer.alloc(8)
  head.writeInt32LE(op, 0)
  head.writeInt32LE(body.length, 4)
  return Buffer.concat([head, body])
}

function disconnect(): void {
  const s = sock
  sock = null
  ready = false
  s?.destroy()
}

function send(activity: PresenceActivity): void {
  if (!sock || !ready) return
  sock.write(
    encode(1, {
      cmd: 'SET_ACTIVITY',
      nonce: String(++nonce),
      args: {
        pid: process.pid,
        activity: {
          ...activity,
          timestamps: { start: startedAt },
          // 'icon' is the Rich Presence art asset key in the Discord app; the app icon alone
          // does not become the presence image.
          assets: { large_image: 'icon', large_text: 'FleetView' }
        }
      }
    })
  )
}

function attach(s: Socket): void {
  let buf = Buffer.alloc(0)
  s.on('data', (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk])
    while (buf.length >= 8) {
      const op = buf.readInt32LE(0)
      const len = buf.readInt32LE(4)
      if (buf.length < 8 + len) break
      const payload = buf.subarray(8, 8 + len).toString('utf8')
      buf = buf.subarray(8 + len)
      if (op === 3) {
        s.write(encode(4, JSON.parse(payload))) // PING -> PONG, or Discord drops us
      } else if (op === 2) {
        disconnect()
      } else if (op === 1 && !ready && payload.includes('"READY"')) {
        ready = true
        if (queued) send(queued)
      }
    }
  })
  s.on('error', () => disconnect())
  s.on('close', () => disconnect())
}

function connect(clientId: string): void {
  if (sock) return
  // ponytail: flat 60s backoff after a failed sweep so route changes don't re-probe 10 pipes
  // while Discord isn't running. Event-driven reconnect if that ever feels slow.
  if (Date.now() - lastFailAt < 60_000) return
  let i = 0
  const tryNext = (): void => {
    if (i > 9) {
      lastFailAt = Date.now()
      return
    }
    const s = createConnection(ipcPath(i++))
    s.once('error', () => {
      s.destroy()
      tryNext()
    })
    s.once('connect', () => {
      s.removeAllListeners('error')
      sock = s
      attach(s)
      s.write(encode(0, { v: 1, client_id: clientId }))
    })
  }
  tryNext()
}

/**
 * Set (or clear, with a null activity) the presence. Fire-and-forget: Discord not running,
 * a bad client id, or a dropped pipe must never surface as an app error.
 */
export function setPresence(activity: PresenceActivity | null): void {
  if (!CLIENT_ID || !activity) {
    queued = null
    disconnect()
    return
  }
  queued = activity
  if (!sock) connect(CLIENT_ID)
  else send(activity)
}
