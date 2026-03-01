"use client"

import * as React from "react"
import { PageHeader } from "@/components/common/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

// Action Queue
import {
  ActionQueueBoard,
  type ActionQueueItemUI,
  type ActionQueueFilters,
} from "@/components/action-queue"

// Global Search
import {
  GlobalCommandPalette,
  CommandPaletteTrigger,
  type SearchResultUI,
  type SearchChip,
  type QuickActionUI,
} from "@/components/global-search"

// Notifications
import {
  NotificationsBell,
  NotificationsDrawer,
  type NotificationUI,
} from "@/components/notifications"

// Dashboard
import { ExpenseMixDonut } from "@/components/dashboard/expense-mix-donut"
import { HealthScoreCard } from "@/components/dashboard/health-score-card"

// Funding
import { FundingTimeline } from "@/components/funding"

// Chat
import {
  ChatTypingIndicator,
  ChatTypingIndicatorWithLabel,
  PromptSuggestionGrid,
  PromptSuggestionCards,
} from "@/components/chat"

// Demo data
const demoActionQueueItems: ActionQueueItemUI[] = [
  {
    id: "1",
    invoiceId: "inv-001",
    customerName: "Acme Corp",
    invoiceNumber: "INV-2024-001",
    amount: 15000,
    currency: "USD",
    dueDateISO: "2024-01-15T00:00:00Z",
    daysOverdue: 45,
    actionType: "escalation",
    priorityScore: 92,
    severity: "critical",
    reasons: ["45+ days overdue", "High value", "No response to emails"],
    template: "Dear Acme Corp,\n\nThis is a final notice regarding invoice INV-2024-001...",
    lastTouchedAtISO: "2024-02-01T10:30:00Z",
    lastTouchType: "Email",
    isCompleted: false,
    evidenceIds: ["email-001", "email-002"],
  },
  {
    id: "2",
    invoiceId: "inv-002",
    customerName: "TechStart Inc",
    invoiceNumber: "INV-2024-002",
    amount: 8500,
    currency: "USD",
    dueDateISO: "2024-02-01T00:00:00Z",
    daysOverdue: 28,
    actionType: "call",
    priorityScore: 75,
    severity: "high",
    reasons: ["28 days overdue", "Previous payment issues"],
    lastTouchedAtISO: "2024-02-15T14:00:00Z",
    lastTouchType: "Phone call",
    isCompleted: false,
  },
  {
    id: "3",
    invoiceId: "inv-003",
    customerName: "Global Solutions",
    invoiceNumber: "INV-2024-003",
    amount: 3200,
    currency: "USD",
    dueDateISO: "2024-02-10T00:00:00Z",
    daysOverdue: 14,
    actionType: "reminder",
    priorityScore: 45,
    severity: "medium",
    reasons: ["14 days overdue"],
    template: "Hi,\n\nJust a friendly reminder about invoice INV-2024-003...",
    isCompleted: false,
  },
  {
    id: "4",
    invoiceId: "inv-004",
    customerName: "StartupXYZ",
    invoiceNumber: "INV-2024-004",
    amount: 1500,
    currency: "USD",
    dueDateISO: "2024-02-20T00:00:00Z",
    daysOverdue: 5,
    actionType: "reminder",
    priorityScore: 25,
    severity: "low",
    reasons: ["5 days overdue"],
    isCompleted: false,
  },
]

const demoSearchResults: SearchResultUI[] = [
  {
    type: "invoice",
    id: "inv-001",
    title: "INV-2024-001",
    subtitle: "Acme Corp - $15,000",
    severity: "critical",
    deepLink: "/invoices/inv-001",
  },
  {
    type: "customer",
    id: "cust-001",
    title: "Acme Corp",
    subtitle: "5 invoices, $45,000 total",
    deepLink: "/customers/cust-001",
  },
  {
    type: "transaction",
    id: "txn-001",
    title: "Payment from TechStart",
    subtitle: "$8,500 - Feb 15, 2024",
    deepLink: "/transactions/txn-001",
  },
]

