import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../src/shared/registry/docs'
import { endpoints } from '../src/shared/registry/endpoints'

describe('renderMarkdown', () => {
  const md = renderMarkdown(endpoints, new Date('2026-01-01T00:00:00Z'))

  it('includes a summary table row for each endpoint', () => {
    for (const e of endpoints) expect(md).toContain(`\`${e.id}\``)
  })
  it('reports the endpoint count', () => {
    expect(md).toContain(`**${endpoints.length}** endpoints registered`)
  })
  it('renders a category heading', () => {
    expect(md).toContain('## fleet')
  })
})
