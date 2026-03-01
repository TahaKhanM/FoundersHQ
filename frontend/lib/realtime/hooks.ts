"use client"

/**
 * React hooks for the realtime SSE client.
 *
 * The page-level surface is intentionally tiny:
 *
 *   useRealtimeChannel("notification.created", (event) => mutate("/notifications"))
 *
 * which auto-subscribes on mount and tears down on unmount.
 *
 * `useRealtimeConnect()` is a side-effect hook for the app shell: it opens
 * the EventSource once and re-uses it across the lifetime of the tree.
 */
import { useEffect, useRef } from "react"

import { realtime, type RealtimeEvent } from "./index"

export function useRealtimeChannel<T = unknown>(
  type: string,
  handler: (event: RealtimeEvent<T>) => void,
): void {
  // Always call the latest handler closure without re-subscribing.
  const ref = useRef(handler)
  ref.current = handler

  useEffect(() => {
    const unsub = realtime.subscribe<T>(type, (e) => {
      ref.current(e)
    })
    return () => {
      unsub()
    }
  }, [type])
}

export function useRealtimeConnect(): void {
  useEffect(() => {
    void realtime.connect()
    return () => {
      realtime.disconnect()
    }
  }, [])
}
