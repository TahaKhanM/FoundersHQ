"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/common/page-header"
import { EvidenceLink } from "@/components/common/evidence-link"
import { RecordSheet } from "@/components/common/record-sheet"
import { useLLMExplain } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"
import { Send, Bot, User, AlertCircle, Sparkles } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: { evidenceIds: string[]; note?: string }[]
  confidence?: "high" | "medium" | "low"
  disclaimers?: string[]
}

const suggestedQuestions = [
  "What's driving my burn rate?",
  "Which invoices should I follow up on first?",
  "How can I extend my runway by 4 weeks?",
  "What funding options fit my current stage?",
]

export default function ExplainPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const { trigger, isMutating } = useLLMExplain()
  const [sheetId, setSheetId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, isMutating])

  async function handleSend(question?: string) {
    const q = question ?? input.trim()
    if (!q || isMutating) return

    const userMsg: Message = { id: `msg_${Date.now()}`, role: "user", content: q }
    setMessages((prev) => [...prev, userMsg])
    setInput("")

    const result = await trigger({ question: q, contextModules: ["spending", "invoices", "runway", "funding"] })
    if (result) {
      const assistantMsg: Message = {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: result.answer,
        citations: result.citations,
        confidence: result.confidence,
        disclaimers: result.disclaimers,
      }
      setMessages((prev) => [...prev, assistantMsg])
    }
  }

  return (
    <>
      <PageHeader title="Explain" description="Ask questions about your financial data and get evidence-backed answers" />

      <div className="flex flex-col h-[calc(100vh-220px)]">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && !isMutating && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Financial AI Assistant</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Ask anything about your spending, invoices, runway, or funding. Answers are grounded in your actual data.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-w-lg w-full">
                {suggestedQuestions.map((q) => (
                  <Button
                    key={q}
                    variant="outline"
                    className="h-auto py-3 px-4 text-left text-sm justify-start max-w-full min-w-0"
                    onClick={() => handleSend(q)}
                  >
                    <span className="truncate block">{q}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <Card className={cn(
                "max-w-[85%] sm:max-w-[70%]",
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card"
              )}>
                <CardContent className="p-3">
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Sources</p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.flatMap((c) =>
                          c.evidenceIds.map((eid) => (
                            <EvidenceLink
                              key={eid}
                              evidenceId={eid}
                              onClick={() => setSheetId(eid)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  )}
                  {msg.confidence && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        msg.confidence === "high" && "bg-success/10 text-success border-success/20",
                        msg.confidence === "medium" && "bg-warning/10 text-warning-foreground border-warning/20",
                        msg.confidence === "low" && "bg-destructive/10 text-destructive border-destructive/20",
                      )}>
                        {msg.confidence} confidence
                      </Badge>
                    </div>
                  )}
                  {msg.disclaimers && msg.disclaimers.length > 0 && (
                    <div className="mt-2">
                      {msg.disclaimers.map((d, i) => (
                        <p key={i} className="flex items-start gap-1 text-xs text-muted-foreground">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          {d}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {isMutating && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <Card className="max-w-[70%]">
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border pt-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Ask about your finances..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              rows={1}
              className="min-h-[44px] max-h-32 resize-none"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isMutating}
              size="icon"
              className="shrink-0 h-11 w-11"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>
      </div>

      <RecordSheet open={!!sheetId} onOpenChange={() => setSheetId(null)} evidenceId={sheetId} />
    </>
  )
}
