import { useEffect, useState } from 'react'
import { XCircle, AlertTriangle, Eye } from 'lucide-react'
import { Badge, Button } from './ui'
import { FLAG_TEXTURE_SHARE, aspectVerdict, resolutionNote } from '../../lib/boardPreview'
import { hasCalibration, type BoardPreview } from '../../lib/boardCalibration'

/**
 * One surface of a board assembly. The face shows the top of the texture, a pennant shows the
 * flag strip from the bottom — rotated a quarter turn, which is how the game flies it.
 */
function Surface({
  url,
  name,
  surface,
  onLoad,
  onError
}: {
  url: string
  name: string
  surface: BoardPreview
  onLoad?: (w: number, h: number) => void
  onError?: () => void
}) {
  const { box, crop, kind, aspect } = surface
  const cropped = (
    <div className="absolute inset-0 overflow-hidden">
      <img
        src={url}
        alt={name}
        style={{
          position: 'absolute',
          left: 0,
          top: `${(-crop.y / crop.h) * 100}%`,
          width: '100%',
          height: `${100 / crop.h}%`,
          objectFit: 'fill'
        }}
        onLoad={(e) => onLoad?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
        onError={onError}
      />
    </div>
  )

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`
      }}
    >
      {kind === 'flag' ? (
        // Clockwise, confirmed against the reference artwork: the strip's left end flies at the
        // top. Rotating swaps the extents, so undo that with the box's own aspect to refill it.
        <div
          className="absolute inset-0"
          style={{ transform: `rotate(90deg) scale(${1 / aspect}, ${aspect})` }}
        >
          {cropped}
        </div>
      ) : (
        cropped
      )}
    </div>
  )
}

/**
 * Shows the texture where it actually lands in-game: the calibration screenshot is layered on
 * top with the board punched out, and the texture sits behind it in each of the board's
 * surfaces. With no calibration shot for this board it degrades to a plain thumbnail.
 */
export function BoardTile({
  url,
  name,
  previews,
  shown,
  busy,
  onShow
}: {
  url: string
  name: string
  previews: BoardPreview[]
  shown: boolean
  busy: boolean
  onShow: () => void
}) {
  const [view, setView] = useState(0)
  const [broken, setBroken] = useState(false)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  // A slot can appear in several districts; show one shot at a time, with all its surfaces.
  const shots = [...new Set(previews.map((p) => p.shot))]
  const shot = shots[Math.min(view, shots.length - 1)]
  const surfaces = previews.filter((p) => p.shot === shot)
  const preview = surfaces.find((s) => s.kind === 'face') ?? surfaces[0]

  // A new URL is innocent until its own load fails.
  useEffect(() => {
    setBroken(false)
    setSize(null)
  }, [url])

  // Only the face region of the texture lands on the board — the flag strip goes to the pennants.
  const verdict =
    preview?.kind === 'face' && size
      ? aspectVerdict(size.w, size.h * (1 - FLAG_TEXTURE_SHARE), preview.aspect)
      : 'unknown'
  const oversized = size ? resolutionNote(size.w, size.h) : null

  const texture = url ? (
    <img
      src={url}
      alt={name}
      className="w-full h-full"
      style={{ objectFit: 'cover' }}
      onError={() => setBroken(true)}
      onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
    />
  ) : null

  return (
    <div className="grid gap-2">
      {preview ? (
        <div className="relative rounded-lg overflow-hidden bg-[var(--bg)] border border-[var(--border-soft)]">
          {!!url &&
            surfaces.map((s, i) => (
              <Surface
                key={`${s.box.x}-${s.box.y}`}
                url={url}
                name={name}
                surface={s}
                // One surface reports for the whole tile — they all load the same image.
                onLoad={i === 0 ? (w, h) => setSize({ w, h }) : undefined}
                onError={i === 0 ? () => setBroken(true) : undefined}
              />
            ))}
          <img src={preview.cutoutUrl} alt="" className="relative block w-full" />
        </div>
      ) : (
        <div className="aspect-video rounded-lg overflow-hidden bg-[var(--bg)] border border-[var(--border-soft)] grid place-items-center">
          {texture ?? <span className="text-[12px] text-[var(--text-faint)]">no image</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 min-h-[20px]">
        {shots.length > 1 &&
          shots.map((s, i) => (
            <button
              key={s}
              className="chip"
              onClick={() => setView(i)}
              style={s === shot ? { color: 'var(--accent)' } : undefined}
            >
              {s}
            </button>
          ))}
        {!!url && broken && (
          <Badge tone="bad">
            <XCircle size={11} /> image failed to load
          </Badge>
        )}
        {!broken && verdict === 'stretched' && (
          <Badge tone="warn">
            <AlertTriangle size={11} /> will look stretched
          </Badge>
        )}
        {!broken && oversized && <Badge tone="warn">{oversized}</Badge>}
        {!shown && hasCalibration() && (
          // Opt-in: building it means segmenting every calibration screenshot, which takes a
          // moment, and most visits to this page do not need it.
          <Button onClick={onShow} disabled={busy}>
            <Eye size={13} /> {busy ? 'Loading…' : 'Load preview (beta)'}
          </Button>
        )}
        {shown && !preview && (
          <span className="text-[11px] text-[var(--text-faint)]">not found in the calibration shots</span>
        )}
      </div>
    </div>
  )
}
