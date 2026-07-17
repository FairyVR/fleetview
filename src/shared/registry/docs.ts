import type { EndpointDef } from './types'

/** Render the endpoint registry as Markdown. Pure — no filesystem access. */
export function renderMarkdown(defs: EndpointDef[], generatedAt = new Date()): string {
  const verified = defs.filter((d) => d.status === 'verified').length
  const lines: string[] = []

  lines.push('# FleetView — Discovered API Endpoint Registry')
  lines.push('')
  lines.push(`_Auto-generated from \`src/shared/registry/endpoints.ts\` on ${generatedAt.toISOString()}._`)
  lines.push('')
  lines.push(
    `**${defs.length}** endpoints registered · **${verified}** verified · **${defs.length - verified}** unverified.`
  )
  lines.push('')
  lines.push(
    '> Unverified endpoints are placeholders; their URL/method/shape have not been confirmed against a live server. See `docs/API-DISCOVERY.md`.'
  )
  lines.push('')

  lines.push('## Summary')
  lines.push('')
  lines.push('| Endpoint | Method | Path | Auth | Permission | Status |')
  lines.push('| --- | --- | --- | --- | --- | --- |')
  for (const d of defs) {
    lines.push(
      `| \`${d.id}\` | ${d.method} | \`${d.path}\` | ${d.requiresAuth ? 'yes' : 'no'} | ${d.permission} | ${d.status} |`
    )
  }
  lines.push('')

  const categories = [...new Set(defs.map((d) => d.category))]
  for (const cat of categories) {
    lines.push(`## ${cat}`)
    lines.push('')
    for (const d of defs.filter((x) => x.category === cat)) {
      lines.push(`### ${d.name} — \`${d.id}\``)
      lines.push('')
      lines.push(`${d.description}`)
      lines.push('')
      lines.push(`- **Method / Path:** \`${d.method} ${d.path}\``)
      lines.push(`- **Auth required:** ${d.requiresAuth ? 'yes' : 'no'}`)
      lines.push(`- **Permission scope:** ${d.permission}`)
      lines.push(`- **Status:** ${d.status}${d.lastTested ? ` (last tested ${d.lastTested})` : ''}`)
      if (d.fleetScoped) lines.push('- **Fleet-scoped**')
      if (d.stationScoped) lines.push('- **Station-scoped**')
      if (d.params?.length) {
        lines.push('- **Parameters:**')
        for (const p of d.params) {
          lines.push(
            `  - \`${p.name}\` (${p.in})${p.required ? ' — required' : ''}${p.example !== undefined ? ` — e.g. \`${p.example}\`` : ''}`
          )
        }
      }
      if (d.requestExample) {
        lines.push('- **Example request body:**')
        lines.push('')
        lines.push('  ```json')
        for (const l of JSON.stringify(d.requestExample, null, 2).split('\n')) lines.push(`  ${l}`)
        lines.push('  ```')
      }
      if (d.responseExample) {
        lines.push('- **Example response:**')
        lines.push('')
        lines.push('  ```json')
        for (const l of JSON.stringify(d.responseExample, null, 2).split('\n')) lines.push(`  ${l}`)
        lines.push('  ```')
      }
      if (d.statusCodes) {
        lines.push(
          `- **Status codes:** ${Object.entries(d.statusCodes).map(([c, m]) => `\`${c}\` ${m}`).join(', ')}`
        )
      }
      if (d.notes) lines.push(`- **Notes:** ${d.notes}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}
