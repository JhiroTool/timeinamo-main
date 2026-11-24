import { z } from 'zod';

import type { SetupData, SaveSetupInput } from '@/database/repositories';
import type { DateFormat, TimeFormat } from '@/types/models';
import { parseWorkDate } from '@/utils/time';

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const wholeNumberPattern = /^\d+$/;
const positiveDecimalPattern = /^(?:\d+|\d+\.\d{1,2})$/;

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isValidWorkDate(value: string): boolean {
  try {
    parseWorkDate(value);
    return true;
  } catch {
    return false;
  }
}

export const setupSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name.').max(100),
    companyName: z.string().trim().min(2, 'Enter the company or establishment.').max(150),
    jobTitle: z.string().trim().max(100),
    workStart: z.string().regex(timePattern, 'Select a valid time in.'),
    workEnd: z.string().regex(timePattern, 'Select a valid time out.'),
    workdays: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one workday.'),
    defaultBreakMinutes: z
      .string()
      .regex(wholeNumberPattern, 'Enter break minutes as a whole number.')
      .refine((value) => Number(value) >= 0 && Number(value) <= 720, 'Use 0–720 minutes.'),
    internshipStartDate: z
      .string()
      .min(1, 'Select your internship start date.')
      .refine(isValidWorkDate, 'Select a valid calendar date.'),
    requiredHours: z
      .string()
      .regex(positiveDecimalPattern, 'Enter a valid number of hours.')
      .refine(
        (value) => Number(value) > 0 && Number(value) <= 10000,
        'Required hours must be between 0 and 10,000.',
      ),
    timezone: z
      .string()
      .trim()
      .min(1, 'Timezone is required.')
      .refine(isValidTimezone, 'Use a valid IANA timezone, such as Asia/Manila.'),
    timeFormat: z.enum(['12h', '24h']),
    dateFormat: z.enum(['mdy', 'dmy', 'ymd']),
  })
  .superRefine((values, context) => {
    const start = timeToMinutes(values.workStart);
    const end = timeToMinutes(values.workEnd);
    const breakMinutes = Number(values.defaultBreakMinutes);
    if (end <= start) {
      context.addIssue({
        code: 'custom',
        path: ['workEnd'],
        message: 'Time out must be later than time in.',
      });
    } else if (scheduledCreditedMinutes(start, end, breakMinutes) <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['defaultBreakMinutes'],
        message: 'Break must be shorter than the scheduled work period.',
      });
    }
  });

export type SetupFormValues = z.infer<typeof setupSchema>;

export const defaultSetupFormValues: SetupFormValues = {
  fullName: '',
  companyName: '',
  jobTitle: '',
  workStart: '08:00',
  workEnd: '15:00',
  workdays: [1, 2, 3, 4, 5],
  defaultBreakMinutes: '60',
  internshipStartDate: '',
  requiredHours: '400',
  timezone: 'Asia/Manila',
  timeFormat: '12h',
  dateFormat: 'mdy',
};

export const setupStepFields: readonly (readonly (keyof SetupFormValues)[])[] = [
  ['fullName', 'companyName', 'jobTitle'],
  ['workStart', 'workEnd', 'workdays', 'defaultBreakMinutes'],
  ['internshipStartDate', 'requiredHours', 'timezone', 'timeFormat', 'dateFormat'],
] as const;

export function timeToMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60).toString().padStart(2, '0');
  const minutes = (value % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function scheduledCreditedMinutes(start: number, end: number, breakMinutes: number): number {
  return end - start - breakMinutes;
}

export function workdaysToMask(days: readonly number[]): number {
  return days.reduce((mask, day) => mask | (1 << day), 0);
}

export function maskToWorkdays(mask: number): number[] {
  return [1, 2, 3, 4, 5, 6, 0].filter((day) => (mask & (1 << day)) !== 0);
}

export function toSaveSetupInput(values: SetupFormValues): SaveSetupInput {
  const start = timeToMinutes(values.workStart);
  const end = timeToMinutes(values.workEnd);
  const breakMinutes = Number(values.defaultBreakMinutes);
  return {
    fullName: values.fullName,
    companyName: values.companyName,
    jobTitle: values.jobTitle || null,
    internshipStartDate: parseWorkDate(values.internshipStartDate),
    requiredMinutes: Math.round(Number(values.requiredHours) * 60),
    workdaysMask: workdaysToMask(values.workdays),
    workStartMinutes: start,
    workEndMinutes: end,
    targetMinutes: scheduledCreditedMinutes(start, end, breakMinutes),
    defaultBreakMinutes: breakMinutes,
    timezone: values.timezone,
    timeFormat: values.timeFormat,
    dateFormat: values.dateFormat,
  };
}

export function setupDataToFormValues(data: SetupData): SetupFormValues {
  return {
    fullName: data.profile.fullName,
    companyName: data.profile.companyName ?? '',
    jobTitle: data.profile.jobTitle ?? '',
    workStart: minutesToTime(data.workSettings.workStartMinutes),
    workEnd: minutesToTime(data.workSettings.workEndMinutes),
    workdays: maskToWorkdays(data.workSettings.workdaysMask),
    defaultBreakMinutes: String(data.workSettings.defaultBreakMinutes),
    internshipStartDate: data.profile.internshipStartDate ?? '',
    requiredHours: data.profile.requiredMinutes
      ? String(Number((data.profile.requiredMinutes / 60).toFixed(2)))
      : '',
    timezone: data.workSettings.timezone,
    timeFormat: data.workSettings.timeFormat as TimeFormat,
    dateFormat: data.workSettings.dateFormat as DateFormat,
  };
}

