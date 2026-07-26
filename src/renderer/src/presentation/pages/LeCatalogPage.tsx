import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, RefreshCw, Download, Check, ArrowUpCircle, Store, WifiOff } from 'lucide-react'
import type { CatalogBuild, CatalogState } from '@shared/catalog'
import type { LeConfig } from '@shared/models'
import { api } from '../../lib/api'
import { ts } from '../../lib/format'
import { installedFor, installPayload, CATALOG_FOLDER } from '../../lib/catalog'
import { PageHeader, Card, Button, Badge, EmptyState, Spinner, JsonBlock } from '../components/ui'
import { Modal } from '../components/Modal'

export default function LeCatalogPage() {
  const [state, setState] = useState<CatalogState | null>(null)
  const [configs, setConfigs] = useState<LeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [preview, setPreview] = useState<CatalogBuild | null>(null)
  const [updating, setUpdating] = useState<{ build: CatalogBuild; installed: LeConfig } | null>(null)

  async function load(force: boolean) {
    setLoading(true)
    const [next, mine] = await Promise.all([
      force ? api.refreshCatalog() : api.getCatalog(),
      api.listLeConfigs()
    ])
    setState(next)
    setConfigs(mine)
    setLoading(false)
  }
  useEffect(() => {
    void load(false)
  }, [])

  const builds = state?.catalog?.builds ?? []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return builds
    return builds.filter((b) =>
      [b.name, b.author, b.description, b.category, ...(b.tags ?? [])]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q))
    )
  }, [builds, query])

  async function install(build: CatalogBuild) {
    setBusyId(build.id)
    await api.saveLeConfig(installPayload(build))
    setConfigs(await api.listLeConfigs())
    setBusyId(null)
  }

  /** Replace the installed copy's code. Its prior code is snapshotted into history by the store. */
  async function applyUpdate(build: CatalogBuild, installed: LeConfig) {
    setBusyId(build.id)
    setUpdating(null)
    await api.saveLeConfig({
      ...installed,
      name: installed.name,
      code: build.code,
      description: build.description ?? installed.description,
      author: build.author ?? installed.author,
      source: { catalogId: build.id, version: build.version, author: build.author }
    })
    setConfigs(await api.listLeConfigs())
    setBusyId(null)
  }

  return (
    <div>
      <PageHeader
        title="Community Catalog"
        subtitle={`Level Editor builds shared by the community and published by the FleetView maintainer. Adding one copies it into your local library under "${CATALOG_FOLDER}" — your copy is yours to edit.`}
        actions={
          <Button onClick={() => void load(true)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        }
      />

      {state?.error && (
        <Card className="mb-4 border-[color-mix(in_srgb,var(--warn)_35%,transparent)]">
          <div className="flex items-start gap-2.5 text-[13px]">
            <WifiOff size={15} className="text-[var(--warn)] mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">{state.error}</div>
              <div className="text-[12px] text-[var(--text-dim)] mt-0.5">
                {state.catalog
                  ? `Showing the copy cached ${ts(state.fetchedAt, false)}.`
                  : 'No cached catalog available yet — check your connection and refresh.'}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="relative mb-4 max-w-md">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
        />
        <input
          className="input pl-9"
          placeholder="Search builds…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && !state && <Spinner label="Loading catalog…" />}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={<Store size={22} />}
          title={builds.length === 0 ? 'No builds published yet' : 'No builds match that search'}
          hint={
            builds.length === 0
              ? 'Builds appear here once the maintainer publishes them. Check back later.'
              : undefined
          }
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((build) => {
          const installed = installedFor(build, configs)
          const outdated = installed?.source && build.version > installed.source.version
          return (
            <Card key={build.id} className="flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{build.name}</div>
                  <div className="text-[12px] text-[var(--text-dim)]">
                    {build.author ? `by ${build.author}` : 'unknown author'} · v{build.version}
                  </div>
                </div>
                {outdated ? (
                  <Badge tone="warn">update</Badge>
                ) : installed ? (
                  <Badge tone="good">installed</Badge>
                ) : null}
              </div>

              {build.description && (
                <p className="text-[13px] text-[var(--text-dim)] line-clamp-3">
                  {build.description}
                </p>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                {build.category && <Badge tone="accent">{build.category}</Badge>}
                {build.tags?.slice(0, 4).map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-auto pt-1">
                {outdated && installed ? (
                  <Button
                    variant="primary"
                    disabled={busyId === build.id}
                    onClick={() => setUpdating({ build, installed })}
                  >
                    <ArrowUpCircle size={14} /> Update to v{build.version}
                  </Button>
                ) : installed ? (
                  <Button disabled>
                    <Check size={14} /> In your library
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    disabled={busyId === build.id}
                    onClick={() => void install(build)}
                  >
                    <Download size={14} /> Add to library
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setPreview(build)}>
                  View code
                </Button>
                {build.updatedAt && (
                  <span className="ml-auto text-[11px] text-[var(--text-faint)]">
                    {ts(build.updatedAt, false)}
                  </span>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Modal
        open={!!preview}
        title={preview?.name ?? ''}
        onClose={() => setPreview(null)}
        wide
        footer={
          <Button onClick={() => setPreview(null)}>Close</Button>
        }
      >
        <JsonBlock value={preview?.code ?? ''} className="max-h-[60vh]" />
      </Modal>

      <Modal
        open={!!updating}
        title={`Update "${updating?.installed.name ?? ''}"?`}
        onClose={() => setUpdating(null)}
        wide
        footer={
          <>
            <Button onClick={() => setUpdating(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => updating && void applyUpdate(updating.build, updating.installed)}
            >
              <ArrowUpCircle size={14} /> Update
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <p className="text-[13px] text-[var(--text-dim)]">
            This replaces the code in your copy with v{updating?.build.version}. Your current code
            is saved to that config&apos;s version history first, so you can restore it from the LE
            library — but any edits you made will not be merged.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">Your copy</div>
              <JsonBlock value={updating?.installed.code ?? ''} className="max-h-64" />
            </div>
            <div>
              <div className="label">v{updating?.build.version} from the catalog</div>
              <JsonBlock value={updating?.build.code ?? ''} className="max-h-64" />
            </div>
          </div>
          <Link to="/le-library" className="text-[12px] text-[var(--accent)] hover:underline">
            Open the LE library →
          </Link>
        </div>
      </Modal>
    </div>
  )
}
