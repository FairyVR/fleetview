/** Validate JSON text; returns an error message or null. Pure — safe to unit test. */
export function validateJson(text: string): string | null {
  if (!text.trim()) return null
  try {
    JSON.parse(text)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid JSON'
  }
}
