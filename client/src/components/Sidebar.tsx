import { FilterX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFilters, hasActiveFilters } from "@/state/filters";
import { cn } from "@/lib/utils";
import { SearchBar } from "./SearchBar";
import { CalendarFilter } from "./CalendarFilter";
import { TagList } from "./TagList";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { filters, clearAll } = useFilters();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-background p-4 transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          "md:static md:z-auto md:translate-x-0 md:transition-none",
        )}
      >
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <img src="/icon.svg" alt="" className="h-6 w-6 rounded" />
              Note Stream
            </h1>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <SearchBar />
        </div>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Calendar
          </h2>
          <CalendarFilter />
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tags
          </h2>
          <TagList />
        </section>

        {hasActiveFilters(filters) && (
          <Button variant="outline" size="sm" onClick={clearAll}>
            <FilterX className="h-4 w-4" />
            Clear filters
          </Button>
        )}
      </aside>
    </>
  );
}
