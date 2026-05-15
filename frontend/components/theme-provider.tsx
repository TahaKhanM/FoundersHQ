'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

/**
 * FoundersHQ defaults to dark mode. `next-themes` toggles a class on <html>;
 * our `globals.css` defines the dark palette under `:root` and re-exposes it
 * under `.dark`, with `.light` providing the opt-in override.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
