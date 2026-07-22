import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResponse } from '@shared/models'
import { api } from '../lib/api'

export interface UseEndpointResult<T> {
  data: T | null
  response: ApiResponse<T> | null
  loading: boolean
  /** Run the request. Extra params/body merge over the defaults passed to the hook. */
  run: (override?: { params?: Record<string, string | number | boolean>; body?: unknown }) => Promise<ApiResponse<T> | null>
}

/**
 * Registry-driven data hook. Any endpoint id in the registry is callable through this —
 * new endpoints need zero new plumbing here.
 */
export function useEndpoint<T = unknown>(
  endpointId: string,
  opts: {
    params?: Record<string, string | number | boolean>
    body?: unknown
    /** Fetch automatically on mount / when `enabled` flips true. */
    auto?: boolean
    enabled?: boolean
  } = {}
): UseEndpointResult<T> {
  const { params, body, auto = false, enabled = true } = opts
  const [response, setResponse] = useState<ApiResponse<T> | null>(null)
  const [loading, setLoading] = useState(false)
  const paramsKey = JSON.stringify(params ?? {})
  const bodyKey = JSON.stringify(body ?? null)
  // Monotonic request id: only the newest run is allowed to write state, so overlapping
  // runs (Reload spam, a poll slower than its interval, a param switch mid-flight) can't
  // let an older response clobber a newer one.
  const seqRef = useRef(0)

  const run = useCallback<UseEndpointResult<T>['run']>(
    async (override) => {
      if (!enabled) return null
      const seq = ++seqRef.current
      setLoading(true)
      try {
        const res = await api.request<T>({
          endpointId,
          params: { ...params, ...override?.params },
          body: override?.body ?? body
        })
        if (seq === seqRef.current) setResponse(res)
        return res
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    },
    // params/body serialized via paramsKey/bodyKey to keep the callback stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endpointId, paramsKey, bodyKey, enabled]
  )

  useEffect(() => {
    if (auto && enabled) void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, enabled, endpointId, paramsKey, bodyKey])

  return { data: response?.data ?? null, response, loading, run }
}
