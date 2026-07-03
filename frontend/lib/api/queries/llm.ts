import useSWRMutation from "swr/mutation"

import { apiFetch, IS_MOCK } from "../client"
import type { LLMExplainResponseDTO } from "../types"

const USE_MOCK = IS_MOCK

export function useLLMExplain() {
  return useSWRMutation(
    "llm-explain",
    async (
      _key: string,
      { arg }: { arg: { question: string; contextModules: string[] } },
    ) => {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 1200))
        const response: LLMExplainResponseDTO = {
          answer: `Based on your financial data, here's what I found:\n\nYour net burn of $42,500/month is primarily driven by payroll (txn_001: $28,500) and cloud infrastructure (txn_002: $4,200). The SaaS tool category shows an 8.3% month-over-month increase.\n\nOn the revenue side, you have $58,000 in outstanding invoices, with $18,500 overdue. The most concerning is inv_003 from Beta Inc ($12,000, 34 days overdue) which is significantly impacting your cash position.\n\nYour pessimistic runway of 11 weeks suggests urgency in either reducing costs or accelerating collections. I recommend prioritizing the Beta Inc collection (inv_003) and reviewing cloud costs (txn_002) for optimization.`,
          citations: [
            { evidenceIds: ["txn_001", "txn_002"], note: "Primary burn drivers" },
            { evidenceIds: ["inv_003", "inv_005"], note: "Overdue invoices" },
          ],
          confidence: "high",
          disclaimers: [
            "Projections based on last 30 days of data. Actual results may vary.",
          ],
        }
        return response
      }
      return apiFetch<LLMExplainResponseDTO>("/llm/explain", {
        method: "POST",
        body: JSON.stringify(arg),
      })
    },
  )
}
