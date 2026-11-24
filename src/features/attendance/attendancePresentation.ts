import type { DateFormat } from '@/types/models';
import { formatWorkDate } from '@/utils/time';

export function workDateToUtc(workDate: string): Date {
  return new Date(`${workDate}T00:00:00.000Z`);
}

export function formatAttendanceDate(workDate: string, options: Intl.DateTimeFormatOptions, preference: DateFormat): string {
  return formatWorkDate(workDate, preference, options);
}

export function formatAttendanceHours(seconds: number, includeSeconds = false): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = String(Math.floor((wholeSeconds % 3600) / 60)).padStart(2, '0');
  const remainder = wholeSeconds % 60;
  return `${hours.toLocaleString('en-US')}h ${minutes}m${includeSeconds && remainder ? ` ${remainder}s` : ''}`;
}

export function shiftAttendanceMonth(month: string, offset: number): string {
  const date = workDateToUtc(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function getAttendanceWeeks(month: string): (string | null)[][] {
  const first = workDateToUtc(`${month}-01`);
  const next = workDateToUtc(`${shiftAttendanceMonth(month, 1)}-01`);
  const leading = (first.getUTCDay() + 6) % 7;
  const dayCount = Math.round((next.getTime() - first.getTime()) / 86_400_000);
  const weekCount = Math.ceil((dayCount + leading) / 7);

  return Array.from({ length: weekCount }, (_, week) =>
    Array.from({ length: 7 }, (_, column) => {
      const day = week * 7 + column - leading + 1;
      return day > 0 && day <= dayCount ? `${month}-${String(day).padStart(2, '0')}` : null;
    }),
  );
}
