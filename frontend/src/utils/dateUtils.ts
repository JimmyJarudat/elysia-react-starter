import { format, formatDistance, formatRelative, parseISO } from 'date-fns';
import { th, enUS } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

// พิมพ์ Interface สำหรับ Options ในกรณีที่ไม่มี @types
interface FormatDateOptions {
  timezone?: string;
  locale?: any;
  defaultValue?: string;
}

interface FormatRelativeTimeOptions extends FormatDateOptions {
  baseDate?: Date;
}

interface FormatTimeDistanceOptions {
  locale?: any;
  addSuffix?: boolean;
  defaultValue?: string;
}
// test
// Default timezone is user's browser timezone
let userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Set the user's preferred timezone
 * @param timezone - Timezone string (e.g., 'Asia/Bangkok', 'America/New_York')
 */
export const setUserTimezone = (timezone: string): void => {
  userTimezone = timezone;
};

/**
 * Get the current user timezone
 * @returns Current user timezone string
 */
export const getUserTimezone = (): string => {
  return userTimezone;
};

/**
 * Detect if the current locale is Thai
 * @returns boolean indicating if current locale is Thai
 */
export const isThaiLocale = (): boolean => {
  return navigator.language.startsWith('th');
};

/**
 * Get the appropriate locale object for date-fns
 * @returns locale object for date-fns
 */
export const getLocale = () => {
  return isThaiLocale() ? th : enUS;
};

/**
 * Format a date string to a localized format with timezone conversion
 * @param dateString - ISO date string
 * @param formatString - date-fns format string
 * @param options - Additional options for formatting
 * @returns Formatted date string in user's timezone
 */
export const formatThaiDateTime = (
  dateInput: string | number | null | undefined
): string => {
  if (dateInput === null || dateInput === undefined) return '-';

  try {
    let date: Date;

    if (typeof dateInput === 'number') {
      // timestamp < 10 หลัก → วินาที, else → มิลลิวินาที
      date = new Date(dateInput < 10000000000 ? dateInput * 1000 : dateInput);
    } else {
      date = new Date(dateInput);
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear() + 543; // เปลี่ยนเป็น พ.ศ.
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(dateInput);
  }
};

// - Prisma แปลงเป็น UTC แล้ว เราก็แปลงกลับ formatThaiDateTime
export function fixPrismaUTCToLocal(isoString: string): string {
  const d = new Date(isoString);
  d.setHours(d.getHours() - 7);
  return d.toLocaleString('th-TH'); // ✅ คืน string แล้ว React แสดงได้
}





/**
 * Format a date as a relative time (e.g., "2 hours ago", "yesterday")
 * @param dateString - ISO date string
 * @param options - Additional options for formatting
 * @returns Relative time string in user's timezone
 */
export const formatRelativeTime = (
  dateString: string | null | undefined,
  options: FormatRelativeTimeOptions = {}
): string => {
  if (!dateString) return options.defaultValue || '-';

  try {
    const date = parseISO(dateString);
    const timezone = options.timezone || userTimezone;
    const locale = options.locale || getLocale();
    const baseDate = options.baseDate || new Date();

    // Convert UTC date to user's timezone
    const zonedDate = toZonedTime(date, timezone);
    const zonedBaseDate = toZonedTime(baseDate, timezone);

    return formatRelative(zonedDate, zonedBaseDate, { locale });
  } catch (error) {
    console.error('Error formatting relative date:', error);
    return options.defaultValue || dateString;
  }
};

/**
 * Format time duration (e.g., "2 hours", "3 days")
 * @param dateString - ISO date string
 * @param baseDate - Base date to compare against (default: now)
 * @param options - Additional options
 * @returns Formatted distance between dates
 */
export const formatTimeDistance = (
  dateString: string | null | undefined,
  baseDate: Date | string = new Date(),
  options: FormatTimeDistanceOptions = {}
): string => {
  if (!dateString) return options.defaultValue || '-';

  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    const baseDateObj = typeof baseDate === 'string' ? parseISO(baseDate) : baseDate;
    const locale = options.locale || getLocale();

    return formatDistance(date, baseDateObj, {
      addSuffix: options.addSuffix !== undefined ? options.addSuffix : true,
      locale
    });
  } catch (error) {
    console.error('Error formatting time distance:', error);
    return options.defaultValue || dateString;
  }
};

/**
 * Get a date object from ISO string in user's timezone
 * @param dateString - ISO date string
 * @param timezone - Timezone (default: user's timezone)
 * @returns Date object adjusted to the specified timezone
 */
export const getZonedDate = (
  dateString: string,
  timezone: string = userTimezone
): Date => {
  const date = parseISO(dateString);
  return toZonedTime(date, timezone);
};

/**
 * Format a date for the Thai Buddhist Era (BE) calendar
 * BE year = CE year + 543
 * @param dateString - ISO date string
 * @param formatString - date-fns format string
 * @returns Formatted date string in Thai Buddhist Era
 */
export const formatThaiDate = (
  date: string | Date | null | undefined,
  formatString: string = 'dd MMMM yyyy',
  options: FormatDateOptions = {}
): string => {
  if (!date) return options.defaultValue || '-';

  try {
    // ตรวจสอบรูปแบบ date range (2025-09-01_2025-09-04)
    if (typeof date === 'string' && date.includes('_')) {
      const [startDate, endDate] = date.split('_');

      // Format วันที่เริ่มต้น
      const formattedStartDate = formatThaiDate(startDate, formatString, options);

      // Format วันที่สิ้นสุด
      const formattedEndDate = formatThaiDate(endDate, formatString, options);

      return `${formattedStartDate} ถึง ${formattedEndDate}`;
    }

    // แปลง Date เป็น string ถ้าจำเป็น
    const dateString = date instanceof Date ? date.toISOString() : date;

    // ใช้ parseISO กับ string
    const parsedDate = parseISO(dateString);
    const timezone = options.timezone || userTimezone;

    // Convert UTC date to user's timezone
    const zonedDate = toZonedTime(parsedDate, timezone);

    // Format with Thai locale
    let formattedDate = format(zonedDate, formatString, { locale: th });

    // If format includes year, convert to Buddhist Era
    if (formatString.includes('yyyy')) {
      const ceYear = zonedDate.getFullYear();
      const beYear = ceYear + 543;
      formattedDate = formattedDate.replace(ceYear.toString(), beYear.toString());
    }

    return formattedDate;
  } catch (error) {
    console.error('Error formatting Thai date:', error);
    // ส่งคืนค่าเริ่มต้นหรือค่าเดิมตามประเภทข้อมูล
    return options.defaultValue || (typeof date === 'string' ? date : String(date));
  }
};