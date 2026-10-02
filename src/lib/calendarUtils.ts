import { StudentEntry } from '../types';
import { SUBJECTS, entryTotal } from './utils';

export interface DayDetail {
  date: string; // YYYY-MM-DD
  dayNum: number;
  dayName: string; // "Pazartesi", "Salı", etc.
  dayShort: string; // "Pzt", "Sal", etc.
  dayOfWeek: number; // 0 = Pazartesi, 6 = Pazar
  isCurrentMonth: boolean;
  isToday: boolean;
  total: number;
  subjects: Record<string, number>;
  hasEntry: boolean;
}

export interface WeekSummary {
  weekKey: string; // YYYY-MM-DD (Pazartesi)
  mondayDate: Date;
  sundayDate: Date;
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string; // YYYY-MM-DD (Pazar)
  nextMondayDateStr: string; // YYYY-MM-DD (Bir sonraki Pazartesi)
  label: string; // Örn: "28 Ekim – 3 Kasım 2024"
  altLabel: string; // Örn: "28 Ekim – 4 Kasım Arası"
  shortLabel: string; // Örn: "28 Eki – 3 Kas"
  monthKey: string; // YYYY-MM
  monthName: string; // Örn: "Ekim 2024"
  days: DayDetail[];
  totalQuestions: number;
  dailyAverage: number;
  activeDaysCount: number;
  subjectTotals: Record<string, number>;
}

export interface MonthSummary {
  monthKey: string; // YYYY-MM
  monthName: string; // Örn: "Kasım 2024"
  year: number;
  monthIndex: number; // 0..11
  totalQuestions: number;
  weeks: WeekSummary[];
  subjectTotals: Record<string, number>;
  dailyAverage: number;
  totalDaysWithEntries: number;
}

export interface StudentCalendarData {
  grandTotal: number;
  months: MonthSummary[];
  weeks: WeekSummary[];
  currentMonthKey: string;
  currentWeekKey: string;
}

const TURKISH_DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const TURKISH_DAY_SHORTS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const TURKISH_MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

/**
 * Güvenli YYYY-MM-DD ayrıştırma (saat dilimi kayması olmadan)
 */
export function parseISODate(dateStr: string): Date {
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  const y = parts[0];
  const m = parts[1] - 1;
  const d = parts[2] || 1;
  return new Date(y, m, d, 12, 0, 0);
}

/**
 * Date nesnesini YYYY-MM-DD dizesine dönüştürür
 */
export function toISODateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Verilen tarihin haftasının Pazartesi gününü döndürür (Pazartesi = hafta başı)
 */
export function getMondayOfDate(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // 0 = Pazartesi, 6 = Pazar
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day, 12, 0, 0);
  return monday;
}

/**
 * Hafta aralığı metin etiketi üretir.
 * Örn: "28 Ekim – 3 Kasım 2024" ve "28 Ekim – 4 Kasım"
 */
export function formatWeekLabel(monday: Date, sunday: Date): { label: string; altLabel: string; shortLabel: string } {
  const mDay = monday.getDate();
  const mMonth = TURKISH_MONTH_NAMES[monday.getMonth()];
  const mYear = monday.getFullYear();

  const sDay = sunday.getDate();
  const sMonth = TURKISH_MONTH_NAMES[sunday.getMonth()];
  const sYear = sunday.getFullYear();

  const nextMon = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 1, 12, 0, 0);
  const nextMonDay = nextMon.getDate();
  const nextMonMonth = TURKISH_MONTH_NAMES[nextMon.getMonth()];

  let label: string;
  let shortLabel: string;
  if (monday.getMonth() === sunday.getMonth()) {
    label = `${mDay} – ${sDay} ${mMonth} ${mYear}`;
    shortLabel = `${mDay} – ${sDay} ${mMonth.slice(0, 3)}`;
  } else {
    label = `${mDay} ${mMonth} – ${sDay} ${sMonth} ${sYear}`;
    shortLabel = `${mDay} ${mMonth.slice(0, 3)} – ${sDay} ${sMonth.slice(0, 3)}`;
  }

  // Kullanıcıların sık kullandığı "28 Ekim - 4 Kasım" stili
  const altLabel = `${mDay} ${mMonth} – ${nextMonDay} ${nextMonMonth}`;

  return { label, altLabel, shortLabel };
}

/**
 * Ay adı ve yıl etiketi
 */
export function formatMonthName(year: number, monthIndex: number): string {
  return `${TURKISH_MONTH_NAMES[monthIndex]} ${year}`;
}

/**
 * Öğrencinin soru kayıtlarını haftalık ve aylık takvime dönüştürür.
 * Her haftayı (örneğin 28 Ekim - 4 Kasım / 28 Ekim - 3 Kasım) ayrı bir nesne olarak gruplar.
 */
