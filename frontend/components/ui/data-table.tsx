"use client"

import * as React from "react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

type DataTableProps<TData> = {
  /** Column definitions from `@tanstack/react-table`. */
  columns: ColumnDef<TData, unknown>[]
  /** Row data. Pass `[]` for "no data at all"; the filter UI will hide. */
  data: TData[]
  /** Stable id for table-level keyboard scoping. Defaults to `"data-table"`. */
  id?: string
  /** Cmd-click on a row (or Enter on the active row) fires this. */
  onRowOpen?: (row: TData) => void
  /** Filter input placeholder. */
  filterPlaceholder?: string
  initialFilter?: string
  /** Custom node for the "no rows match the filter" empty state. */
  emptyAfterFilter?: React.ReactNode
  /** Custom node for the "no data has ever been loaded" empty state. */
  emptyNoData?: React.ReactNode
  /** Hide the filter input + j/k hint row. */
  hideToolbar?: boolean
  /** Optional adornments rendered to the right of the filter input. */
  toolbar?: React.ReactNode
  className?: string
}

/**
 * Dense, sortable, keyboard-driven data table on top of `@tanstack/react-table`.
 *
 * - Sticky header + sticky first column on horizontal scroll.
 * - `/` focuses the filter input from anywhere on the page (when this table
 *   is mounted and the focus is not in another input).
 * - `j` / `k` (and arrow keys) move the active row; Enter opens it; Cmd-click
 *   on a row also opens it.
 * - Distinct "no data at all" vs "no matches after filter" empty states.
 *
 * Designed to be the canonical table primitive for FoundersHQ — every
 * domain table (transactions, invoices, runway scenarios) should compose
 * this rather than rendering raw `<table>`.
 */
