import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFilters, hasActiveFilters } from "@/state/filters";
import { SearchBar } from "./SearchBar";
import { CalendarFilter } from "./CalendarFilter";
import { TagList } from "./TagList";

export function Sidebar() {
  const { filters, clearAll } = useFilters();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border p-4">
      <div>
        <h1 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight">
          <img src="/icon.svg" alt="" className="h-6 w-6 rounded" />
          Note Stream
        </h1>
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
  );
}
