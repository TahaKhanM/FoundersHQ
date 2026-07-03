"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useGlobalSearch } from "@/lib/api/hooks"
import type { SearchResultDTO } from "@/lib/api/types"
import { FileText, Receipt, User, CreditCard, Landmark, LayoutDashboard } from "lucide-react"

interface GlobalCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const typeIcons: Record<string, React.ReactNode> = {
  transaction: <CreditCard className="h-4 w-4" />,
  invoice: <Receipt className="h-4 w-4" />,
  customer: <User className="h-4 w-4" />,
  commitment: <CreditCard className="h-4 w-4" />,
  funding_opportunity: <Landmark className="h-4 w-4" />,
  page: <LayoutDashboard className="h-4 w-4" />,
}

export function GlobalCommandPalette({ open, onOpenChange }: GlobalCommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const { data: results = [], isLoading } = useGlobalSearch(query.trim() || null, open && query.trim().length > 0)

  const handleSelect = useCallback(
    (item: SearchResultDTO) => {
      onOpenChange(false)
      const path = item.deep_link.startsWith("/") ? item.deep_link : `/${item.deep_link}`
      if (item.open_param) {
        const url = new URL(path, window.location.origin)
        const paramName =
          item.type === "invoice"
            ? "openInvoiceId"
            : item.type === "transaction"
              ? "openTxnId"
              : item.type === "customer"
                ? "openCustomerId"
                : item.type === "funding_opportunity"
                  ? "openOpportunityId"
                  : "openId"
        url.searchParams.set(paramName, item.open_param)
        router.push(url.pathname + url.search)
      } else {
        router.push(path)
      }
    },
    [onOpenChange, router]
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Search transactions, invoices, pages...">
      <CommandInput
        placeholder="Search transactions, invoices, runway..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Searching..." : query.trim() ? "No results." : "Type to search."}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Results">
            {results.map((item) => (
              <CommandItem
                key={`${item.type}-${item.id}`}
                value={`${item.type}-${item.id}-${item.title}`}
                onSelect={() => handleSelect(item)}
              >
                {typeIcons[item.type] ?? <FileText className="h-4 w-4" />}
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{item.title}</span>
                  {item.subtitle && (
                    <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground ml-auto capitalize">{item.type.replace("_", " ")}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
