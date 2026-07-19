/**
 * Normalize multi-line LE/config snippet text: every content line ends with a comma
 * except the last, so pasted blocks concatenate cleanly. Blank lines and lone
 * braces/brackets are left alone. Pure — unit tested.
 */
export function normalizeLeCode(code: string): string {
  const lines = code.split(/\r?\n/)
  const isContent = (l: string): boolean => {
    const t = l.trim()
    return t !== '' && !/^[{}[\],]+$/.test(t)
  }
  let last = -1
  for (let i = 0; i < lines.length; i++) if (isContent(lines[i])) last = i
  return lines
    .map((line, i) => {
      const t = line.trimEnd()
      if (!isContent(t)) return t
      const stripped = t.replace(/,+\s*$/, '')
      return i === last ? stripped : `${stripped},`
    })
    .join('\n')
}
