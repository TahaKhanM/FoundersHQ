import * as React from "react"
import useSWR from "swr"

import { apiFetch, IS_MOCK } from "../client"
import type { SearchResultDTO } from "../types"

const USE_MOCK = IS_MOCK

const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

/**
 * Debounce a string value. The returned value lags the input by `delayMs`
 * milliseconds — handy for wiring an input box to a network-bound SWR key.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

/**
 * Global search across transactions, invoices, customers, commitments,
 * funding opportunities, and static pages. The query is debounced to 300 ms
 * so a busy typist doesn't trigger a request on every keystroke.
 *
 * `query` is the raw input value — pass it straight from React state.
 * `enabled` lets callers (e.g. the Cmd-K palette) suppress fetches while the
 * surface is closed.
 */
export function useGlobalSearch(query: string | null, enabled: boolean = true) {
  const debouncedQuery = useDebouncedValue(query ?? "", DEBOUNCE_MS)
  const trimmed = debouncedQuery.trim()
  const shouldFetch = Boolean(
    trimmed.length >= MIN_QUERY_LENGTH && enabled && !USE_MOCK,
  )
  return useSWR<SearchResultDTO[]>(
    shouldFetch ? ["global-search", trimmed] : null,
    async () => {
      const q = encodeURIComponent(trimmed)
      const raw = await apiFetch<SearchResultDTO[]>(`/search?q=${q}&limit=20`)
      return Array.isArray(raw) ? raw : []
    },
    { revalidateOnFocus: false, dedupingInterval: DEBOUNCE_MS },
  )
}
