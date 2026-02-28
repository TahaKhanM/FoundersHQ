"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Building2, Upload, FileQuestion, Landmark, Check, Loader2, Database } from "lucide-react"

const steps = [
  { id: 1, title: "Organization" },
  { id: 2, title: "Data Source" },
  { id: 3, title: "Upload" },
]

type IngestionMethod = "csv" | "questionnaire" | "bank_api"

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [orgName, setOrgName] = useState("My Startup Inc.")
  const [method, setMethod] = useState<IngestionMethod | null>(null)
  const [txnFile, setTxnFile] = useState<File | null>(null)
  const [invFile, setInvFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  function handleNext() {
    if (step < 3) setStep(step + 1)
  }

  function handleBack() {
    if (step > 1) setStep(step - 1)
  }

  async function handleComplete() {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1000))
    router.push("/dashboard")
  }

  async function handleSampleData() {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1000))
    router.push("/dashboard")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-4 flex items-center justify-center gap-2">
            {steps.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    step > s.id
                      ? "bg-success text-success-foreground"
                      : step === s.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                </div>
                <span
                  className={cn(
                    "text-sm hidden sm:inline",
                    step === s.id ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.title}
                </span>
                {s.id < steps.length && (
                  <div className="h-px w-8 bg-border" />
                )}
              </div>
            ))}
          </div>

          {step === 1 && (
            <>
              <CardTitle>Confirm your organization</CardTitle>
              <CardDescription>
                We support one org per account in MVP.
              </CardDescription>
            </>
          )}
          {step === 2 && (
            <>
              <CardTitle>Choose your data source</CardTitle>
              <CardDescription>
                How would you like to import your financial data?
              </CardDescription>
            </>
          )}
          {step === 3 && (
            <>
              <CardTitle>Upload your data</CardTitle>
              <CardDescription>
                Upload CSV files or use sample data to explore.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3">
              {([
                { id: "csv" as const, icon: Upload, label: "CSV Upload", desc: "Upload transactions & invoices CSV files" },
                { id: "questionnaire" as const, icon: FileQuestion, label: "Questionnaire", desc: "Answer questions about your finances" },
                { id: "bank_api" as const, icon: Landmark, label: "Bank API", desc: "Connect your bank directly (V1)", disabled: true },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => !opt.disabled && setMethod(opt.id)}
                  disabled={opt.disabled}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors",
                    method === opt.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted",
                    opt.disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <opt.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      {opt.label}
                      {opt.disabled && <Badge variant="secondary" className="text-[10px]">V1</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {method === "csv" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="txnCsv">Transactions CSV</Label>
                    <Input
                      id="txnCsv"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setTxnFile(e.target.files?.[0] ?? null)}
                    />
                    {txnFile && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {txnFile.name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invCsv">Invoices CSV</Label>
                    <Input
                      id="invCsv"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setInvFile(e.target.files?.[0] ?? null)}
                    />
                    {invFile && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {invFile.name}
                      </p>
                    )}
                  </div>
                </>
              )}

              {method === "questionnaire" && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <Building2 className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Questionnaire flow coming soon. Use sample data for now.
                  </p>
                </div>
              )}

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleSampleData}
                disabled={loading}
              >
                <Database className="mr-2 h-4 w-4" />
                Use sample startup data
              </Button>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 1}
            >
              Back
            </Button>
            {step < 3 ? (
              <Button
                onClick={handleNext}
                disabled={step === 2 && !method}
              >
                Continue
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Setup
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
