import * as React from "react";
import { Loader2 } from "lucide-react";
import type { Note } from "@note-stream/shared";
import { trpc } from "@/trpc";
import {
  useFilters,
  hasActiveFilters,
  activeFilterCount,
  onlyFilter,
} from "@/state/filters";
import { NoteCard } from "./NoteCard";

const PAGE_SIZE = 50;

export function NoteStream({ onEdit }: { onEdit: (note: Note) => void }) {
  const { filters, lastNarrowed, replace } = useFilters();
  const utils = trpc.useUtils();

  const queryInput = {
    limit: PAGE_SIZE,
    ...(filters.search.trim() !== "" ? { search: filters.search.trim() } : {}),
    ...(filters.tags.length > 0 ? { tags: filters.tags } : {}),
    ...(filters.date !== null ? { date: filters.date } : {}),
  };

  const query = trpc.notes.list.useInfiniteQuery(queryInput, {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const deleteMutation = trpc.notes.delete.useMutation({
    onSuccess: () => {
      void utils.notes.list.invalidate();
      void utils.tags.list.invalidate();
      void utils.calendar.days.invalidate();
    },
  });

  // Empty-result rule: if the current combination yields nothing and more
  // than one filter is active, keep only the most recently added filter.
  const firstPageCount = query.data?.pages[0]?.notes.length;
  React.useEffect(() => {
    if (
      query.isSuccess &&
      firstPageCount === 0 &&
      lastNarrowed !== null &&
      activeFilterCount(filters) > 1
    ) {
      replace(onlyFilter(lastNarrowed.kind, lastNarrowed.value));
    }
  }, [query.isSuccess, firstPageCount, lastNarrowed, filters, replace]);

  // Infinite scroll sentinel.
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (el === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting === true &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          void fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border border-border bg-card"
          />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
        Failed to load notes: {query.error.message}
      </div>
    );
  }

  const notes = query.data?.pages.flatMap((p) => p.notes) ?? [];

  if (notes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {hasActiveFilters(filters)
          ? "No notes match the current filters."
          : "No notes yet. Write your first one above."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onEdit={onEdit}
          onDelete={(id) => deleteMutation.mutate({ id })}
          isDeleting={deleteMutation.isPending}
        />
      ))}
      <div ref={sentinelRef} />
      {isFetchingNextPage && (
        <div className="flex justify-center py-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