export function DataTable<TData>({
  columns,
  data,
  id = "data-table",
  onRowOpen,
  filterPlaceholder = "Filter…",
  initialFilter = "",
  emptyAfterFilter,
  emptyNoData,
  hideToolbar = false,
  toolbar,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = React.useState(initialFilter)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const filterRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const table = useReactTable<TData>({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const rows = table.getRowModel().rows

  // Clamp active index when filtering shrinks the row set.
  React.useEffect(() => {
    setActiveIndex((i) => {
      if (rows.length === 0) return 0
      return Math.min(i, rows.length - 1)
    })
  }, [rows.length])

  // Global keyboard handler: `/`, j/k, arrows, Enter.
  React.useEffect(() => {
    function isEditable(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
      if (el.isContentEditable) return true
      return false
    }

    function onKey(e: KeyboardEvent) {
      if (isEditable(e.target)) {
        // The filter input is the one input we *do* claim Enter from.
        if (
          e.target === filterRef.current &&
          e.key === "Enter" &&
          rows[activeIndex]
        ) {
          e.preventDefault()
          onRowOpen?.(rows[activeIndex].original)
        }
        return
      }

      if (e.key === "/") {
        e.preventDefault()
        filterRef.current?.focus()
        filterRef.current?.select()
        return
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        if (rows.length === 0) return
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, rows.length - 1))
        return
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        if (rows.length === 0) return
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === "Enter" && rows[activeIndex]) {
        // Only handle Enter when focus is inside our container, so the
        // shortcut doesn't fight buttons elsewhere on the page.
        const container = containerRef.current
        const active = document.activeElement as Node | null
        if (container && active && container.contains(active)) {
          e.preventDefault()
          onRowOpen?.(rows[activeIndex].original)
        }
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [rows, activeIndex, onRowOpen])

  const colCount = table.getAllLeafColumns().length

  return (
    <div
      ref={containerRef}
      className={cn("space-y-2", className)}
      data-table-id={id}
    >
      {!hideToolbar ? (
        <div className="flex items-center gap-3">
          <label
            htmlFor={`${id}-filter`}
            className="flex flex-1 items-center gap-2 rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] px-2.5 py-1.5 text-sm focus-within:border-[color:var(--accent)] focus-within:ring-1 focus-within:ring-[color:var(--accent)]"
          >
            <Search
              aria-hidden
              className="h-3.5 w-3.5 text-[color:var(--ink-3)]"
            />
            <input
              ref={filterRef}
              id={`${id}-filter`}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={filterPlaceholder}
              className="w-full bg-transparent text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] outline-none"
              spellCheck={false}
            />
            <kbd className="hidden sm:inline-block rounded border border-[color:var(--line)] px-1 py-0.5 font-mono text-[10px] text-[color:var(--ink-3)]">
              /
            </kbd>
          </label>
          <span className="hidden md:inline text-xs text-[color:var(--ink-3)]">
            <kbd className="rounded border border-[color:var(--line)] px-1 font-mono text-[10px]">
              j
            </kbd>{" "}
            /{" "}
            <kbd className="rounded border border-[color:var(--line)] px-1 font-mono text-[10px]">
              k
            </kbd>{" "}
            navigate ·{" "}
            <kbd className="rounded border border-[color:var(--line)] px-1 font-mono text-[10px]">
              ⏎
            </kbd>{" "}
            open
          </span>
          {toolbar}
        </div>
      ) : null}

      <div className="relative overflow-auto rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-[color:var(--line)]">
                {hg.headers.map((h, idx) => {
                  const sortable = h.column.getCanSort()
                  const sorted = h.column.getIsSorted() as
                    | false
                    | "asc"
                    | "desc"
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={
                        !sortable
                          ? undefined
                          : sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : "none"
                      }
                      onClick={
                        sortable
                          ? h.column.getToggleSortingHandler()
                          : undefined
                      }
                      onKeyDown={(e) => {
                        if (
                          sortable &&
                          (e.key === "Enter" || e.key === " ")
                        ) {
                          e.preventDefault()
                          h.column.toggleSorting()
                        }
                      }}
                      tabIndex={sortable ? 0 : -1}
                      className={cn(
                        "select-none px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[color:var(--ink-2)]",
                        sortable &&
                          "cursor-pointer hover:text-[color:var(--ink)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent)]",
                        idx === 0 &&
                          "sticky left-0 z-10 bg-[color:var(--surface)] shadow-[1px_0_0_var(--line)]",
                      )}
                      style={{
                        width: h.getSize() !== 150 ? h.getSize() : undefined,
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {h.isPlaceholder
                          ? null
                          : flexRender(
                              h.column.columnDef.header,
                              h.getContext(),
                            )}
                        {sortable ? (
                          sorted === "asc" ? (
                            <ArrowUp
                              aria-hidden
                              className="h-3 w-3 text-[color:var(--accent)]"
                            />
                          ) : sorted === "desc" ? (
                            <ArrowDown
                              aria-hidden
                              className="h-3 w-3 text-[color:var(--accent)]"
                            />
                          ) : (
                            <ArrowUpDown
                              aria-hidden
                              className="h-3 w-3 text-[color:var(--ink-3)] opacity-60"
                            />
                          )
                        ) : null}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-3 py-10 text-center text-sm text-[color:var(--ink-3)]"
                >
                  {data.length === 0
                    ? (emptyNoData ?? (
                        <span>
                          No records yet. Data will appear here once it&apos;s
                          synced.
                        </span>
                      ))
                    : (emptyAfterFilter ?? (
                        <span>
                          No matches for{" "}
                          <span className="font-mono text-[color:var(--ink-2)]">
                            &ldquo;{globalFilter}&rdquo;
                          </span>
                          . Try a different filter.
                        </span>
                      ))}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const isActive = i === activeIndex
                return (
                  <tr
                    key={row.id}
                    aria-selected={isActive}
                    onClick={(e) => {
                      setActiveIndex(i)
                      if (e.metaKey || e.ctrlKey) onRowOpen?.(row.original)
                    }}
                    onDoubleClick={() => onRowOpen?.(row.original)}
                    className={cn(
                      "group cursor-default border-b border-[color:var(--line)] last:border-b-0 transition-colors",
                      isActive
                        ? "bg-[color:var(--surface-2)]"
                        : "hover:bg-[color:var(--surface-2)]/60",
                    )}
                  >
                    {row.getVisibleCells().map((cell, idx) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-3 py-2 align-middle tabular-nums text-[color:var(--ink)]",
                          idx === 0 &&
                            cn(
                              "sticky left-0 z-[1] shadow-[1px_0_0_var(--line)]",
                              isActive
                                ? "bg-[color:var(--surface-2)]"
                                : "bg-[color:var(--surface)] group-hover:bg-[color:var(--surface-2)]/60",
                            ),
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
