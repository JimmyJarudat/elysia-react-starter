import prisma from '@/config/prisma.config';
import redis from '@/config/redis.config';

const CACHE_KEY = 'regional:settings';
const CACHE_TTL = 300; // 5 min

interface RegionalSettings {
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  yearEra: string;
}

const defaults: RegionalSettings = {
  timezone:   'Asia/Bangkok',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  yearEra:    'CE',
};

async function getRegionalSettings(): Promise<RegionalSettings> {
  // ลอง Redis cache ก่อน
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return JSON.parse(cached) as RegionalSettings;
    } catch { /* fall through */ }
  }

  // ดึงจาก DB
  const rows = await prisma.system_config.findMany({
    where: { id: { in: ['timezone', 'date_format', 'time_format', 'year_era'] }, is_active: true },
    select: { id: true, value: true },
  });

  const map = new Map(rows.map(r => [r.id, r.value]));
  const settings: RegionalSettings = {
    timezone:   map.get('timezone')    ?? defaults.timezone,
    dateFormat: map.get('date_format') ?? defaults.dateFormat,
    timeFormat: map.get('time_format') ?? defaults.timeFormat,
    yearEra:    map.get('year_era')    ?? defaults.yearEra,
  };

  // บันทึก cache
  if (redis) {
    try { await redis.set(CACHE_KEY, JSON.stringify(settings), 'EX', CACHE_TTL); } catch { /* non-critical */ }
  }

  return settings;
}

function buildFormatter(settings: RegionalSettings): (date: Date) => string {
  const { timezone, dateFormat, timeFormat, yearEra } = settings;
  const hour12 = timeFormat === '12h';
  const BE_OFFSET = 543;

  const getYear = (d: Date): string => {
    const y = parseInt(new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: timezone }).format(d), 10);
    return String(yearEra === 'BE' ? y + BE_OFFSET : y);
  };

  const formatDatePart = (d: Date): string => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: timezone,
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    const year = getYear(d);
    switch (dateFormat) {
      case 'YYYY-MM-DD': return `${year}-${get('month')}-${get('day')}`;
      case 'MM/DD/YYYY': return `${get('month')}/${get('day')}/${year}`;
      case 'DD-MM-YYYY': return `${get('day')}-${get('month')}-${year}`;
      case 'YYYY/MM/DD': return `${year}/${get('month')}/${get('day')}`;
      case 'D MMM YYYY': {
        const m = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: timezone }).format(d);
        return `${parseInt(get('day'), 10)} ${m} ${year}`;
      }
      default: return `${get('day')}/${get('month')}/${year}`;
    }
  };

  return (d: Date) => {
    const datePart = formatDatePart(d);
    const timePart = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12, timeZone: timezone }).format(d);
    return `${datePart} ${timePart}`;
  };
}

/** Format วันเวลาตาม regional settings จาก system_config */
export async function formatSystemDate(date?: Date | null): Promise<string> {
  const d = date ?? new Date();
  try {
    const settings = await getRegionalSettings();
    return buildFormatter(settings)(d);
  } catch {
    // fallback ถ้า DB ไม่พร้อม
    return d.toLocaleString('th-TH', { timeZone: defaults.timezone });
  }
}

/** Sync version ใช้ default settings (ไม่ต้องรอ DB) */
export function formatSystemDateSync(date?: Date | null): string {
  const d = date ?? new Date();
  return buildFormatter(defaults)(d);
}
