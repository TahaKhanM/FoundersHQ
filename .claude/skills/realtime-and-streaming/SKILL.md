---
name: realtime-and-streaming
description: Use when building any feature involving SSE, Redis pub/sub, durable workflows, or streamed LLM responses. Encodes the patterns that keep real-time UX consistent and recoverable.
---

# Real-time and streaming

The product feels alive when sync runs, transactions land, forecasts recompute, and notifications surface — all without a page refresh. This skill is how we wire that without breaking durability or order.

## The four channels

| Channel | Purpose | Tech |
|---|---|---|
| **SSE** | Server → client live updates per org | FastAPI `EventSourceResponse` + Redis Pub/Sub |
| **Outbox** | Durable record of events for catch-up | `events_outbox` table |
| **Workflow** | Long-running, retry-able server jobs | Celery (current) + Vercel Workflow DevKit (phase 5+) for user-facing durable flows |
| **LLM stream** | Token-by-token output for Copilot/Decision narration | OpenAI / Anthropic streaming + chunked SSE forwarding |

Pick the right one. Don't reach for WebSockets when one-way SSE will do; don't reach for Celery when a workflow with checkpoints is appropriate.

## SSE: shape and rules

Endpoint: `GET /events?since=<event_id>` (auth required, scoped to `CurrentOrg`).

Event shape:

```
event: notification.created
id: 01HRZ...
data: {"id": "...", "type": "...", "title": "...", "severity": "warn", "evidence_ids": [...]}
```

Rules:

1. **`id` is monotonic per org.** Use ULID. Client sends `Last-Event-ID` (or `?since=`) on reconnect; server replays from the outbox.
2. **Heartbeat every 25s.** A comment line `:\n\n` to keep proxies open.
3. **Events are advisory.** The client uses them to invalidate SWR caches, not as the source of truth. After an event arrives, the hook re-fetches.
4. **Per-org channel.** Redis channel is `events:<org_id>`. Cross-tenant leakage at this layer would be catastrophic; assert `org_id` matches `CurrentOrg.id` before subscribing.
5. **One connection per browser tab.** Frontend uses a shared `EventSource` from a context provider, not one per hook.

## Publishing

```python
# app/services/events/publish.py
async def publish(session: AsyncSession, org_id: str, event_type: str, payload: dict) -> str:
    """Write outbox row + publish to Redis. Returns event id."""
    event_id = make_ulid()
    session.add(EventOutbox(
        id=event_id, org_id=org_id, type=event_type, payload=payload,
    ))
    await session.flush()  # commit happens via DbSession dependency

    # Redis publish AFTER db flush so the outbox always wins on conflict
    await redis.publish(f"events:{org_id}", json.dumps({"id": event_id, "type": event_type, "data": payload}))
    return event_id
```

Mutating routes call `publish(...)` after they've called `record_audit(...)`. Both run before `session.commit()` so they roll back together on error.

## Frontend SSE client

```ts
// frontend/lib/realtime.ts — phase 0
class RealtimeClient {
  private es: EventSource | null = null;
  private lastEventId: string | null = null;
  private retryDelay = 1000;

  connect() {
    const url = `/api/events?since=${this.lastEventId ?? ''}`;
    this.es = new EventSource(url, { withCredentials: true });
    this.es.onmessage = this.onMessage;
    this.es.onerror = this.onError;
    // ... typed event listeners forward to subscribers
  }

  private onError = () => {
    this.es?.close();
    setTimeout(() => this.connect(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 30000);
  };
  ...
}
```

Subscribers are typed:

```ts
useRealtimeEvent('transaction.added', (e) => mutate('/spending/metrics'));
useRealtimeEvent('forecast.recomputed', (e) => mutate('/runway/forecast'));
```

## Event types catalogue (grow as features ship)

| Event | Producer | Consumer effect |
|---|---|---|
| `transaction.added` | ingest, Plaid sync | Invalidate spending caches; toast count |
| `transaction.updated` | category override | Invalidate row + metrics |
| `invoice.added` | ingest, QBO sync | Invalidate invoice caches |
| `invoice.paid` | touch, QBO | Invalidate; cheer toast |
| `forecast.recomputed` | scheduled, on data change | Invalidate runway |
| `notification.created` | notification generators | Append to inbox; bell pulse |
| `insight.created` | insight generators (phase 2.F) | Append to inbox |
| `investigation.step` | causal analyst (phase 6) | Render step in timeline |
| `investigation.complete` | causal analyst | Replace timeline with final narrative |
| `import.completed` | import jobs | Invalidate everything in scope; toast |
| `share.viewed` | public share consumer | Notify owner |
| `approval.requested` | dangerous actions (phase 4+) | Inbox + Slack |
| `approval.resolved` | user / Slack approval | Unblock pending action |

## LLM streaming

For Copilot (Cmd-J) and Decision narration:

1. Build facts payload + allowed_evidence_ids on the server.
2. Start streaming completion to a buffer **and** to the client over SSE.
3. When the stream completes, run `validate_llm_response` on the full buffer.
4. If invalid: emit `llm.invalid` SSE event with the violation reason; frontend replaces the streamed text with an error state.
5. If valid: emit `llm.complete` with `evidence_ids` and `disclaimers`.

This is "stream-then-validate". The user sees text immediately, but the system enforces guardrails as a second pass. The UX must make the validation visible — the message is grayed out until validated, then settles.

For the **two-phase** approach (better UX): generate a hidden draft first, validate, then stream a polish pass that's constrained to paraphrase the validated draft. Adds ~500ms; eliminates the "text appears then disappears" effect.

## Durable workflows (Vercel WDK — phase 5+)

For user-facing flows that must survive crashes: Plaid initial-pull, OCR-and-confirm, monthly investor-update generation.

```ts
// example outline; full implementation in phase 5
export const plaidInitialPull = workflow('plaid-initial-pull', async ({ step, input }) => {
  const accounts = await step.do('fetch-accounts', () => plaid.accounts(input.itemId));
  for (const acct of accounts) {
    await step.do(`pull-${acct.id}`, () => plaid.transactionsAll(acct.id));
  }
  await step.do('normalize', () => normalizeAndStore(input.orgId));
  await step.do('recompute', () => recomputeForecast(input.orgId));
  await step.notify(input.userId, 'Plaid sync complete');
});
```

Use WDK when:
- The flow has multiple steps with external calls.
- Failure mid-flow needs to resume from the last successful step.
- The user is watching the flow status.

Stick with Celery when:
- The job is fully internal (categorization, forecast recompute, anomaly detection).
- It's scheduled / nightly.
- Failure means "log + retry on schedule".

## Backpressure & rate

- Plaid imports for an org with 100k transactions: chunk into pages, throttle to 5 RPS, write each page to the DB before publishing the per-org "import progress" SSE event.
- Don't fan out per-row events to the frontend. Aggregate ("245 new transactions imported") via a single SSE.
- LLM streams: limit one in-flight per user per page.

## Tests

- A unit test for `publish` that asserts the outbox row is written before Redis publish.
- An integration test for the SSE endpoint using `httpx.AsyncClient` and a real Redis (or fakeredis).
- A Playwright test for the dashboard that asserts a metric updates after a fake mutation publishes an event.
