/**
 * Generates docs/ENDPOINTS.md from the endpoint registry.
 * Run with: npm run gen:docs
 *
 * The registry is the single source of truth; this script just renders it (via the pure
 * renderMarkdown in src/shared/registry/docs.ts) and writes the file.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { endpoints } from '../src/shared/registry/endpoints'
import { renderMarkdown } from '../src/shared/registry/docs'

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'ENDPOINTS.md')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, renderMarkdown(endpoints), 'utf8')
console.log(`Wrote ${out} (${endpoints.length} endpoints)`)
