/**
 * Get current date/time in Europe/Paris timezone.
 */
export function getNowParis(): Date {
  // Get the current time formatted in Paris timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';

  return new Date(
    parseInt(get('year')),
    parseInt(get('month')) - 1,
    parseInt(get('day')),
    parseInt(get('hour')),
    parseInt(get('minute')),
    parseInt(get('second'))
  );
}

/**
 * Get today's date string (YYYY-MM-DD) in Europe/Paris timezone.
 */
export function getTodayParis(): string {
  return getNowParis().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

/**
 * Check if an event is terminated (10 min after start time), using Paris timezone.
 */
export function isEventTerminatedParis(event: { date: string; time?: string | null }): boolean {
  const now = getNowParis();
  const todayStr = now.toLocaleDateString('en-CA');

  if (event.date > todayStr) return false;
  if (event.date < todayStr) return true;

  const ARCHIVE_DELAY = 10 * 60 * 1000; // 10 minutes

  if (!event.time) {
    // No time set: archive 10 min after midnight
    const midnightStart = new Date(now);
    midnightStart.setHours(0, 0, 0, 0);
    return now.getTime() > midnightStart.getTime() + ARCHIVE_DELAY;
  }

  const [h, m] = event.time.replace('H', ':').replace('h', ':').split(':').map(Number);
  const eventStart = new Date(now);
  eventStart.setHours(h || 0, m || 0, 0, 0);
  return now.getTime() > eventStart.getTime() + ARCHIVE_DELAY;
}
