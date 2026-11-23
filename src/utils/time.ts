import type { UtcTimestamp, WorkDate } from '@/types/time';

export function toUtcTimestamp(value: Date | string = new Date()): UtcTimestamp {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('A valid date is required.');
  }
  return date.toISOString() as UtcTimestamp;
}

export function assertValidTimeZone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
  } catch {
    throw new RangeError(`Invalid IANA timezone: ${timezone}`);
  }
}

export function toWorkDate(
  value: Date | string | UtcTimestamp,
  timezone: string,
): WorkDate {
  assertValidTimeZone(timezone);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('A valid timestamp is required.');
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}` as WorkDate;
}

export function parseWorkDate(value: string): WorkDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new RangeError('Work date must use YYYY-MM-DD.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new RangeError('Work date is not a valid calendar date.');
  }
  return value as WorkDate;
}

export function getZonedDateTimeParts(
  value: Date | string,
  timezone: string,
): { date: WorkDate; time: string } {
  assertValidTimeZone(timezone);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError('A valid timestamp is required.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: parseWorkDate(`${values.year}-${values.month}-${values.day}`),
    time: `${values.hour}:${values.minute}`,
  };
}

export function zonedDateTimeToUtc(
  workDate: string,
  time: string,
  timezone: string,
): Date {
  const validDate = parseWorkDate(workDate);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!timeMatch) throw new RangeError('Time must use HH:mm.');
  assertValidTimeZone(timezone);

  const year = Number(validDate.slice(0, 4));
  const month = Number(validDate.slice(5, 7));
  const day = Number(validDate.slice(8, 10));
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const desiredWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let candidateMs = desiredWallTime;

  // Iteratively resolve the timezone offset without relying on the device timezone.
  for (let index = 0; index < 3; index += 1) {
    const candidate = getZonedDateTimeParts(new Date(candidateMs), timezone);
    const candidateYear = Number(candidate.date.slice(0, 4));
    const candidateMonth = Number(candidate.date.slice(5, 7));
    const candidateDay = Number(candidate.date.slice(8, 10));
    const candidateHour = Number(candidate.time.slice(0, 2));
    const candidateMinute = Number(candidate.time.slice(3, 5));
    const candidateWallTime = Date.UTC(
      candidateYear,
      candidateMonth - 1,
      candidateDay,
      candidateHour,
      candidateMinute,
    );
    candidateMs += desiredWallTime - candidateWallTime;
  }

  const result = new Date(candidateMs);
  const verification = getZonedDateTimeParts(result, timezone);
  if (verification.date !== validDate || verification.time !== time) {
    throw new RangeError('That local time does not exist in the configured timezone.');
  }
  return result;
}

