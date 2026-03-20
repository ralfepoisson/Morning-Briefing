export function formatSnapshotDateForTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(date);
}

export function parseSnapshotDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
