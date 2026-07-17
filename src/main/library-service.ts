import { randomUUID } from 'node:crypto'
import type { LeConfig, Preset, LibraryBundle } from '@shared/models'
import { libraryStore } from './stores'

// ── LE configs ───────────────────────────────────────────────────────
export function listLeConfigs(): LeConfig[] {
  return libraryStore.get('leConfigs')
}

export function saveLeConfig(input: Partial<LeConfig> & { name: string; code: string }): LeConfig {
  const configs = libraryStore.get('leConfigs')
  const now = Date.now()
  const existing = input.id ? configs.find((c) => c.id === input.id) : undefined

  if (existing) {
    // Snapshot the prior code into history if the code changed (version configs).
    if (existing.code !== input.code) {
      existing.history.push({ createdAt: existing.modifiedAt, code: existing.code })
    }
    Object.assign(existing, {
      name: input.name,
      description: input.description ?? existing.description,
      author: input.author ?? existing.author,
      category: input.category ?? existing.category,
      code: input.code,
      tags: input.tags ?? existing.tags,
      notes: input.notes ?? existing.notes,
      favorite: input.favorite ?? existing.favorite,
      modifiedAt: now
    })
    libraryStore.set('leConfigs', configs)
    return existing
  }

  const config: LeConfig = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    author: input.author,
    category: input.category,
    code: input.code,
    tags: input.tags ?? [],
    notes: input.notes,
    favorite: input.favorite ?? false,
    createdAt: now,
    modifiedAt: now,
    history: []
  }
  configs.push(config)
  libraryStore.set('leConfigs', configs)
  return config
}

export function deleteLeConfig(id: string): void {
  libraryStore.set('leConfigs', libraryStore.get('leConfigs').filter((c) => c.id !== id))
}

export function duplicateLeConfig(id: string): LeConfig | null {
  const original = libraryStore.get('leConfigs').find((c) => c.id === id)
  if (!original) return null
  return saveLeConfig({ ...original, id: undefined, name: `${original.name} (copy)` })
}

// ── Presets ──────────────────────────────────────────────────────────
export function listPresets(): Preset[] {
  return libraryStore.get('presets')
}

export function savePreset(input: Partial<Preset> & { kind: Preset['kind']; name: string; data: unknown }): Preset {
  const presets = libraryStore.get('presets')
  const now = Date.now()
  const existing = input.id ? presets.find((p) => p.id === input.id) : undefined
  if (existing) {
    Object.assign(existing, {
      name: input.name,
      description: input.description ?? existing.description,
      tags: input.tags ?? existing.tags,
      data: input.data,
      modifiedAt: now
    })
    libraryStore.set('presets', presets)
    return existing
  }
  const preset: Preset = {
    id: randomUUID(),
    kind: input.kind,
    name: input.name,
    description: input.description,
    tags: input.tags ?? [],
    data: input.data,
    createdAt: now,
    modifiedAt: now
  }
  presets.push(preset)
  libraryStore.set('presets', presets)
  return preset
}

export function deletePreset(id: string): void {
  libraryStore.set('presets', libraryStore.get('presets').filter((p) => p.id !== id))
}

// ── Bundle import/export ─────────────────────────────────────────────
export function exportBundle(): LibraryBundle {
  return {
    version: 1,
    exportedAt: Date.now(),
    leConfigs: libraryStore.get('leConfigs'),
    presets: libraryStore.get('presets')
  }
}

/** Merge an imported bundle. Items with new ids are appended; matching ids are replaced. */
export function importBundle(bundle: LibraryBundle): { leConfigs: number; presets: number } {
  const configs = libraryStore.get('leConfigs')
  const presets = libraryStore.get('presets')
  const cById = new Map(configs.map((c) => [c.id, c]))
  const pById = new Map(presets.map((p) => [p.id, p]))
  for (const c of bundle.leConfigs ?? []) cById.set(c.id, c)
  for (const p of bundle.presets ?? []) pById.set(p.id, p)
  libraryStore.set('leConfigs', [...cById.values()])
  libraryStore.set('presets', [...pById.values()])
  return { leConfigs: bundle.leConfigs?.length ?? 0, presets: bundle.presets?.length ?? 0 }
}
