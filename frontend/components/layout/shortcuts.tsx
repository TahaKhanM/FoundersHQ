"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CommandPalette } from "@/components/ui/command-palette"

/**
 * Targets for the `g {key}` chord. `g x` → /inbox is wired even though the
 * inbox page may not exist yet; Phase 1.F brings it in. The router will
 * surface a 404 in the meantime, which is the intended behaviour.
 */
const PAGE_MAP: Record<string, string> = {
  d: "/dashboard",
  r: "/runway",
  i: "/invoices",
  s: "/spending",
  f: "/funding",
  x: "/inbox",
  ",": "/settings",
}

const CHORD_TIMEOUT_MS = 1200

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (el.isContentEditable) return true
  return false
}

/**
 * Global keyboard chord handler.
 *
 * - `⌘K` / `Ctrl+K` toggles the command palette.
 * - `g` then a second key navigates per `PAGE_MAP`. The chord resets after
 *   {@link CHORD_TIMEOUT_MS}, or when the user presses Escape, or after a
 *   successful navigation.
 *
 * Mount this once, near the top of the component tree (we mount it inside
 * `<Providers>` in `components/providers.tsx`).
 */
export function Shortcuts() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const chordRef = React.useRef<string | null>(null)
  const chordTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearChord = React.useCallback(() => {
    chordRef.current = null
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current)
      chordTimerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd-K / Ctrl-K toggles even from inside inputs — this is a global
      // commando shortcut, not a navigation one.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
        clearChord()
        return
      }

      if (e.key === "Escape") {
        clearChord()
        // CommandPalette handles its own Escape; setting open=false is safe.
        setOpen(false)
        return
      }

      // Everything below is suppressed inside editable targets.
      if (isEditableTarget(e.target)) return

      // Don't trigger chords while modifier keys are held.
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (chordRef.current === "g") {
        const dest = PAGE_MAP[e.key]
        if (dest) {
          e.preventDefault()
          router.push(dest)
        }
        // Whether it matched or not, the chord ends here.
        clearChord()
        return
      }

      if (e.key === "g") {
        chordRef.current = "g"
        chordTimerRef.current = setTimeout(clearChord, CHORD_TIMEOUT_MS)
        return
      }
    }

    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      if (chordTimerRef.current) clearTimeout(chordTimerRef.current)
    }
  }, [clearChord, router])

  return <CommandPalette open={open} onOpenChange={setOpen} />
}
