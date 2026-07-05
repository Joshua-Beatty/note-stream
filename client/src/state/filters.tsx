import * as React from "react";

export interface Filters {
  search: string;
  tags: string[];
  /** YYYY-MM-DD or null */
  date: string | null;
}

export type FilterKind = "search" | "tag" | "date";

export const EMPTY_FILTERS: Filters = { search: "", tags: [], date: null };

interface FiltersContextValue {
  filters: Filters;
  /**
   * The filter dimension most recently narrowed by the user. Used by the
   * empty-result rule: if a combination yields no notes, everything else is
   * cleared and only this filter is kept.
   */
  lastNarrowed: { kind: FilterKind; value: string } | null;
  setSearch: (search: string) => void;
  toggleTag: (tag: string) => void;
  setDate: (date: string | null) => void;
  clearAll: () => void;
  /** Replace all filters at once (used by the empty-result reset rule). */
  replace: (filters: Filters) => void;
}

const FiltersContext = React.createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [lastNarrowed, setLastNarrowed] = React.useState<{
    kind: FilterKind;
    value: string;
  } | null>(null);

  const value = React.useMemo<FiltersContextValue>(
    () => ({
      filters,
      lastNarrowed,
      setSearch: (search) => {
        setFilters((f) => ({ ...f, search }));
        setLastNarrowed(
          search.trim() !== "" ? { kind: "search", value: search } : null,
        );
      },
      toggleTag: (tag) => {
        setFilters((f) => {
          const adding = !f.tags.includes(tag);
          setLastNarrowed(adding ? { kind: "tag", value: tag } : null);
          return {
            ...f,
            tags: adding ? [...f.tags, tag] : f.tags.filter((t) => t !== tag),
          };
        });
      },
      setDate: (date) => {
        setFilters((f) => ({ ...f, date }));
        setLastNarrowed(date !== null ? { kind: "date", value: date } : null);
      },
      clearAll: () => {
        setFilters(EMPTY_FILTERS);
        setLastNarrowed(null);
      },
      replace: (next) => {
        setFilters(next);
        setLastNarrowed(null);
      },
    }),
    [filters, lastNarrowed],
  );

  return (
    <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
  );
}

export function useFilters(): FiltersContextValue {
  const ctx = React.useContext(FiltersContext);
  if (ctx === null) {
    throw new Error("useFilters must be used within FiltersProvider");
  }
  return ctx;
}

export function activeFilterCount(filters: Filters): number {
  return (
    (filters.search.trim() !== "" ? 1 : 0) +
    filters.tags.length +
    (filters.date !== null ? 1 : 0)
  );
}

export function hasActiveFilters(filters: Filters): boolean {
  return activeFilterCount(filters) > 0;
}

/** Builds the filters object keeping only the last-narrowed filter. */
export function onlyFilter(kind: FilterKind, value: string): Filters {
  switch (kind) {
    case "search":
      return { ...EMPTY_FILTERS, search: value };
    case "tag":
      return { ...EMPTY_FILTERS, tags: [value] };
    case "date":
      return { ...EMPTY_FILTERS, date: value };
  }
}
