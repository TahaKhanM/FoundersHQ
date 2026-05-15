import useSWR from "swr"

import { apiFetch, IS_MOCK } from "../client"
import type { SearchResultDTO } from "../types"

const USE_MOCK = IS_MOCK

export function useGlobalSearch(query: string | null, enabled: boolean = true) {
  const shouldFetch = Boolean(query && enabled && !USE_MOCK)
  return useSWR<SearchResultDTO[]>(
    shouldFetch ? ["global-search", query] : null,
    async () => {
      const q = encodeURIComponent(query as string)
      const raw = await apiFetch<SearchResultDTO[]>(`/search?q=${q}&limit=20`)
      return Array.isArray(raw) ? raw : []
    },
    { revalidateOnFocus: false, dedupingInterval: 300 },
  )
}
