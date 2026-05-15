"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { requestPasswordReset } from "@/lib/api/queries/auth"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [devToken, setDevToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await requestPasswordReset({ email })
      setDevToken(res.devToken ?? null)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Forgot password</CardTitle>
          <CardDescription>
            We&apos;ll email you a link to reset it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/40 px-3 py-3 text-sm text-foreground">
                If an account exists for <span className="font-medium">{email}</span>, we&apos;ve
                sent a reset link.
              </div>
              {devToken && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                  <p className="font-medium text-foreground">Dev reset link (one time):</p>
                  <code className="mt-1 block break-all rounded bg-background px-2 py-1 font-mono">
                    {`/reset-password?token=${devToken}`}
                  </code>
                </div>
              )}
              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/sign-in">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send reset link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
