import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFilters } from "@/state/filters";

export function SearchBar() {
  const { filters, setSearch } = useFilters();
  const [value, setValue] = React.useState(filters.search);

  // Keep local input in sync when filters are reset externally.
  React.useEffect(() => {
    setValue(filters.search);
  }, [filters.search]);

  // Debounce pushes to the filter state.
  React.useEffect(() => {
    if (value === filters.search) return;
    const t = setTimeout(() => setSearch(value), 300);
    return () => clearTimeout(t);
  }, [value, filters.search, setSearch]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search notes…"
        className="pl-8 pr-8"
        aria-label="Search notes"
      />
      {value !== "" && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            setSearch("");
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
