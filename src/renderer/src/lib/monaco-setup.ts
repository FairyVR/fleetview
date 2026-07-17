import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

/**
 * Bundle Monaco locally instead of loading from CDN — required under our CSP
 * (script-src 'self'). Only the editor + JSON language workers are wired up (all we use).
 */
;(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker(_id, label) {
    if (label === 'json') return new jsonWorker()
    return new editorWorker()
  }
}

loader.config({ monaco })

export { monaco }
