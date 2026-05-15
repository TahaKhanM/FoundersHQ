import { Skeleton } from "@/components/ui/skeleton"

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

/**
 * Skeleton that mirrors the shape of `<DataTable>` so swapping in real
 * data does not produce a layout shift.
 */
export function TableSkeleton({ rows = 6, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="space-y-2" aria-hidden>
      {/* toolbar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="hidden h-6 w-40 rounded md:block" />
      </div>
      {/* table */}
      <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)]">
        <div className="grid border-b border-[color:var(--line)] px-3 py-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16 rounded" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid border-b border-[color:var(--line)] px-3 py-3 last:border-b-0"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4 w-24 rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
