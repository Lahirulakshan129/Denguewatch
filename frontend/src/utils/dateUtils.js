/**
 * ISO Week calculation & date formatting utilities
 */

export function getIsoWeekRange(week, year) {
  const w = parseInt(week, 10);
  const y = parseInt(year, 10);
  if (!w || !y) return null;

  // Jan 4th is always in ISO Week 1
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const day = jan4.getUTCDay() || 7; // Monday = 1, Sunday = 7
  const monW1 = new Date(jan4);
  monW1.setUTCDate(jan4.getUTCDate() - day + 1);

  // Monday of target ISO week
  const startDate = new Date(monW1);
  startDate.setUTCDate(monW1.getUTCDate() + (w - 1) * 7);

  // Sunday of target ISO week
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);

  return { start: startDate, end: endDate };
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatWeekRange(week, year) {
  const range = getIsoWeekRange(week, year);
  if (!range) return `W${String(week || '').padStart(2, '0')} ${year || ''}`;

  const sMon = MONTHS_SHORT[range.start.getUTCMonth()];
  const sDay = range.start.getUTCDate();
  const eMon = MONTHS_SHORT[range.end.getUTCMonth()];
  const eDay = range.end.getUTCDate();
  const y = range.end.getUTCFullYear();

  if (sMon === eMon) {
    return `${sMon} ${sDay} – ${eDay}, ${y}`;
  }
  return `${sMon} ${sDay} – ${eMon} ${eDay}, ${y}`;
}

export function formatWeekDetailed(week, year) {
  const range = getIsoWeekRange(week, year);
  if (!range) return `Week ${week}, ${year}`;

  const sDayName = DAYS_SHORT[range.start.getUTCDay()];
  const sMon = MONTHS_SHORT[range.start.getUTCMonth()];
  const sDay = range.start.getUTCDate();

  const eDayName = DAYS_SHORT[range.end.getUTCDay()];
  const eMon = MONTHS_SHORT[range.end.getUTCMonth()];
  const eDay = range.end.getUTCDate();
  const y = range.end.getUTCFullYear();

  return `${sDayName}, ${sMon} ${sDay} – ${eDayName}, ${eMon} ${eDay}, ${y}`;
}

export function getIsoWeekAndYear(date = new Date()) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const isoYear = utc.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week = 1 + Math.round(
    ((utc.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7,
  );
  return { year: isoYear, week };
}

export function shiftIsoWeek(year, week, delta) {
  const range = getIsoWeekRange(week, year);
  if (!range) return { year, week };
  const d = new Date(range.start);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return getIsoWeekAndYear(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Last finished ISO week (the week before the current one, or current week on Sunday). */
export function lastCompleteIsoWeek(now = new Date()) {
  const current = getIsoWeekAndYear(now);
  const day = now.getDay();
  // On Sunday (day 0), the current week reaches completion today
  if (day === 0) {
    return current;
  }
  return shiftIsoWeek(current.year, current.week, -1);
}

export function listRecentIsoWeeks(count = 26, now = new Date()) {
  const latest = getIsoWeekAndYear(now);
  const weeks = [];
  for (let i = 0; i < count; i++) {
    weeks.push(shiftIsoWeek(latest.year, latest.week, -i));
  }
  return weeks;
}

export function formatWeekStart(week, year) {
  const range = getIsoWeekRange(week, year);
  if (!range) return '';
  const sMon = MONTHS_SHORT[range.start.getUTCMonth()];
  const sDay = range.start.getUTCDate();
  return `${sMon} ${sDay}, ${range.start.getUTCFullYear()}`;
}
