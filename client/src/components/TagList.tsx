import { trpc } from "@/trpc";
import { Badge } from "@/components/ui/badge";
import { useFilters } from "@/state/filters";

export function TagList() {
  const { filters, toggleTag } = useFilters();
  const tagsQuery = trpc.tags.list.useQuery();

  if (tagsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-5 w-24 animate-pulse rounded-full bg-muted"
          />
        ))}
      </div>
    );
  }

  const tags = tagsQuery.data ?? [];
  if (tags.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No tags yet. Add #tags to your notes.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(({ tag, count }) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggleTag(tag)}
          className="focus-visible:outline-none"
          aria-label={`Filter by tag ${tag} (${count} notes)`}
        >
          <Badge
            active={filters.tags.includes(tag)}
            className="cursor-pointer hover:opacity-80"
          >
            #{tag} ({count})
          </Badge>
        </button>
      ))}
    </div>
  );
}
