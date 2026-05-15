"use client"

import { SWRConfig } from "swr"
import { Shortcuts } from "@/components/layout/shortcuts"
import { ThemeProvider } from "@/components/theme-provider"
import { BaseCurrencyProvider } from "@/lib/base-currency"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          dedupingInterval: 5000,
        }}
      >
        {/*
          BaseCurrencyProvider must be inside SWRConfig so its `useOrg()`
          call shares the deduped cache with any other component that
          queries `/org`. Phase 2.C wiring.
        */}
        <BaseCurrencyProvider>
          {children}
          <Shortcuts />
        </BaseCurrencyProvider>
      </SWRConfig>
    </ThemeProvider>
  )
}
