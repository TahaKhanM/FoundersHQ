"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/common/page-header"

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const tabFromRoute =
    pathname === "/invoices/list"
      ? "list"
      : pathname === "/invoices/customers"
        ? "customers"
        : pathname === "/invoices/actions"
          ? "actions"
          : pathname === "/invoices/imports"
            ? "imports"
            : "overview"

  return (
    <>
      <PageHeader
        title="Invoice Control Tower"
        description="Track receivables, predict payments, and manage collections"
      />
      <Tabs value={tabFromRoute} className="w-full">
        <TabsList className="w-full justify-start flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" asChild>
            <Link href="/invoices">Overview</Link>
          </TabsTrigger>
          <TabsTrigger value="list" asChild>
            <Link href="/invoices/list">Invoices</Link>
          </TabsTrigger>
          <TabsTrigger value="customers" asChild>
            <Link href="/invoices/customers">Customers</Link>
          </TabsTrigger>
          <TabsTrigger value="actions" asChild>
            <Link href="/invoices/actions">Action Queue</Link>
          </TabsTrigger>
          <TabsTrigger value="imports" asChild>
            <Link href="/invoices/imports">Imports</Link>
          </TabsTrigger>
        </TabsList>
        <div className="mt-4">{children}</div>
      </Tabs>
    </>
  )
}
