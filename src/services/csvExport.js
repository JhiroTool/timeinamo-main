/** @typedef {{ workDate: string, clockInAt: string, clockOutAt: string | null, breakDurationSeconds: number, workedDurationSeconds: number | null, status: string, entrySource: string, isAdjusted: boolean, journalDescriptions: string[] }} CsvAttendanceRecord */

/**
 * Prevents spreadsheet applications from interpreting user-authored text as a formula.
 * @param {unknown} value
 */
export function protectSpreadsheetCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

/** @param {unknown} value */
export function escapeCsvCell(value) {
  const protectedValue = protectSpreadsheetCell(value);
  return /[",\r\n]/.test(protectedValue)
    ? `"${protectedValue.replace(/"/g, '""')}"`
    : protectedValue;
}

/** @param {number | null} seconds */
function formatHours(seconds) {
  return seconds === null ? '' : (seconds / 3600).toFixed(2);
}

/** @param {string | null} timestamp @param {string} timezone */
function formatLocalTime(timestamp, timezone) {
  if (!timestamp) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const get = (/** @type {string} */ type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')}:${get('second')}`;
}

/** @param {CsvAttendanceRecord} record */
function elapsedSeconds(record) {
  if (!record.clockOutAt) return null;
  return Math.max(
    0,
    Math.floor((new Date(record.clockOutAt).getTime() - new Date(record.clockInAt).getTime()) / 1000),
  );
}

/**
 * @param {CsvAttendanceRecord[]} records
 * @param {{ timezone: string, includeJournalDescriptions: boolean }} options
 */
export function buildAttendanceCsv(records, options) {
  const headers = [
    'Date',
    'Time In',
    'Time Out',
    'Break Minutes',
    'Elapsed Hours',
    'Credited Hours',
    'Status',
    'Source',
    'Corrected',
  ];
  if (options.includeJournalDescriptions) headers.push('Journal Descriptions');

  const rows = records.map((record) => {
    const values = [
      record.workDate,
      formatLocalTime(record.clockInAt, options.timezone),
      formatLocalTime(record.clockOutAt, options.timezone),
      (record.breakDurationSeconds / 60).toFixed(2),
      formatHours(elapsedSeconds(record)),
      formatHours(record.status === 'completed' ? record.workedDurationSeconds : null),
      record.status === 'completed' ? 'Completed' : 'Incomplete',
      record.entrySource === 'manual' ? 'Manual' : 'Automatic',
      record.isAdjusted ? 'Yes' : 'No',
    ];
    if (options.includeJournalDescriptions) {
      values.push(record.journalDescriptions.join('\n'));
    }
    return values.map(escapeCsvCell).join(',');
  });

  return `\uFEFF${[headers.map(escapeCsvCell).join(','), ...rows].join('\r\n')}\r\n`;
}

/** @param {string} periodLabel */
export function createAttendanceCsvFilename(periodLabel) {
  const safePeriod = periodLabel.replace(/[^0-9A-Za-z_-]+/g, '_').replace(/^_+|_+$/g, '');
  return `TimeInamo_Attendance_${safePeriod || 'All'}.csv`;
}
