"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface StepOrgValue {
  orgName: string
  baseCurrency: string
  fiscalYearStartMonth: number
}

interface StepOrgProps {
  initial: Partial<StepOrgValue>
  onSubmit: (v: StepOrgValue) => Promise<void>
}

const CURRENCY_OPTIONS = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "SGD",
  "INR",
]

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function StepOrg({ initial, onSubmit }: StepOrgProps) {
  const [orgName, setOrgName] = useState(initial.orgName ?? "")
  const [baseCurrency, setBaseCurrency] = useState(initial.baseCurrency ?? "USD")
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState<number>(
    initial.fiscalYearStartMonth ?? 1,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = orgName.trim().length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await onSubmit({
        orgName: orgName.trim(),
        baseCurrency,
        fiscalYearStartMonth,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="space-y-1.5">
        <Label htmlFor="org-name">Organisation name</Label>
        <Input
          id="org-name"
          name="org_name"
          placeholder="Acme Robotics"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          autoFocus
        />
        <p className="text-xs text-[color:var(--ink-3)]">
          Shown in the side rail and on every export.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="base-currency">Base currency</Label>
          <Select
            value={baseCurrency}
            onValueChange={(v) => setBaseCurrency(v)}
          >
            <SelectTrigger id="base-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[color:var(--ink-3)]">
            All metrics roll up into this currency.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fy-start">Fiscal year starts</Label>
          <Select
            value={String(fiscalYearStartMonth)}
            onValueChange={(v) => setFiscalYearStartMonth(Number(v))}
          >
            <SelectTrigger id="fy-start">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((label, idx) => (
                <SelectItem key={label} value={String(idx + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[color:var(--ink-3)]">
            Used for annual rollups and runway anchoring.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-[color:var(--danger)]"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={!canSubmit || loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </form>
  )
}
