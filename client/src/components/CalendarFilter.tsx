import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/trpc";
import { useFilters } from "@/state/filters";
import { cn } from "@/lib/utils";
import { toDateKey, toMonthKey } from "@/lib/format";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CalendarFilter() {
  const { filters, setDate } = useFilters();
  const [viewMonth, setViewMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const monthKey = toMonthKey(viewMonth);
  const daysQuery = trpc.calendar.days.useQuery({ month: monthKey });
  const daysWithNotes = React.useMemo(
    () => new Set(daysQuery.data ?? []),
    [daysQuery.data],
  );

  const todayKey = toDateKey(new Date());
  const firstWeekday = viewMonth.getDay();
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate();

  const cells: Array<{ day: number; key: string } | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const key = `${monthKey}-${String(day).padStart(2, "0")}`;
      return { day, key };
    }),
  ];

  const monthLabel = viewMonth.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Previous month"
          onClick={() =>
            setViewMonth(
              (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
            )
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium">{monthLabel}</span>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Next month"
          onClick={() =>
            setViewMonth(
              (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
            )
          }
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-[10px] text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((cell, i) =>
          cell === null ? (
            <div key={`empty-${i}`} />
          ) : (
            <button
              key={cell.key}
              type="button"
              disabled={!daysWithNotes.has(cell.key)}
              onClick={() =>
                setDate(filters.date === cell.key ? null : cell.key)
              }
              className={cn(
                "aspect-square rounded text-xs transition-colors",
                daysWithNotes.has(cell.key)
                  ? "cursor-pointer font-semibold text-primary hover:bg-accent"
                  : "cursor-default text-muted-foreground/50",
                cell.key === todayKey && "ring-1 ring-ring",
                filters.date === cell.key &&
                  "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {cell.day}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
