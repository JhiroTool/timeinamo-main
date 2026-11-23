/**
 * Calculates authoritative attendance durations using whole seconds.
 * @param {string | Date} clockInAt
 * @param {string | Date} clockOutAt
 * @param {number} unpaidBreakSeconds
 */
export function calculateAttendanceDurations(clockInAt, clockOutAt, unpaidBreakSeconds) {
  const startMs = new Date(clockInAt).getTime();
  const endMs = new Date(clockOutAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new RangeError('Time In and Time Out must be valid timestamps.');
  }
  if (!Number.isSafeInteger(unpaidBreakSeconds) || unpaidBreakSeconds < 0) {
    throw new RangeError('Unpaid break must be a non-negative whole number of seconds.');
  }

  const elapsedSeconds = Math.floor((endMs - startMs) / 1000);
  if (elapsedSeconds <= 0) {
    throw new RangeError('Time Out must be later than Time In.');
  }
  if (unpaidBreakSeconds > elapsedSeconds) {
    throw new RangeError('Unpaid break cannot exceed elapsed time.');
  }

  return {
    elapsedSeconds,
    creditedSeconds: elapsedSeconds - unpaidBreakSeconds,
  };
}

/** @param {number} totalSeconds */
export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

