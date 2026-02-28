import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string
  delta?: string
  deltaDirection?: "up" | "down" | "neutral"
  tooltip?: string
  className?: string
}

export function MetricCard({
  title,
  value,
  delta,
  deltaDirection,
  tooltip,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardContent className="px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-2xl font-bold text-foreground tracking-tight">
            {value}
          </span>
          {delta && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium pb-0.5",
                deltaDirection === "up" && "text-success",
                deltaDirection === "down" && "text-destructive",
                deltaDirection === "neutral" && "text-muted-foreground"
              )}
            >
              {deltaDirection === "up" && <TrendingUp className="h-3 w-3" />}
              {deltaDirection === "down" && <TrendingDown className="h-3 w-3" />}
              {deltaDirection === "neutral" && <Minus className="h-3 w-3" />}
              {delta}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
