import * as React from "react";
import type { Note } from "@note-stream/shared";
import { Sidebar } from "@/components/Sidebar";
import { Composer } from "@/components/Composer";
import { NoteStream } from "@/components/NoteStream";

export function App() {
  const [editing, setEditing] = React.useState<Note | null>(null);
  const mainRef = React.useRef<HTMLElement>(null);

  return (
    <div className="flex h-full">
      <Sidebar />
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto"
      >
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
