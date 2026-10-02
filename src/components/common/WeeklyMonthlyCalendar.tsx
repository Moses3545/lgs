import React, { useState, useMemo } from 'react';
import { Calendar, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CheckCircle2, BookOpen, BarChart3, ListFilter } from 'lucide-react';
import { StudentEntry } from '../../types';
import { SUBJECTS } from '../../lib/utils';
import {
  buildStudentCalendar,
  toISODateStr,
  parseISODate,
  formatMonthName,
} from '../../lib/calendarUtils';
import { exportWeeklyCalendarExcel } from '../../lib/excel';

interface WeeklyMonthlyCalendarProps {
  studentName: string;
  entries: StudentEntry[];
  dailyTarget?: number | null;
  onSelectDate?: (dateStr: string) => void;
}

type ViewMode = 'week-boxes' | 'calendar-grid' | 'month-boxes';

export const WeeklyMonthlyCalendar: React.FC<WeeklyMonthlyCalendarProps> = ({
  studentName,
  entries,
  dailyTarget,
  onSelectDate,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('week-boxes');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(null);
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(() => {
    if (entries && entries.length > 0) {
      const sorted = entries.slice().sort((a, b) => b.date.localeCompare(a.date));
      return parseISODate(sorted[0].date);
    }
    return new Date();
  });
  const [exporting, setExporting] = useState(false);

  // Takvim ve hafta verilerini oluştur
  const calendarData = useMemo(() => {
    return buildStudentCalendar(entries);
  }, [entries]);

  // Filtrelenen haftalar
  const filteredWeeks = useMemo(() => {
    if (selectedMonthFilter === 'all') {
      return calendarData.weeks;
    }
    return calendarData.weeks.filter(
      (w) =>
        w.monthKey === selectedMonthFilter ||
        w.startDateStr.startsWith(selectedMonthFilter) ||
        w.endDateStr.startsWith(selectedMonthFilter)
    );
  }, [calendarData.weeks, selectedMonthFilter]);

  // Seçili ayın toplamı
  const selectedMonthSummary = useMemo(() => {
    if (selectedMonthFilter === 'all') return null;
    return calendarData.months.find((m) => m.monthKey === selectedMonthFilter) || null;
  }, [calendarData.months, selectedMonthFilter]);

  // En son hafta (Bu Hafta)
  const latestWeek = calendarData.weeks[0] || null;

  // Bugün çözülen soru sayısı
  const todayDateStr = useMemo(() => toISODateStr(new Date()), []);
  const todayTotal = useMemo(() => {
    return entries
      .filter((e) => (e.date || '').slice(0, 10) === todayDateStr)
      .reduce((sum, e) => {
        const subTotal = Object.values(e.subjects || {}).reduce((a, b) => a + (Number(b) || 0), 0);
        return sum + subTotal;
      }, 0);
  }, [entries, todayDateStr]);

  // Excel Dışa Aktarma
  const handleExport = async () => {
    setExporting(true);
    try {
      await exportWeeklyCalendarExcel(
        studentName,
        calendarData.weeks,
        calendarData.months,
        calendarData.grandTotal,
        dailyTarget
      );
    } catch (e) {
      console.error(e);
      alert('Excel takvim raporu indirilirken hata oluştu.');
    } finally {
      setExporting(false);
    }
  };

  // Ay takvimi hesaplaması (Pazartesi başlangıçlı)
  const calendarGrid = useMemo(() => {
    const year = calendarMonthDate.getFullYear();
    const month = calendarMonthDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0);
    const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0);

    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    const startCalendar = new Date(year, month, 1 - startDayOfWeek, 12, 0, 0);

    const entryMap = new Map<string, number>();
    entries.forEach((e) => {
      const tot = Object.values(e.subjects || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      if (tot > 0) entryMap.set(e.date.slice(0, 10), tot);
    });

    const rows: {
      weekKey: string;
      weekLabel: string;
      weekTotal: number;
      days: {
        dateStr: string;
        dayNum: number;
        isCurrentMonth: boolean;
        isToday: boolean;
        total: number;
        hasTargetHit: boolean;
      }[];
    }[] = [];

    const nowStr = toISODateStr(new Date());
    let currentDayCursor = new Date(startCalendar);

    while (
      currentDayCursor <= lastDayOfMonth ||
      (currentDayCursor.getDay() + 6) % 7 !== 0
    ) {
      const weekDays: typeof rows[0]['days'] = [];
      let weekTotal = 0;
      const weekMondayStr = toISODateStr(currentDayCursor);

      for (let i = 0; i < 7; i++) {
        const dStr = toISODateStr(currentDayCursor);
        const qCount = entryMap.get(dStr) || 0;
        weekTotal += qCount;
        const isCurMonth = currentDayCursor.getMonth() === month;

        weekDays.push({
          dateStr: dStr,
          dayNum: currentDayCursor.getDate(),
          isCurrentMonth: isCurMonth,
          isToday: dStr === nowStr,
          total: qCount,
          hasTargetHit: dailyTarget != null && dailyTarget > 0 ? qCount >= dailyTarget : false,
        });

        currentDayCursor = new Date(
          currentDayCursor.getFullYear(),
          currentDayCursor.getMonth(),
          currentDayCursor.getDate() + 1,
          12,
          0,
          0
        );
      }

      const weekSun = new Date(
        parseISODate(weekMondayStr).getFullYear(),
        parseISODate(weekMondayStr).getMonth(),
        parseISODate(weekMondayStr).getDate() + 6,
        12,
        0,
        0
      );
      const weekLabel = `${parseISODate(weekMondayStr).getDate()} - ${weekSun.getDate()} ${TURKISH_MONTH_NAMES_SHORT[weekSun.getMonth()]}`;

      rows.push({
        weekKey: weekMondayStr,
        weekLabel,
        weekTotal,
        days: weekDays,
      });

      if (currentDayCursor > lastDayOfMonth && (currentDayCursor.getDay() + 6) % 7 === 0) {
        break;
      }
    }

    return rows;
  }, [calendarMonthDate, entries, dailyTarget]);

  return (
    <div className="space-y-4">
      {/* 1. BÖLÜM: BÜYÜK ÖZET İSTATİSTİK KUTUCUKLARI (CANLI RENKLER) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs uppercase tracking-wide text-[#8E8E93] font-bold flex items-center gap-1.5">
            <span>✨</span> GENEL İSTATİSTİKLER
          </span>

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || calendarData.grandTotal === 0}
            className="ios-press inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-105 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'İndiriliyor…' : 'Takvimi İndir (Excel)'}</span>
          </button>
        </div>

        {/* 4 Canlı Özet Kutucuğu: GÜN, HAFTA, AY, TÜM ZAMANLAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* 1. GÜN: Bugün */}
          <div className="bg-gradient-to-br from-[#007AFF] via-[#3B82F6] to-[#4F46E5] text-white rounded-2xl p-3.5 text-center flex flex-col justify-between shadow-md shadow-blue-500/20 hover:scale-[1.02] transition-all">
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-100 flex items-center justify-center gap-1">
              <span>☀️</span> Bugün
            </div>
            <div className="font-mono text-xl sm:text-2xl font-black tracking-tight my-1 drop-shadow-xs">
              {todayTotal.toLocaleString('tr-TR')}
            </div>
            <div className="text-[10px] font-bold bg-white/20 text-white py-0.5 px-2.5 rounded-full mx-auto backdrop-blur-xs">
              {dailyTarget && dailyTarget > 0
                ? (todayTotal >= dailyTarget ? '🎯 Hedef Tamam' : `Hedef: ${dailyTarget}`)
                : 'Bugünkü Soru'}
            </div>
          </div>

          {/* 2. HAFTA: Bu Hafta */}
          <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white rounded-2xl p-3.5 text-center flex flex-col justify-between shadow-md shadow-orange-500/20 hover:scale-[1.02] transition-all">
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-100 flex items-center justify-center gap-1">
              <span>⚡</span> {latestWeek ? latestWeek.shortLabel : 'Bu Hafta'}
            </div>
            <div className="font-mono text-xl sm:text-2xl font-black tracking-tight my-1 drop-shadow-xs">
              {(latestWeek ? latestWeek.totalQuestions : 0).toLocaleString('tr-TR')}
            </div>
            <div className="text-[10px] font-bold bg-white/20 text-white py-0.5 px-2.5 rounded-full mx-auto backdrop-blur-xs">
              {latestWeek ? `${latestWeek.activeDaysCount} gün aktif` : 'Hafta Toplamı'}
            </div>
          </div>

          {/* 3. AY: Bu Ay */}
          <div className="bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white rounded-2xl p-3.5 text-center flex flex-col justify-between shadow-md shadow-emerald-500/20 hover:scale-[1.02] transition-all">
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-100 flex items-center justify-center gap-1">
              <span>📅</span> {selectedMonthSummary ? selectedMonthSummary.monthName : (calendarData.months[0]?.monthName || 'Bu Ay')}
            </div>
            <div className="font-mono text-xl sm:text-2xl font-black tracking-tight my-1 drop-shadow-xs">
              {(selectedMonthSummary
                ? selectedMonthSummary.totalQuestions
                : (calendarData.months[0]?.totalQuestions || 0)
              ).toLocaleString('tr-TR')}
            </div>
            <div className="text-[10px] font-bold bg-white/20 text-white py-0.5 px-2.5 rounded-full mx-auto backdrop-blur-xs">
              Aylık Soru
            </div>
          </div>

          {/* 4. TÜM ZAMANLAR */}
          <div className="bg-gradient-to-br from-purple-500 via-indigo-600 to-purple-700 text-white rounded-2xl p-3.5 text-center flex flex-col justify-between shadow-md shadow-purple-500/20 hover:scale-[1.02] transition-all">
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-100 flex items-center justify-center gap-1">
              <span>🌟</span> Tüm Zamanlar
            </div>
            <div className="font-mono text-xl sm:text-2xl font-black tracking-tight my-1 drop-shadow-xs">
              {calendarData.grandTotal.toLocaleString('tr-TR')}
            </div>
            <div className="text-[10px] font-bold bg-white/20 text-white py-0.5 px-2.5 rounded-full mx-auto backdrop-blur-xs">
              Toplam Soru
            </div>
          </div>
        </div>
      </div>

      {/* 2. BÖLÜM: HAFTA ARALIKLARINA GÖRE AYRI AYRI KUTUCUKLAR */}
      <div className="notebook-card space-y-4">
        {/* Başlık ve Görünüm Seçici (iOS Segmented Control) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-ink/8 pb-3.5">
          <div className="min-w-0">
            <h3 className="font-serif text-lg sm:text-xl font-bold text-ink flex items-center gap-2">
              <span>Hafta Aralıklarına Göre Soru Çözümleri</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Her hafta yeni soru girişi olduğunda ayrı bir kutucukta listelenir.
            </p>
          </div>

          {/* Görünüm Değiştirici Butonlar: iOS Segmented Control */}
          <div className="inline-flex max-w-full overflow-x-auto rounded-2xl bg-ink/5 p-1 border border-ink/8 text-xs self-start lg:self-auto shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('week-boxes')}
              className={`ios-press flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                viewMode === 'week-boxes'
                  ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                  : 'text-muted hover:text-ink font-semibold'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Hafta Kutuları</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('month-boxes')}
              className={`ios-press flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                viewMode === 'month-boxes'
                  ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                  : 'text-muted hover:text-ink font-semibold'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Aylık Kutular</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('calendar-grid')}
              className={`ios-press flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                viewMode === 'calendar-grid'
                  ? 'bg-white text-ink shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                  : 'text-muted hover:text-ink font-semibold'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Takvim Izgarası</span>
            </button>
          </div>
        </div>

        {/* Ay Filtreleme Hapları */}
        {viewMode === 'week-boxes' && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setSelectedMonthFilter('all')}
              className={`ios-press px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedMonthFilter === 'all'
                  ? 'bg-ink text-white shadow-xs'
                  : 'bg-cream/80 text-muted hover:text-ink border border-ink/10'
              }`}
            >
              Tüm Haftalar ({calendarData.weeks.length})
            </button>

            {calendarData.months.map((m) => (
              <button
                key={m.monthKey}
                type="button"
                onClick={() => setSelectedMonthFilter(m.monthKey)}
                className={`ios-press px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  selectedMonthFilter === m.monthKey
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-cream/80 text-muted hover:text-ink border border-ink/10'
                }`}
              >
                {m.monthName} ({m.totalQuestions} soru)
              </button>
            ))}
          </div>
        )}

        {/* 2.1: HAFTA KUTUCUKLARI GÖRÜNÜMÜ (HER HAFTA AYRI BİR KUTU) */}
        {viewMode === 'week-boxes' && (
          <div className="space-y-3 pt-1">
            {filteredWeeks.length === 0 ? (
              <div className="text-center py-10 text-muted text-xs bg-cream/40 rounded-xl border border-dashed border-ink/20">
                Seçili filtrede soru kaydı bulunamadı.
              </div>
            ) : (
              filteredWeeks.map((week, index) => {
                const isExpanded = expandedWeekKey === week.weekKey;
                const hasQuestions = week.totalQuestions > 0;
                // Kullanıcının özellikle belirttiği 28 Ekim - 4 Kasım haftası kontrolü
                const isOctoberEndWeek = week.startDateStr === '2024-10-28';

                return (
                  <div
                    key={week.weekKey}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                      isOctoberEndWeek
                        ? 'border-blue-500/40 bg-white shadow-md ring-2 ring-blue-500/20'
                        : hasQuestions
                        ? 'border-ink/15 bg-white shadow-xs hover:border-ink/30 hover:shadow-sm'
                        : 'border-ink/10 bg-cream/20 opacity-75'
                    }`}
                  >
                    {/* Kutucuk Üst Başlığı (Hafta Aralığı ve Toplam) */}
                    <div className="p-2.5 sm:p-4 bg-gradient-to-r from-cream/40 via-white to-cream/20 border-b border-ink/10">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="font-serif font-bold text-sm sm:text-lg text-ink">
                              {week.label}
                            </span>

                            {/* 28 Ekim - 4 Kasım Dönemi Özel Rozeti */}
                            {isOctoberEndWeek && (
                              <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                                ★ 28 Ekim – 4 Kasım Dönemi
                              </span>
                            )}

                            {index === 0 && !isOctoberEndWeek && (
                              <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                En Son Hafta
                              </span>
                            )}

                            {week.activeDaysCount === 7 && (
                              <span className="font-mono text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                7 Gün Tam
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] sm:text-xs text-muted mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="font-medium text-ink/80">{week.monthName}</span>
                            <span>•</span>
                            <span>{week.activeDaysCount} gün soru girildi</span>
                            {week.dailyAverage > 0 && (
                              <>
                                <span>•</span>
                                <span className="font-mono font-medium text-ink">
                                  Günlük Ort. {week.dailyAverage} soru
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Toplam Soru Sayısı Kutusu */}
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-ink/5">
                          <div className="bg-slate-100/90 border border-slate-200/80 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl text-right">
                            <div className="text-[9px] sm:text-[10px] font-mono uppercase text-slate-500 font-bold">
                              Hafta Toplamı
                            </div>
                            <div className="font-mono text-lg sm:text-2xl font-black text-[#1C1C1E]">
                              {week.totalQuestions.toLocaleString('tr-TR')}
                              <span className="text-[10px] sm:text-xs font-normal text-muted ml-1">soru</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Kutucuk İçi: 7 Günlük Hap Izgarası (Pzt - Paz) */}
                    <div className="p-1.5 sm:p-3 bg-paper">
                      <div className="text-[10px] sm:text-[11px] font-mono uppercase text-muted font-bold mb-1.5 sm:mb-2 flex items-center justify-between">
                        <span>GÜNLÜK ÇÖZÜLEN SORULAR</span>
                        <span className="text-[9px] sm:text-[10px] font-normal text-muted/80">
                          Pzt – Paz Dağılımı
                        </span>
                      </div>

                      <div className="grid grid-cols-7 gap-0.5 sm:gap-2 text-center">
                        {week.days.map((day) => {
                          const hasCount = day.total > 0;
                          const isHit = dailyTarget != null && day.total >= dailyTarget;

                          return (
                            <div
                              key={day.date}
                              onClick={() => onSelectDate && onSelectDate(day.date)}
                              className={`py-1.5 px-0.5 sm:p-2 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer min-w-0 ${
                                isHit
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                                  : hasCount
                                  ? 'bg-cream/60 text-ink border border-ink/15 hover:bg-cream'
                                  : 'bg-transparent text-muted/40 border border-ink/5'
                              }`}
                              title={`${day.date} (${day.dayName}): ${day.total} soru`}
                            >
                              <span className="text-[9px] sm:text-[10px] font-mono uppercase font-bold tracking-tight text-muted truncate">
                                {day.dayShort}
                              </span>
                              <span className="text-[8px] sm:text-[10px] font-mono text-muted/70">
                                {day.dayNum}
                              </span>
                              <span
                                className={`text-[11px] sm:text-sm font-mono mt-0.5 sm:mt-1 ${
                                  hasCount ? 'font-bold text-[#1C1C1E]' : 'text-muted/40 font-normal'
                                }`}
                              >
                                {hasCount ? day.total : '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Kutucuk İçi: Ders Dağılımı Rozetleri */}
                    <div className="px-2.5 sm:px-3.5 py-2 bg-cream/30 border-t border-ink/10 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                        <span className="text-[10px] sm:text-[11px] font-semibold text-muted mr-0.5">Dersler:</span>
                        {SUBJECTS.map((subj) => {
                          const count = week.subjectTotals[subj] || 0;
                          if (count === 0) return null;
                          return (
                            <span
                              key={subj}
                              className="font-mono text-[10px] sm:text-[11px] bg-white text-ink px-1.5 sm:px-2 py-0.5 rounded border border-ink/15 font-medium flex items-center gap-1"
                            >
                              <span className="text-muted text-[9px] sm:text-[10px]">{subj.slice(0, 3)}:</span>
                              <span className="font-bold text-[#1C1C1E]">{count}</span>
                            </span>
                          );
                        })}
                        {Object.values(week.subjectTotals).every((c) => c === 0) && (
                          <span className="text-[10px] sm:text-[11px] text-muted italic">Ders girişi yok</span>
                        )}
                      </div>

                      {/* Ayrıntıları Aç/Kapat Butonu */}
                      <button
                        type="button"
                        onClick={() => setExpandedWeekKey(isExpanded ? null : week.weekKey)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline ml-auto"
                      >
                        <span>{isExpanded ? 'Detayları Gizle' : 'Ders Tablosunu Gör'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Genişletilmiş Bölüm: Detaylı Ders Tablosu */}
                    {isExpanded && (
                      <div className="p-3 sm:p-4 bg-paper border-t border-ink/10 animate-fadeIn space-y-3">
                        <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                          <span>Bu Haftanın Detaylı Ders Dağılım Tablosu</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {SUBJECTS.map((subj) => {
                            const count = week.subjectTotals[subj] || 0;
                            const pct =
                              week.totalQuestions > 0
                                ? Math.round((count / week.totalQuestions) * 100)
                                : 0;

                            return (
                              <div
                                key={subj}
                                className="bg-cream/60 rounded-lg p-2 sm:p-2.5 border border-ink/10 text-xs"
                              >
                                <div className="flex justify-between items-center text-[11px] mb-1 font-semibold">
                                  <span className="text-ink truncate pr-1">{subj}</span>
                                  <span className="font-mono text-[#1C1C1E] font-bold">{count}</span>
                                </div>
                                <div className="w-full bg-ink/10 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-blue-600 h-full rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <div className="text-[10px] text-muted text-right font-mono mt-0.5">
                                  %{pct}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2.2: AYLIK KUTUCUKLAR GÖRÜNÜMÜ */}
        {viewMode === 'month-boxes' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {calendarData.months.map((m) => {
              return (
                <div
                  key={m.monthKey}
                  className="rounded-xl border border-ink/15 bg-white p-3.5 sm:p-4 shadow-xs hover:border-blue-500/40 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-ink/10 pb-2.5">
                    <div>
                      <h4 className="font-serif font-bold text-base sm:text-lg text-ink">{m.monthName}</h4>
                      <p className="text-xs text-muted">
                        {m.weeks.length} hafta aralığı • {m.totalDaysWithEntries} gün soru çözüldü
                      </p>
                    </div>

                    <div className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-right">
                      <div className="font-mono text-lg sm:text-xl font-black text-[#1C1C1E]">
                        {m.totalQuestions.toLocaleString('tr-TR')}
                      </div>
                      <div className="text-[9px] font-mono text-muted">toplam soru</div>
                    </div>
                  </div>

                  {/* Bu ayın haftaları */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-mono uppercase text-muted font-bold">
                      Hafta Dağılımı
                    </div>
                    {m.weeks.map((w) => (
                      <div
                        key={w.weekKey}
                        className="flex items-center justify-between text-xs p-2 rounded-md bg-cream/40 hover:bg-cream/80 transition-colors"
                      >
                        <span className="font-medium text-ink">{w.label}</span>
                        <span className="font-mono font-bold text-[#1C1C1E]">
                          {w.totalQuestions.toLocaleString('tr-TR')} soru
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2.3: TAKVİM IZGARASI GÖRÜNÜMÜ */}
        {viewMode === 'calendar-grid' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between bg-cream/70 p-2 sm:p-2.5 rounded-lg border border-ink/10">
              <button
                type="button"
                onClick={() => {
                  const prev = new Date(
                    calendarMonthDate.getFullYear(),
                    calendarMonthDate.getMonth() - 1,
                    1,
                    12,
                    0,
                    0
                  );
                  setCalendarMonthDate(prev);
                }}
                className="p-1.5 text-muted hover:text-ink hover:bg-white rounded transition-colors"
                title="Önceki Ay"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center">
                <span className="font-serif font-bold text-sm sm:text-base text-ink">
                  {formatMonthName(
                    calendarMonthDate.getFullYear(),
                    calendarMonthDate.getMonth()
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = new Date(
                    calendarMonthDate.getFullYear(),
                    calendarMonthDate.getMonth() + 1,
                    1,
                    12,
                    0,
                    0
                  );
                  setCalendarMonthDate(next);
                }}
                className="p-1.5 text-muted hover:text-ink hover:bg-white rounded transition-colors"
                title="Sonraki Ay"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="border-b border-ink/15 text-muted font-mono uppercase text-[9px] sm:text-[10px]">
                    <th className="py-1.5 px-0.5 sm:py-2 sm:px-1">Pzt</th>
                    <th className="py-1.5 px-0.5 sm:py-2 sm:px-1">Sal</th>
                    <th className="py-1.5 px-0.5 sm:py-2 sm:px-1">Çar</th>
                    <th className="py-1.5 px-0.5 sm:py-2 sm:px-1">Per</th>
                    <th className="py-1.5 px-0.5 sm:py-2 sm:px-1">Cum</th>
                    <th className="py-1.5 px-0.5 sm:py-2 sm:px-1">Cmt</th>
                    <th className="py-1.5 px-0.5 sm:py-2 sm:px-1">Paz</th>
                    <th className="py-1.5 px-1 sm:py-2 sm:px-2 text-right bg-cream/60 text-ink font-bold rounded-r">
                      <span className="hidden sm:inline">Haftalık Toplam</span>
                      <span className="sm:hidden">Toplam</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {calendarGrid.map((row) => (
                    <tr key={row.weekKey} className="hover:bg-cream/30 transition-colors">
                      {row.days.map((day) => {
                        const hasCount = day.total > 0;

                        return (
                          <td
                            key={day.dateStr}
                            onClick={() => onSelectDate && onSelectDate(day.dateStr)}
                            className={`py-1 px-0.5 sm:py-2 sm:px-1 text-xs cursor-pointer ${
                              !day.isCurrentMonth ? 'opacity-30' : ''
                            }`}
                          >
                            <div
                              className={`mx-auto w-7 sm:w-9 h-8 sm:h-10 rounded flex flex-col items-center justify-center p-0.5 ${
                                day.hasTargetHit
                                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                                  : hasCount
                                  ? 'bg-white text-ink border border-ink/20 font-semibold shadow-xs'
                                  : day.isToday
                                  ? 'border border-amber-300 bg-amber-50/50'
                                  : ''
                              }`}
                            >
                              <span className="text-[9px] sm:text-[10px] text-muted leading-none">
                                {day.dayNum}
                              </span>
                              <span
                                className={`text-[10px] sm:text-[11px] font-mono leading-tight mt-0.5 ${
                                  hasCount ? 'font-bold text-[#1C1C1E]' : 'text-transparent'
                                }`}
                              >
                                {hasCount ? day.total : 0}
                              </span>
                            </div>
                          </td>
                        );
                      })}

                      <td className="py-1 px-1 sm:py-2 sm:px-2 text-right bg-cream/40 border-l border-ink/10">
                        <div className="font-mono text-xs sm:text-sm font-bold text-[#1C1C1E]">
                          {row.weekTotal > 0 ? (
                            <span>
                              {row.weekTotal.toLocaleString('tr-TR')}
                            </span>
                          ) : (
                            <span className="text-muted/40">0</span>
                          )}
                        </div>
                        <div className="text-[8px] sm:text-[9px] text-muted font-mono">{row.weekLabel}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TURKISH_MONTH_NAMES_SHORT = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
];
