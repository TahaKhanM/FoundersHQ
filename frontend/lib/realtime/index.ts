"use client"

import { API_BASE_URL } from "../api/client"

export type RealtimeEvent<T = unknown> = {
  seq: string
  type: string
  payload: T
  org_id?: string
  created_at?: string
}

type Handler<T = unknown> = (e: RealtimeEvent<T>) => void

/**
 * Tiny SSE client with:
 *
 * - `subscribe(type, handler)` — listen for one event type.
 * - `connect()` — open `/events`. If we already saw events, replay from
 *   `lastSeq` via `/events/replay?since=<seq>` before re-attaching.
 * - `disconnect()` — close & cancel pending reconnects.
 *
 * Phase-2 wires this into pages. Phase-0 just lands the pipe so other
 * surfaces can reference it.
 */
class RealtimeClient {
  private es: EventSource | null = null
  private handlers = new Map<string, Set<Handler>>()
  private lastSeq: string | null = null
  private reconnectTimer: number | null = null
  private token: string | null = null

  setToken(token: string | null): void {
    this.token = token
  }

  subscribe<T = unknown>(type: string, handler: Handler<T>): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    const generic = handler as Handler
    set.add(generic)
    return () => {
      set?.delete(generic)
    }
  }

  async connect(): Promise<void> {
    if (this.es) return
    if (this.lastSeq) {
      await this.replaySince(this.lastSeq)
    }
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return
    }
    const url = `${API_BASE_URL}/events`
    this.es = new EventSource(url, { withCredentials: true })
    this.es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as RealtimeEvent
        if (event.seq) this.lastSeq = event.seq
        this.dispatch(event)
      } catch {
        // Ignore malformed payloads — the server is the source of truth.
      }
    }
    this.es.onerror = () => {
      this.es?.close()
      this.es = null
      this.scheduleReconnect()
    }
  }

  disconnect(): void {
    this.es?.close()
    this.es = null
    if (this.reconnectTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private dispatch(event: RealtimeEvent): void {
    const handlers = this.handlers.get(event.type)
    handlers?.forEach((h) => h(event))
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return
    if (typeof window === "undefined") return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, 2000)
  }

  private async replaySince(seq: string): Promise<void> {
    try {
      const headers: HeadersInit = this.token
        ? { Authorization: `Bearer ${this.token}` }
        : {}
      const r = await fetch(
        `${API_BASE_URL}/events/replay?since=${encodeURIComponent(seq)}`,
        { headers },
      )
      if (!r.ok) return
      const rows = (await r.json()) as RealtimeEvent[]
      // Phase 2.E contract: replayed events route through the same
      // `dispatch` path as live messages, so domain hooks
      // (useSpendingRealtime / useInvoicesRealtime / ...) invalidate
      // their SWR keys after a reconnect just as they would for a fresh
      // event. Adding new subscribers requires no change here.
      for (const row of rows) {
        if (row.seq) this.lastSeq = row.seq
        this.dispatch(row)
      }
    } catch {
      // Replay is best-effort — the live stream will re-deliver any
      // events that arrive after the next successful connect.
    }
  }
}

export const realtime = new RealtimeClient()
