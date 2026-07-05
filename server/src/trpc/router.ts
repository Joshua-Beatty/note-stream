import { router } from "./trpc.js";
import { notesList } from "../routes/notes.list.js";
import { notesCreate } from "../routes/notes.create.js";
import { notesUpdate } from "../routes/notes.update.js";
import { notesDelete } from "../routes/notes.delete.js";
import { tagsList } from "../routes/tags.list.js";
import { calendarDays } from "../routes/calendar.days.js";

export const appRouter = router({
  notes: router({
    list: notesList,
    create: notesCreate,
    update: notesUpdate,
    delete: notesDelete,
  }),
  tags: router({
    list: tagsList,
  }),
  calendar: router({
    days: calendarDays,
  }),
});

export type AppRouter = typeof appRouter;
