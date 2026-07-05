/** A single attachment on a note. */
export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** URL path where the file is served, e.g. /user_content/{id}/{filename} */
  url: string;
}

/** A note in the stream. */
export interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  attachments: Attachment[];
}

/** Filters applied to the note stream. All combinable (AND). */
export interface NoteFilters {
  search?: string;
  tags?: string[];
  /** Server-local date, YYYY-MM-DD */
  date?: string;
}

/** Cursor for keyset pagination: the (createdAt, id) of the last note seen. */
export interface NoteCursor {
  createdAt: string;
  id: string;
}

export interface NotesPage {
  notes: Note[];
  nextCursor: NoteCursor | null;
}

export interface TagCount {
  tag: string;
  count: number;
}

/** Result of uploading a single file. */
export interface UploadedFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

/**
 * Extracts unique, lowercased tags from note content.
 * A tag is a '#' followed by one or more alphanumeric characters.
 */
export const TAG_REGEX = /#([a-zA-Z0-9]+)/g;

export function extractTags(content: string): string[] {
  const tags = new Set<string>();
  for (const match of content.matchAll(TAG_REGEX)) {
    const tag = match[1];
    if (tag !== undefined) {
      tags.add(tag.toLowerCase());
    }
  }
  return [...tags].sort();
}