const demoQuickActions: QuickActionUI[] = [
  { id: "new-invoice", title: "Create Invoice", subtitle: "Generate a new invoice", deepLink: "/invoices/new" },
  { id: "view-runway", title: "View Runway", subtitle: "Check your financial runway", deepLink: "/runway" },
  { id: "export-report", title: "Export Report", subtitle: "Download financial report", deepLink: "/reports/export" },
]

const demoNotifications: NotificationUI[] = [
  {
    id: "notif-1",
    severity: "critical",
    title: "Invoice INV-2024-001 is 45 days overdue",
    message: "Acme Corp has not responded to multiple contact attempts. Consider escalation.",
    createdAtISO: "2024-02-28T10:00:00Z",
    evidenceIds: ["email-001"],
    deepLink: "/invoices/inv-001",
    isRead: false,
  },
  {
    id: "notif-2",
    severity: "warn",
    title: "Runway below 6 months",
    message: "Your current runway is 5.2 months. Consider reviewing expenses.",
    createdAtISO: "2024-02-27T14:30:00Z",
    evidenceIds: [],
    deepLink: "/runway",
    isRead: false,
  },
  {
    id: "notif-3",
    severity: "info",
    title: "Payment received",
    message: "TechStart Inc paid $8,500 for INV-2024-002.",
    createdAtISO: "2024-02-26T09:15:00Z",
    evidenceIds: ["txn-001"],
    deepLink: "/transactions/txn-001",
    isRead: true,
  },
]

const demoExpenseSlices = [
  { name: "Payroll", amount: 85000, pct: 45, bucketKey: "payroll" },
  { name: "Software", amount: 28000, pct: 15, bucketKey: "software" },
  { name: "Marketing", amount: 22000, pct: 12, bucketKey: "marketing" },
  { name: "Office", amount: 18000, pct: 10, bucketKey: "office" },
  { name: "Other", amount: 35000, pct: 18, bucketKey: "other" },
]

const demoHealthBreakdown = [
  { key: "runway", label: "Runway", value: 65, weightPct: 30 },
  { key: "burn", label: "Burn Rate", value: 72, weightPct: 25 },
  { key: "revenue", label: "Revenue Growth", value: 85, weightPct: 25 },
  { key: "collections", label: "Collections", value: 58, weightPct: 20 },
]

const demoFundingItems = [
  { id: "f1", title: "Financial Prep", type: "prep" as const, startISO: "2024-01-01", endISO: "2024-02-15", subtitle: "Get documents ready" },
  { id: "f2", title: "Grant Application", type: "non_dilutive" as const, startISO: "2024-02-01", endISO: "2024-04-01", subtitle: "SBIR Phase 1" },
  { id: "f3", title: "Seed Round", type: "equity" as const, startISO: "2024-03-15", endISO: "2024-06-01", subtitle: "$2M target" },
  { id: "f4", title: "Revenue Financing", type: "debt_rbf" as const, startISO: "2024-05-01", endISO: "2024-05-31", subtitle: "Clearco" },
  { id: "f5", title: "Bridge Round", type: "fallback" as const, startISO: "2024-06-15", subtitle: "If needed" },
]

const demoPromptSuggestions = [
  { id: "1", text: "How is my runway looking?" },
  { id: "2", text: "Show me overdue invoices" },
  { id: "3", text: "What are my biggest expenses?" },
  { id: "4", text: "Explain my health score" },
  { id: "5", text: "When should I start fundraising?" },
  { id: "6", text: "Create a collection strategy for Acme Corp" },
]

