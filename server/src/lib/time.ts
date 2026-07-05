/**
 * Timestamps are stored as server-local ISO 8601 strings with a UTC offset,
 * e.g. "2026-07-04T10:30:00.000-06:00". This makes the server-local calendar
 * day available as the first 10 characters, and strings still sort
 * chronologically for a fixed server timezone (set TZ to control it).
 */
export function nowLocalIso(date: Date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
