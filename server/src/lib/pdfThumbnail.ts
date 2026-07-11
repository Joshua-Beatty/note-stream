import { ResultAsync } from "neverthrow";
import { LRUCache } from "lru-cache";
import { fsError, type AppError } from "./errors.js";

/**
 * Renders the first page of a PDF to a WebP thumbnail and caches the bytes in
 * an in-memory LRU (bounded by total bytes). Thumbnails are best-effort: an
 * encrypted or corrupt PDF yields an FsError rather than throwing.
 *
 * Nothing is persisted to disk or the DB — the cache is per-process and simply
 * regenerates after a restart. Attachment files are immutable, so cache
 * entries (keyed by attachment id) never need invalidation.
 *
 * The pdfjs-dist "legacy" build is used because it runs in Node without a
 * worker and ships its own @napi-rs/canvas-backed canvas factory.
 */

/** Target thumbnail width in device pixels (~2x the 112px display tile). */
const THUMB_WIDTH = 224;

/** ~50MB of encoded WebP bytes across all cached thumbnails. */
const MAX_CACHE_BYTES = 50 * 1024 * 1024;

const cache = new LRUCache<string, Buffer>({
  maxSize: MAX_CACHE_BYTES,
  sizeCalculation: (value) => value.byteLength,
});

/**
 * Filesystem path (with trailing separator) to pdfjs's bundled standard font
 * data. pdfjs's Node font-data factory reads this via `fs.readFile`, so it
 * must be a plain path, NOT a file:// URL.
 */
async function standardFontDataUrl(): Promise<string> {
  const { createRequire } = await import("node:module");
  const path = await import("node:path");
  const require = createRequire(import.meta.url);
  const pkg = require.resolve("pdfjs-dist/package.json");
  return path.join(path.dirname(pkg), "standard_fonts") + path.sep;
}

async function render(filePath: string): Promise<Buffer> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { readFile } = await import("node:fs/promises");

  const data = new Uint8Array(await readFile(filePath));
  const loadingTask = pdfjs.getDocument({
    data,
    // No worker: run parsing on the current thread.
    disableWorker: true,
    // Supply bundled font data so base-14 (Helvetica, etc.) glyphs render.
    standardFontDataUrl: await standardFontDataUrl(),
  } as Parameters<typeof pdfjs.getDocument>[0]);

  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = THUMB_WIDTH / baseViewport.width;
    const viewport = page.getViewport({ scale });

    // The legacy build's default (Node) canvas factory uses @napi-rs/canvas.
    const canvasFactory = doc.canvasFactory as {
      create: (
        w: number,
        h: number,
      ) => {
        canvas: { encode: (fmt: string, q?: number) => Promise<Buffer> };
        context: unknown;
      };
      destroy: (o: { canvas: unknown; context: unknown }) => void;
    };
    const canvasAndContext = canvasFactory.create(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );

    try {
      await page.render({
        canvasContext:
          canvasAndContext.context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;

      return await canvasAndContext.canvas.encode("webp", 80);
    } finally {
      canvasFactory.destroy(canvasAndContext);
    }
  } finally {
    await doc.destroy();
  }
}

/**
 * Returns the WebP thumbnail bytes for a PDF, generating and caching on a miss.
 * `id` is the attachment id (cache key); `filePath` is the PDF on disk.
 */
export function getPdfThumbnail(
  id: string,
  filePath: string,
): ResultAsync<Buffer, AppError> {
  const cached = cache.get(id);
  if (cached !== undefined) {
    return ResultAsync.fromSafePromise(Promise.resolve(cached));
  }
  return ResultAsync.fromPromise(
    render(filePath),
    (cause): AppError => fsError("Failed to render PDF thumbnail", cause),
  ).map((buf) => {
    cache.set(id, buf);
    return buf;
  });
}

/** Exposed for tests. */
export function _clearThumbnailCache(): void {
  cache.clear();
}
