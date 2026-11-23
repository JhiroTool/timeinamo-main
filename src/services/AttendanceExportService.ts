import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { AttendanceExportRecord } from '@/database/repositories/AttendanceExportRepository';

import { buildAttendanceCsv, createAttendanceCsvFilename } from './csvExport.js';

export interface ShareAttendanceCsvInput {
  records: AttendanceExportRecord[];
  timezone: string;
  includeJournalDescriptions: boolean;
  periodLabel: string;
}

export async function shareAttendanceCsv(input: ShareAttendanceCsvInput): Promise<string> {
  if (input.records.length === 0) throw new Error('There are no attendance records to export.');
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is not available on this device.');
  }
  const filename = createAttendanceCsvFilename(input.periodLabel);
  const file = new File(Paths.cache, filename);
  await file.write(
    buildAttendanceCsv(input.records, {
      timezone: input.timezone,
      includeJournalDescriptions: input.includeJournalDescriptions,
    }),
  );
  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Export TimeInamo attendance',
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
  return filename;
}
