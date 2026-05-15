"use client"

import { SWRConfig } from "swr"
import { Shortcuts } from "@/components/layout/shortcuts"
import { ThemeProvider } from "@/components/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          dedupingInterval: 5000,
        }}
      >
        {children}
        <Shortcuts />
      </SWRConfig>
    </ThemeProvider>
  )
}
