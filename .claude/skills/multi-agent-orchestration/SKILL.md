---
name: multi-agent-orchestration
description: Use when building server-side AI features that require multi-step reasoning (Causal Analyst, Decision narration, Document Intelligence). Encodes the pattern for using the Anthropic Agent SDK while keeping our guardrails intact.
---

# Multi-agent orchestration

For features where a single LLM call is not enough — Causal Analyst (F16), complex Decision narration (F11), Document Intelligence extraction with cross-document checks (F20) — we use **server-side agentic loops**, not "have the model think harder".

## Hard rules

1. **Guardrails apply to every step.** Each agent tool call that returns text passes through `validate_llm_response`. Each tool call that returns numbers comes from the deterministic engine, never from the model.
2. **Tools are typed.** Every tool has a Pydantic input model and output model. Models cannot pass arbitrary strings.
3. **No write tools without human-in-the-loop.** Agents can read, query, score, compare. Write actions (mutate a row, send an email, move money) must be queued as proposed actions and require explicit user confirmation.
4. **Bounded steps.** Every agent loop has a `max_steps` cap (default 8). Past that, it returns "exceeded budget" with what it has so far.
5. **Full transcript audit-logged.** The `llm_calls` table records every step's prompt, tool calls, and response, all tied to one `investigation_id`.

## Tool catalogue (build in `app/services/agents/tools/`)

Each tool is a function with:
- Pydantic input model.
- Pydantic output model with `evidence_ids: list[str]`.
- An OpenAPI-style description for the model.

Examples (build as needed):

```python
class QueryMetricsInput(BaseModel):
    period_start: date
    period_end: date
    metrics: list[Literal["total_outflow", "net_burn", "runway_weeks", ...]]

class QueryMetricsOutput(BaseModel):
    values: dict[str, float | None]
    evidence_ids: list[str]
    period: dict

def query_metrics(org: Org, session: AsyncSession, inp: QueryMetricsInput) -> QueryMetricsOutput:
    # Calls into existing app.services.spending.metrics, app.services.runway.forecast, etc.
    ...
```

Tools to plan for:
- `query_metrics` — deterministic values for a period.
- `query_transactions` — filtered list with totals and evidence_ids; returns at most N rows.
- `query_invoices` — same shape.
- `query_commitments` — recurring vendor commitments.
- `find_anomalies` — top-N anomalous rows in a window vs baseline.
- `compare_periods` — diff between two windows by category / vendor / customer.
- `lookup_evidence` — given a UUID, return the canonical record (transaction or invoice) summary.
- `propose_action` — agent's structured proposal; routed to the user inbox for approval.

## Loop skeleton (use the Anthropic SDK pattern)

```python
from anthropic import AsyncAnthropic

client = AsyncAnthropic()

async def run_causal_analyst(question: str, ctx: AgentContext) -> Investigation:
    tools = build_tools_for(ctx)
    messages = [
        {"role": "user", "content": render_system_prompt(ctx) + "\n\nUser question: " + question}
    ]
    steps = []
    for i in range(MAX_STEPS):
        resp = await client.messages.create(
            model="claude-opus-4-7",
            max_tokens=4096,
            tools=[t.schema for t in tools],
            messages=messages,
        )
        steps.append(record_step(resp))

        if resp.stop_reason == "tool_use":
            tool_results = []
            for block in resp.content:
                if block.type != "tool_use":
                    continue
                tool = lookup_tool(tools, block.name)
                # Validate input against tool's Pydantic model
                inp = tool.input_model.model_validate(block.input)
                out = await tool.run(ctx, inp)
                # Guardrail check on text-returning tools
                if tool.returns_text:
                    ok, _, err = validate_llm_response(out.text, ctx.facts_payload, ctx.allowed_evidence_ids)
                    if not ok:
                        raise GuardrailViolation(err)
                tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": out.model_dump_json()})
            messages.append({"role": "assistant", "content": resp.content})
            messages.append({"role": "user", "content": tool_results})
            continue

        # final text response — validate before returning
        final_text = extract_text(resp)
        ok, disclaimers, err = validate_llm_response(final_text, ctx.facts_payload, ctx.allowed_evidence_ids)
        if not ok:
            raise GuardrailViolation(err)
        return Investigation(steps=steps, final=final_text, disclaimers=disclaimers)

    return Investigation(steps=steps, final=None, exceeded_budget=True)
```

## Prompt caching

- Use Anthropic's prompt-cache control on the system prompt and tool definitions (they don't change between steps).
- This routinely cuts cost 70% on multi-step loops. Use it.

## Streaming to the frontend

- Stream each step as an SSE event (`investigation.step`). The frontend renders the timeline as it unfolds: "Looking at last 4 weeks of outflow → Found 3 unusual transactions → Comparing to prior month → ...".
- Final event is `investigation.complete` with the full narrative.

## When the agent disagrees with the user

Sometimes the user asks "why did burn jump?" and the deterministic engine says burn did not jump. The agent must:
1. Detect the mismatch in its first tool call.
2. Surface the mismatch ("burn was flat — perhaps you meant a different metric?") instead of fabricating a cause.
3. Suggest alternative framings.

A test must cover this. See `tests/test_causal_analyst.py::test_disagrees_when_no_anomaly` (build in phase 6).

## What not to do

- Do not let the agent emit raw SQL. Tools wrap queries.
- Do not let the agent name a number that didn't come from a tool. The validator catches this; do not weaken the validator to "let the agent be smarter".
- Do not chain agents without a clear handoff schema. Multi-agent ≠ "ask the model to call another model".
- Do not use the agent loop for tasks a single call would handle. Most LLM features are single-call.

## Cost ceilings

- Hard cap per investigation: 50k tokens or `MAX_STEPS=8`, whichever first.
- Per-org daily cap on agent invocations, enforced at the router (default 100/day, configurable).
- Surface costs in the admin dashboard.
