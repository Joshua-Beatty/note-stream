import * as React from "react";
import { Menu } from "lucide-react";
import type { Note } from "@note-stream/shared";
import { Sidebar } from "@/components/Sidebar";
import { Composer } from "@/components/Composer";
import { NoteStream } from "@/components/NoteStream";
import { useFilters } from "@/state/filters";

export function App() {
  const [editing, setEditing] = React.useState<Note | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const mainRef = React.useRef<HTMLElement>(null);
  const { filters } = useFilters();

  // Close the mobile drawer whenever a filter changes so results are visible.
  React.useEffect(() => {
    setSidebarOpen(false);
  }, [filters]);

  return (
    <div className="flex h-full">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <img src="/icon.svg" alt="" className="h-5 w-5 rounded" />
            Note Stream
          </span>
        </div>

        <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
          <Composer
            editing={editing}
            onCancelEdit={() => setEditing(null)}
            onSaved={() => setEditing(null)}
          />
          <NoteStream
            onEdit={(note) => {
              setEditing(note);
              mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </main>
    </div>
  );
}
