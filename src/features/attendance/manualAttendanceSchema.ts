import { z } from 'zod';

import type { AttendanceSession } from '@/types/models';
import { getZonedDateTimeParts } from '@/utils/time';

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const manualAttendanceFields = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid work date.'),
  timeIn: z.string().regex(timePattern, 'Select a valid Time In.'),
  timeOut: z.string().regex(timePattern, 'Select a valid Time Out.'),
  breakMinutes: z
    .string()
    .regex(/^\d+$/, 'Break must use whole minutes.')
    .refine((value) => Number(value) >= 0 && Number(value) <= 720, 'Use 0–720 minutes.'),
  reason: z.string(),
});

function validateDurations(
  values: z.infer<typeof manualAttendanceFields>,
  context: z.RefinementCtx,
) {
  const [inHours = '0', inMinutes = '0'] = values.timeIn.split(':');
  const [outHours = '0', outMinutes = '0'] = values.timeOut.split(':');
  const start = Number(inHours) * 60 + Number(inMinutes);
  const end = Number(outHours) * 60 + Number(outMinutes);
  if (end <= start) {
    context.addIssue({ code: 'custom', path: ['timeOut'], message: 'Time Out must be after Time In.' });
    return;
  }
  if (Number(values.breakMinutes) > end - start) {
    context.addIssue({
      code: 'custom',
      path: ['breakMinutes'],
      message: 'Break cannot exceed elapsed time.',
    });
  }
}

export const manualAttendanceSchema = manualAttendanceFields.superRefine(validateDurations);

export const correctionAttendanceSchema = manualAttendanceFields
  .extend({
    reason: z.string().trim().min(5, 'Explain the correction in at least 5 characters.').max(500),
  })
  .superRefine(validateDurations);

export type ManualAttendanceFormValues = z.infer<typeof manualAttendanceSchema>;

export function sessionToManualForm(
  session: AttendanceSession,
  timezone: string,
): ManualAttendanceFormValues {
  const clockIn = getZonedDateTimeParts(session.clockInAt, timezone);
  const clockOut = session.clockOutAt
    ? getZonedDateTimeParts(session.clockOutAt, timezone)
    : { date: clockIn.date, time: '' };
  return {
    workDate: session.workDate,
    timeIn: clockIn.time,
    timeOut: clockOut.time,
    breakMinutes: String(Math.floor(session.breakDurationSeconds / 60)),
    reason: '',
  };
}

