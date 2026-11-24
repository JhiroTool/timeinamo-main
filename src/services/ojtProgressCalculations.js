/**
 * @param {number} completedSeconds
 * @param {number} requiredMinutes
 * @param {number} completedWorkdays
 * @param {number | null} scheduledMinutesPerDay
 */
export function calculateOjtProgress(
  completedSeconds,
  requiredMinutes,
  completedWorkdays,
  scheduledMinutesPerDay,
) {
  if (!Number.isSafeInteger(completedSeconds) || completedSeconds < 0) {
    throw new RangeError('Completed seconds must be a non-negative integer.');
  }
  if (!Number.isSafeInteger(requiredMinutes) || requiredMinutes <= 0) {
    throw new RangeError('Required minutes must be a positive integer.');
  }
  if (!Number.isSafeInteger(completedWorkdays) || completedWorkdays < 0) {
    throw new RangeError('Completed workdays must be a non-negative integer.');
  }
  if (scheduledMinutesPerDay !== null &&
      (!Number.isSafeInteger(scheduledMinutesPerDay) || scheduledMinutesPerDay <= 0)) {
    throw new RangeError('Scheduled credited minutes must be a positive integer.');
  }

  const requiredSeconds = requiredMinutes * 60;
  const remainingSeconds = Math.max(0, requiredSeconds - completedSeconds);
  return {
    requiredSeconds,
    remainingSeconds,
    percentage: (completedSeconds / requiredSeconds) * 100,
    averageSecondsPerDay:
      completedWorkdays === 0 ? 0 : Math.floor(completedSeconds / completedWorkdays),
    estimatedRemainingWorkdays:
      remainingSeconds === 0
        ? 0
        : scheduledMinutesPerDay === null
          ? null
          : Math.ceil(remainingSeconds / (scheduledMinutesPerDay * 60)),
    goalCompleted: completedSeconds >= requiredSeconds,
  };
}

/** @param {string} workDate */
export function getMondayWeekStart(workDate) {
  const date = new Date(`${workDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new RangeError('Work date is invalid.');
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

/** @param {string} workDate @param {number} days */
export function shiftWorkDate(workDate, days) {
  const date = new Date(`${workDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new RangeError('Work date is invalid.');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * @param {Array<{workDate: string, creditedSeconds: number}>} rows
 * @param {string} currentWorkDate
 * @param {number} [weekCount]
 */
export function buildRecentWeeklyTotals(rows, currentWorkDate, weekCount = 6) {
  if (!Number.isSafeInteger(weekCount) || weekCount <= 0) {
    throw new RangeError('Week count must be a positive integer.');
  }
  const currentWeek = getMondayWeekStart(currentWorkDate);
  const firstWeek = shiftWorkDate(currentWeek, -(weekCount - 1) * 7);
  const totals = Array.from({ length: weekCount }, (_, index) => ({
    weekStart: shiftWorkDate(firstWeek, index * 7),
    creditedSeconds: 0,
    workDates: new Set(),
  }));
  const byWeek = new Map(totals.map((item) => [item.weekStart, item]));
  for (const row of rows) {
    const weekStart = getMondayWeekStart(row.workDate);
    const target = byWeek.get(weekStart);
    if (target) {
      target.creditedSeconds += row.creditedSeconds;
      target.workDates.add(row.workDate);
    }
  }
  return totals.map(({ weekStart, creditedSeconds, workDates }) => ({
    weekStart,
    creditedSeconds,
    completedWorkdays: workDates.size,
  }));
}

/** @param {number} seconds */
export function formatHoursMinutes(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

const decimalHours = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** @param {number} seconds */
export function formatProgressHours(seconds) {
  return seconds > 0 && seconds < 180 ? '<0.1' : decimalHours.format(seconds / 3600);
}