export default function ComponentsDemoPage() {
  // Action Queue state
  const [selectedActionId, setSelectedActionId] = React.useState<string>()
  const [actionFilters, setActionFilters] = React.useState<ActionQueueFilters>({
    overdueOnly: false,
    noTouchIn7Days: false,
    highAmount: false,
  })

  // Command palette state
  const [commandOpen, setCommandOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchChip, setSearchChip] = React.useState<SearchChip>("all")

  // Notifications state
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState(demoNotifications)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="UI Components Demo"
        description="Preview of all FoundersHQ UI components"
      />

      <Tabs defaultValue="action-queue" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="action-queue">Action Queue</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="funding">Funding</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>

        {/* Action Queue */}
        <TabsContent value="action-queue" className="mt-6">
          <div className="border rounded-lg h-[600px] overflow-hidden">
            <ActionQueueBoard
              items={demoActionQueueItems}
              selectedId={selectedActionId}
              onSelect={setSelectedActionId}
              filters={actionFilters}
              onFilterChange={setActionFilters}
              onOpenInvoice={(id) => alert(`Open invoice: ${id}`)}
              onCopyTemplate={(id) => alert(`Copy template for: ${id}`)}
              onLogTouch={(id, payload) => alert(`Log touch for ${id}: ${JSON.stringify(payload)}`)}
            />
          </div>
        </TabsContent>

        {/* Search */}
        <TabsContent value="search" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <CommandPaletteTrigger onClick={() => setCommandOpen(true)} />
              <span className="text-sm text-muted-foreground">
                Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Cmd+K</kbd> to open
              </span>
            </div>
            <GlobalCommandPalette
              isOpen={commandOpen}
              onOpenChange={setCommandOpen}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              activeChip={searchChip}
              onChipChange={setSearchChip}
              results={searchQuery ? demoSearchResults : []}
              recent={demoSearchResults.slice(0, 2)}
              quickActions={demoQuickActions}
              onSelectResult={(result) => {
                alert(`Selected: ${result.title}`)
                setCommandOpen(false)
              }}
            />
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <NotificationsBell
                unreadCount={unreadCount}
                onClick={() => setNotificationsOpen(true)}
              />
              <span className="text-sm text-muted-foreground">
                Click the bell to open notifications drawer
              </span>
            </div>
            <NotificationsDrawer
              isOpen={notificationsOpen}
              onOpenChange={setNotificationsOpen}
              notifications={notifications}
              onMarkRead={(id) => {
                setNotifications((prev) =>
                  prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
                )
              }}
              onMarkAllRead={() => {
                setNotifications((prev) =>
                  prev.map((n) => ({ ...n, isRead: true }))
                )
              }}
              onArchive={(id) => {
                setNotifications((prev) => prev.filter((n) => n.id !== id))
              }}
              onOpen={(notification) => alert(`Navigate to: ${notification.deepLink}`)}
              onEvidenceClick={(evidenceId) => alert(`View evidence: ${evidenceId}`)}
            />
          </div>
        </TabsContent>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ExpenseMixDonut
              periodLabel="Last 30 days"
              centerLabel="Total"
              centerValue="$188k"
              slices={demoExpenseSlices}
              onSliceClick={(key) => alert(`Drill into: ${key}`)}
            />
            <HealthScoreCard
              score={72}
              band="good"
              breakdown={demoHealthBreakdown}
              notes={[
                "Collections efficiency has room for improvement",
                "Revenue growth is strong",
              ]}
            />
          </div>
        </TabsContent>

        {/* Funding */}
        <TabsContent value="funding" className="mt-6">
          <FundingTimeline
            startISO="2024-01-01"
            endISO="2024-07-01"
            items={demoFundingItems}
            onSelectItem={(id) => alert(`Selected funding item: ${id}`)}
          />
        </TabsContent>

        {/* Chat */}
        <TabsContent value="chat" className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Typing Indicator</h3>
            <div className="flex items-center gap-6">
              <div className="p-3 bg-muted rounded-lg">
                <ChatTypingIndicator />
              </div>
              <ChatTypingIndicatorWithLabel label="Thinking..." />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Prompt Suggestions (Buttons)</h3>
            <PromptSuggestionGrid
              suggestions={demoPromptSuggestions}
              onClick={(id) => alert(`Selected suggestion: ${id}`)}
            />
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Prompt Suggestions (Cards)</h3>
            <PromptSuggestionCards
              suggestions={demoPromptSuggestions}
              onClick={(id) => alert(`Selected suggestion: ${id}`)}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
