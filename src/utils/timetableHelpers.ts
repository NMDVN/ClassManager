// --- Pure Helper Functions for Timetable & Date Conversion ---

/**
 * Converts a date string (YYYY-MM-DD or DD/MM/YYYY) or value into Timetable Day (2 = T2, ..., 7 = T7).
 * JavaScript getDay(): 0 = Chủ Nhật, 1 = Thứ Hai, 2 = Thứ Ba, 3 = Thứ Tư, 4 = Thứ Năm, 5 = Thứ Sáu, 6 = Thứ Bảy.
 * Timetable convention: 2 = Thứ Hai, 3 = Thứ Ba, 4 = Thứ Tư, 5 = Thứ Năm, 6 = Thứ Sáu, 7 = Thứ Bảy.
 */
export function getTimetableDay(dateVal: unknown): number | null {
  if (dateVal === undefined || dateVal === null || dateVal === '') return null;

  if (typeof dateVal === 'number') {
    return dateVal >= 2 && dateVal <= 7 ? dateVal : null;
  }

  const str = String(dateVal).trim();

  // 1. Format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) {
      const jsDay = dt.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
      return jsDay >= 1 && jsDay <= 6 ? jsDay + 1 : null;
    }
  }

  // 2. Format: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) {
      const jsDay = dt.getDay();
      return jsDay >= 1 && jsDay <= 6 ? jsDay + 1 : null;
    }
  }

  // 3. String representation: "2", "Thứ 2", "Thứ Hai", etc.
  const s = str.toLowerCase();
  if (s === '2' || s.includes('hai') || s === 'thứ 2' || s === 't2') return 2;
  if (s === '3' || s.includes('ba') || s === 'thứ 3' || s === 't3') return 3;
  if (s === '4' || s.includes('tư') || s.includes('tu') || s.includes('bốn') || s === 'thứ 4' || s === 't4') return 4;
  if (s === '5' || s.includes('năm') || s.includes('nam') || s === 'thứ 5' || s === 't5') return 5;
  if (s === '6' || s.includes('sáu') || s.includes('sau') || s === 'thứ 6' || s === 't6') return 6;
  if (s === '7' || s.includes('bảy') || s.includes('bay') || s === 'thứ 7' || s === 't7') return 7;

  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 2 && num <= 7) return num;

  return null;
}

/**
 * Returns JavaScript day of week: 0 = CN, 1 = T2, ..., 6 = T7.
 * Used for day tab filters.
 */
export function getDayOfWeek(dateVal: unknown): number | null {
  if (dateVal === undefined || dateVal === null || dateVal === '') return null;
  const str = String(dateVal).trim();

  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt.getDay();
  }

  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt.getDay();
  }

  const dt = new Date(str);
  return isNaN(dt.getTime()) ? null : dt.getDay();
}

/**
 * Converts session value / session_id into Timetable session number (1 = Sáng, 2 = Chiều).
 */
export function getTimetableSessionValue(sessionIdOrName: unknown): number {
  if (sessionIdOrName === undefined || sessionIdOrName === null || sessionIdOrName === '') return 0;
  if (typeof sessionIdOrName === 'number') {
    return sessionIdOrName === 1 || sessionIdOrName === 2 ? sessionIdOrName : 0;
  }
  const s = String(sessionIdOrName).trim().toLowerCase();
  if (s === '1' || s.includes('sáng') || s.includes('sang') || s.includes('morning')) return 1;
  if (s === '2' || s.includes('chiều') || s.includes('chieu') || s.includes('afternoon')) return 2;
  const num = parseInt(s, 10);
  return num === 1 || num === 2 ? num : 0;
}

/**
 * Converts period value / period_id into Timetable period number (1..5).
 */
export function getTimetablePeriodValue(periodIdOrName: unknown): number {
  if (periodIdOrName === undefined || periodIdOrName === null || periodIdOrName === '') return 0;
  if (typeof periodIdOrName === 'number') {
    return periodIdOrName >= 1 && periodIdOrName <= 10 ? periodIdOrName : 0;
  }
  const s = String(periodIdOrName).trim();
  const match = s.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return num >= 1 && num <= 10 ? num : 0;
  }
  return 0;
}