export function buildStudentCalendar(entries: StudentEntry[] = []): StudentCalendarData {
  const entryMap = new Map<string, StudentEntry>();
  entries.forEach((e) => {
    if (e.date) entryMap.set(e.date.slice(0, 10), e);
  });

  const now = new Date();
  const todayStr = toISODateStr(now);
  const currentWeekMonday = getMondayOfDate(now);
  const currentWeekKey = toISODateStr(currentWeekMonday);
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Tüm kayıtlı tarihlerin Pazartesi günlerini tespit et
  const mondaySet = new Set<string>();
  // En azından güncel haftayı ve önceki haftayı ekle
  mondaySet.add(currentWeekKey);
  const prevWeekMonday = new Date(currentWeekMonday.getFullYear(), currentWeekMonday.getMonth(), currentWeekMonday.getDate() - 7, 12, 0, 0);
  mondaySet.add(toISODateStr(prevWeekMonday));

  entryMap.forEach((_, dateStr) => {
    const d = parseISODate(dateStr);
    const mon = getMondayOfDate(d);
    mondaySet.add(toISODateStr(mon));
  });

  // Pazartesi tarihlerini yeniden eskiye sırala
  const sortedMondays = Array.from(mondaySet).sort().reverse();

  const weeks: WeekSummary[] = [];

  sortedMondays.forEach((mondayStr) => {
    const monday = parseISODate(mondayStr);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 12, 0, 0);
    const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7, 12, 0, 0);

    const { label, altLabel, shortLabel } = formatWeekLabel(monday, sunday);

    // Haftanın çoğunluğunun veya Pazartesi'nin ayı
    const midWeek = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3, 12, 0, 0);
    const monthKey = `${midWeek.getFullYear()}-${String(midWeek.getMonth() + 1).padStart(2, '0')}`;
    const monthName = formatMonthName(midWeek.getFullYear(), midWeek.getMonth());

    const days: DayDetail[] = [];
    let weekTotal = 0;
    let activeDays = 0;
    const subjectTotals: Record<string, number> = {};
    SUBJECTS.forEach((s) => {
      subjectTotals[s] = 0;
    });

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const curDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + dayOffset, 12, 0, 0);
      const curStr = toISODateStr(curDate);
      const entry = entryMap.get(curStr);

      const hasEntry = !!entry && !!entry.subjects;
      const daySubjects = entry?.subjects || {};
      const dayTotal = entry ? entryTotal(entry) : 0;

      if (dayTotal > 0) {
        weekTotal += dayTotal;
        activeDays++;
        Object.entries(daySubjects).forEach(([subj, count]) => {
          const num = Number(count) || 0;
          subjectTotals[subj] = (subjectTotals[subj] || 0) + num;
        });
      }

      days.push({
        date: curStr,
        dayNum: curDate.getDate(),
        dayName: TURKISH_DAY_NAMES[dayOffset],
        dayShort: TURKISH_DAY_SHORTS[dayOffset],
        dayOfWeek: dayOffset,
        isCurrentMonth: curDate.getMonth() === midWeek.getMonth(),
        isToday: curStr === todayStr,
        total: dayTotal,
        subjects: daySubjects,
        hasEntry,
      });
    }

    const dailyAverage = activeDays > 0 ? Math.round(weekTotal / activeDays) : 0;

    weeks.push({
      weekKey: mondayStr,
      mondayDate: monday,
      sundayDate: sunday,
      startDateStr: mondayStr,
      endDateStr: toISODateStr(sunday),
      nextMondayDateStr: toISODateStr(nextMonday),
      label,
      altLabel,
      shortLabel,
      monthKey,
      monthName,
      days,
      totalQuestions: weekTotal,
      dailyAverage,
      activeDaysCount: activeDays,
      subjectTotals,
    });
  });

  // Aylara göre grupla
  const monthMap = new Map<string, { year: number; monthIndex: number; weeks: WeekSummary[] }>();

  // Tüm kayıtlı ayları bul
  entryMap.forEach((_, dateStr) => {
    const key = dateStr.slice(0, 7);
    if (!monthMap.has(key)) {
      const [y, m] = key.split('-').map(Number);
      monthMap.set(key, { year: y, monthIndex: m - 1, weeks: [] });
    }
  });

  // Güncel ayı da ekle
  if (!monthMap.has(currentMonthKey)) {
    const [cy, cm] = currentMonthKey.split('-').map(Number);
    monthMap.set(currentMonthKey, { year: cy, monthIndex: cm - 1, weeks: [] });
  }

  // Haftaları aylarla eşleştir
  weeks.forEach((w) => {
    if (!monthMap.has(w.monthKey)) {
      const [wy, wm] = w.monthKey.split('-').map(Number);
      monthMap.set(w.monthKey, { year: wy, monthIndex: wm - 1, weeks: [] });
    }
    monthMap.get(w.monthKey)!.weeks.push(w);
  });

  // Ayları yeniden eskiye sırala
  const sortedMonthKeys = Array.from(monthMap.keys()).sort().reverse();
  const months: MonthSummary[] = [];

  let grandTotal = 0;

  sortedMonthKeys.forEach((mKey) => {
    const mData = monthMap.get(mKey)!;
    let monthTotal = 0;
    let totalDaysWithEntries = 0;
    const subjectTotals: Record<string, number> = {};
    SUBJECTS.forEach((s) => {
      subjectTotals[s] = 0;
    });

    // Bu ayın tüm günlerini entryMap'ten topla (hafta sınırlarından bağımsız kesin ay toplamı)
    entryMap.forEach((entry, dateStr) => {
      if (dateStr.startsWith(mKey)) {
        const total = entryTotal(entry);
        if (total > 0) {
          monthTotal += total;
          totalDaysWithEntries++;
          Object.entries(entry.subjects || {}).forEach(([subj, count]) => {
            const num = Number(count) || 0;
            subjectTotals[subj] = (subjectTotals[subj] || 0) + num;
          });
        }
      }
    });

    grandTotal += monthTotal;

    const dailyAverage = totalDaysWithEntries > 0 ? Math.round(monthTotal / totalDaysWithEntries) : 0;

    months.push({
      monthKey: mKey,
      monthName: formatMonthName(mData.year, mData.monthIndex),
      year: mData.year,
      monthIndex: mData.monthIndex,
      totalQuestions: monthTotal,
      weeks: mData.weeks,
      subjectTotals,
      dailyAverage,
      totalDaysWithEntries,
    });
  });

  return {
    grandTotal,
    months,
    weeks,
    currentMonthKey,
    currentWeekKey,
  };
}
