import ExcelJS from 'exceljs';
import { Student, StudentEntry } from '../types';
import { SUBJECTS, fmtDate, fmtDateTime, todayStr, entryTotal, weekRange, inRange, sumEntries } from './utils';
import { WeekSummary, MonthSummary, toISODateStr } from './calendarUtils';

// ExcelJS Dosya İndirme Yardımcı Fonksiyonu
async function saveWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ExcelJS: Admin - Tüm Öğretmenlerin Öğrencilerini Aktar
export async function exportAllStudentsByAdmin(students: Student[], filename = `tum-ogrenciler-${todayStr()}.xlsx`) {
  const wb = new ExcelJS.Workbook();

  // 1. Öğrenciler
  const wsStudents = wb.addWorksheet('Öğrenciler');
  wsStudents.columns = [
    { header: 'Ad Soyad', key: 'name', width: 24 },
    { header: 'Öğretmen', key: 'teacher', width: 20 },
    { header: 'Günlük Hedef', key: 'target', width: 14 },
    { header: 'Son Giriş', key: 'last_entry', width: 16 },
    { header: 'Eklenme Tarihi', key: 'created_at', width: 16 },
    { header: 'Haftaya Dair Plan ve Öneriler', key: 'plan', width: 32 },
    { header: 'Rehberlik Görüş ve Öneriler', key: 'guidance', width: 32 },
  ];
  wsStudents.getRow(1).font = { bold: true };
  students.forEach((s) => {
    wsStudents.addRow({
      name: s.name,
      teacher: s.teacher_name || '-',
      target: s.daily_target != null ? s.daily_target : '',
      last_entry: s.last_entry_date || '(hiç girmedi)',
      created_at: s.created_at ? s.created_at.slice(0, 10) : '',
      plan: s.weekly_plan && s.weekly_plan.trim() ? s.weekly_plan : '-',
      guidance: s.guidance_note && s.guidance_note.trim() ? s.guidance_note : '-',
    });
  });

  // 2. Günlük Sorular
  const wsEntries = wb.addWorksheet('Günlük Sorular');
  wsEntries.columns = [
    { header: 'Öğretmen', key: 'teacher', width: 20 },
    { header: 'Öğrenci', key: 'student', width: 24 },
    { header: 'Tarih', key: 'date', width: 14 },
    { header: 'Ders', key: 'subject', width: 20 },
    { header: 'Soru Sayısı', key: 'count', width: 14 },
  ];
  wsEntries.getRow(1).font = { bold: true };
  students.forEach((s) => {
    (s.entries || []).forEach((e) => {
      Object.entries(e.subjects || {}).forEach(([subj, count]) => {
        wsEntries.addRow({
          teacher: s.teacher_name || '-',
          student: s.name,
          date: e.date,
          subject: subj,
          count: count,
        });
      });
    });
  });

  // 3. Denemeler
  const wsDenemeler = wb.addWorksheet('Denemeler');
  wsDenemeler.columns = [
    { header: 'Öğretmen', key: 'teacher', width: 20 },
    { header: 'Öğrenci', key: 'student', width: 24 },
    { header: 'Deneme', key: 'name', width: 24 },
    { header: 'Tarih', key: 'date', width: 14 },
    { header: 'Puan', key: 'score', width: 12 },
  ];
  wsDenemeler.getRow(1).font = { bold: true };
  students.forEach((s) => {
    (s.denemeler || []).forEach((d) => {
      wsDenemeler.addRow({
        teacher: s.teacher_name || '-',
        student: s.name,
        name: d.name,
        date: d.date,
        score: d.score,
      });
    });
  });

  await saveWorkbook(wb, filename);
}

// ExcelJS: Öğretmen - Kendi Öğrencilerini Aktar
export async function exportTeacherStudents(teacherName: string, students: Student[]) {
  const wb = new ExcelJS.Workbook();

  const wsStudents = wb.addWorksheet('Öğrenciler');
  wsStudents.columns = [
    { header: 'Ad Soyad', key: 'name', width: 24 },
    { header: 'Günlük Hedef', key: 'target', width: 14 },
    { header: 'Haftaya Dair Plan ve Öneriler', key: 'plan', width: 32 },
    { header: 'Rehberlik Görüş ve Öneriler', key: 'guidance', width: 32 },
  ];
  wsStudents.getRow(1).font = { bold: true };
  students.forEach((s) => {
    wsStudents.addRow({
      name: s.name,
      target: s.daily_target != null ? s.daily_target : '',
      plan: s.weekly_plan && s.weekly_plan.trim() ? s.weekly_plan : '-',
      guidance: s.guidance_note && s.guidance_note.trim() ? s.guidance_note : '-',
    });
  });

  const dateSet = new Set<string>();
  students.forEach((s) => (s.entries || []).forEach((e) => dateSet.add(e.date)));
  const dates = Array.from(dateSet).sort().reverse();

  const wsEntries = wb.addWorksheet('Günlük Sorular');
  dates.forEach((date) => {
    const rowsForDate: { name: string; subjects: Record<string, number>; total: number }[] = [];
    students.forEach((s) => {
      const entry = (s.entries || []).find((e) => e.date === date);
      if (!entry) return;
      rowsForDate.push({ name: s.name, subjects: entry.subjects || {}, total: entryTotal(entry) });
    });
    if (rowsForDate.length === 0) return;

    wsEntries.addRow([fmtDate(date)]);
    const headerRow = wsEntries.addRow(['Öğrenci', ...SUBJECTS, 'Toplam']);
    headerRow.font = { bold: true };
    rowsForDate.forEach((row) => {
      wsEntries.addRow([row.name, ...SUBJECTS.map((subj) => row.subjects[subj] || 0), row.total]);
    });
    wsEntries.addRow([]);
  });

  const denemeGroupMap = new Map<string, { name: string; date: string; rows: { name: string; score: number }[] }>();
  students.forEach((s) => {
    (s.denemeler || []).forEach((d) => {
      const key = `${d.name}|${d.date}`;
      if (!denemeGroupMap.has(key)) denemeGroupMap.set(key, { name: d.name, date: d.date, rows: [] });
      denemeGroupMap.get(key)!.rows.push({ name: s.name, score: d.score });
    });
  });

  const denemeGroups = Array.from(denemeGroupMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const wsDenemeler = wb.addWorksheet('Denemeler');
  denemeGroups.forEach((g) => {
    wsDenemeler.addRow([g.name, fmtDate(g.date)]);
    const headerRow = wsDenemeler.addRow(['Öğrenci', 'Puan']);
    headerRow.font = { bold: true };
    g.rows.forEach((r) => wsDenemeler.addRow([r.name, r.score]));
    wsDenemeler.addRow([]);
  });

  const filename = `${teacherName.replace(/\s+/g, '-')}-${todayStr()}.xlsx`;
  await saveWorkbook(wb, filename);
}

// ExcelJS: Öğretmen Aktivitesi Dışa Aktar
export async function exportTeacherActivityExcel(
  teacherName: string,
  students: Student[],
  groups: { date: string; studentRows: { studentName: string; subjects: Record<string, number>; total: number }[] }[]
) {
  const wb = new ExcelJS.Workbook();

  const wsStudents = wb.addWorksheet('Öğrenciler');
  wsStudents.columns = [
    { header: 'Ad Soyad', key: 'name', width: 24 },
    { header: 'Haftaya Dair Plan ve Öneriler', key: 'plan', width: 32 },
    { header: 'Rehberlik Görüş ve Öneriler', key: 'guidance', width: 32 },
  ];
  wsStudents.getRow(1).font = { bold: true };
  students.forEach((s) => {
    wsStudents.addRow({
      name: s.name,
      plan: s.weekly_plan && s.weekly_plan.trim() ? s.weekly_plan : '-',
      guidance: s.guidance_note && s.guidance_note.trim() ? s.guidance_note : '-',
    });
  });

  const wsEntries = wb.addWorksheet('Günlük Sorular');
  groups.forEach((g) => {
    wsEntries.addRow([fmtDate(g.date)]);
    const hRow = wsEntries.addRow(['Öğrenci', ...SUBJECTS, 'Toplam']);
    hRow.font = { bold: true };
    g.studentRows.forEach((row) => {
      wsEntries.addRow([row.studentName, ...SUBJECTS.map((s) => row.subjects[s] || 0), row.total]);
    });
    wsEntries.addRow([]);
  });

  const denemeGroupMap = new Map<string, { name: string; date: string; rows: { name: string; score: number }[] }>();
  students.forEach((s) => {
    (s.denemeler || []).forEach((d) => {
      const key = `${d.name}|${d.date}`;
      if (!denemeGroupMap.has(key)) denemeGroupMap.set(key, { name: d.name, date: d.date, rows: [] });
      denemeGroupMap.get(key)!.rows.push({ name: s.name, score: d.score });
    });
  });
  const denemeGroups = Array.from(denemeGroupMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const wsDenemeler = wb.addWorksheet('Denemeler');
  denemeGroups.forEach((g) => {
    wsDenemeler.addRow([g.name, fmtDate(g.date)]);
    const hRow = wsDenemeler.addRow(['Öğrenci', 'Puan']);
    hRow.font = { bold: true };
    g.rows.forEach((r) => wsDenemeler.addRow([r.name, r.score]));
    wsDenemeler.addRow([]);
  });

  await saveWorkbook(wb, `${(teacherName || 'ogretmen').replace(/\s+/g, '-')}-aktivite.xlsx`);
}

// ExcelJS: Giriş Geçmişi
export async function exportTeacherLoginsExcel(teacherName: string, logins: string[] = []) {
  const wb = new ExcelJS.Workbook();
  const wsLogins = wb.addWorksheet('Giriş Geçmişi');
  wsLogins.columns = [{ header: 'Giriş Zamanı', key: 'login', width: 28 }];
  wsLogins.getRow(1).font = { bold: true };

  if (logins.length === 0) {
    wsLogins.addRow({ login: 'Henüz giriş kaydı yok.' });
  } else {
    logins.forEach((l) => wsLogins.addRow({ login: fmtDateTime(l) }));
  }

  await saveWorkbook(wb, `${(teacherName || 'ogretmen').replace(/\s+/g, '-')}-giris-gecmisi.xlsx`);
}

// ExcelJS: Tek Öğrenci Tam Raporu (Grafik görseli ekli)
export async function exportStudentFullReport(student: Student, chartCanvas?: HTMLCanvasElement | null) {
  const wb = new ExcelJS.Workbook();
  const entries: StudentEntry[] = student.entries || [];
  const today = todayStr();
  const [wStart, wEnd] = weekRange(0);
  const [lwStart, lwEnd] = weekRange(-1);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const dayLabel = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const monthLabel = (d: Date) => d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const rangeLabel = (start: Date, end: Date) =>
    start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) +
    ' – ' +
    end.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  // 1. Özet Sayfası
  const wsSummary = wb.addWorksheet('Özet');
  wsSummary.columns = [
    { header: 'Alan', key: 'k', width: 28 },
    { header: 'Değer', key: 'v', width: 34 },
  ];
  wsSummary.addRows([
    { k: 'Ad Soyad', v: student.name },
    { k: 'Kullanıcı Adı', v: student.username },
    { k: 'Günlük Hedef', v: student.daily_target != null ? student.daily_target : '-' },
    { k: dayLabel(now), v: sumEntries(entries, (d) => d === today) },
    { k: rangeLabel(wStart, wEnd), v: sumEntries(entries, (d) => inRange(d, wStart, wEnd)) },
    { k: rangeLabel(lwStart, lwEnd), v: sumEntries(entries, (d) => inRange(d, lwStart, lwEnd)) },
    { k: monthLabel(monthStart), v: sumEntries(entries, (d) => inRange(d, monthStart, monthEnd)) },
    { k: monthLabel(lastMonthStart), v: sumEntries(entries, (d) => inRange(d, lastMonthStart, lastMonthEnd)) },
    { k: 'Tüm Zamanlar', v: entries.reduce((sum, e) => sum + entryTotal(e), 0) },
    { k: 'Haftaya Dair Plan ve Öneriler', v: student.weekly_plan && student.weekly_plan.trim() ? student.weekly_plan : '-' },
    { k: 'Rehberlik Görüş ve Öneriler', v: student.guidance_note && student.guidance_note.trim() ? student.guidance_note : '-' },
  ]);
  wsSummary.getRow(1).font = { bold: true };
  wsSummary.getColumn('v').alignment = { wrapText: true, vertical: 'top' };

  // 2. Derslere Göre
  const wsSubjects = wb.addWorksheet('Derslere Göre');
  wsSubjects.columns = [
    { header: 'Ders', key: 'subj', width: 24 },
    { header: rangeLabel(wStart, wEnd), key: 'week', width: 24 },
    { header: 'Toplam', key: 'total', width: 14 },
    { header: 'Yüzde', key: 'pct', width: 12 },
  ];
  wsSubjects.getRow(1).font = { bold: true };
  const weekBySubject: Record<string, number> = {};
  const totalBySubject: Record<string, number> = {};
  SUBJECTS.forEach((s) => {
    weekBySubject[s] = 0;
    totalBySubject[s] = 0;
  });
  entries.forEach((e) => {
    const inWeek = inRange(e.date, wStart, wEnd);
    Object.entries(e.subjects || {}).forEach(([subj, count]) => {
      const c = Number(count) || 0;
      if (!(subj in totalBySubject)) {
        totalBySubject[subj] = 0;
        weekBySubject[subj] = 0;
      }
      totalBySubject[subj] += c;
      if (inWeek) weekBySubject[subj] += c;
    });
  });
  const grandTotal = Object.values(totalBySubject).reduce((a, b) => a + b, 0);
  Object.keys(totalBySubject).forEach((subj) => {
    const pct = grandTotal > 0 ? Math.round((totalBySubject[subj] / grandTotal) * 100) : 0;
    wsSubjects.addRow({ subj, week: weekBySubject[subj], total: totalBySubject[subj], pct: `%${pct}` });
  });

  // 3. Günlük Sorular
  const wsEntries = wb.addWorksheet('Günlük Sorular');
  wsEntries.columns = [
    { header: 'Tarih', key: 'date', width: 16 },
    { header: 'Ders', key: 'subj', width: 24 },
    { header: 'Soru Sayısı', key: 'count', width: 14 },
  ];
  wsEntries.getRow(1).font = { bold: true };
  entries
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((e) => {
      Object.entries(e.subjects || {}).forEach(([subj, count]) => {
        wsEntries.addRow({ date: e.date, subj, count });
      });
    });

  // 4. Denemeler
  const wsDenemeler = wb.addWorksheet('Denemeler');
  const sortedDenemeler = (student.denemeler || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  let denemeRowCursor = 0;

  if (chartCanvas && sortedDenemeler.length > 0) {
    try {
      wsDenemeler.getCell('A1').value = 'Puan Grafiği';
      wsDenemeler.getCell('A1').font = { bold: true };
      const imageBase64 = chartCanvas.toDataURL('image/png');
      const imgId = wb.addImage({ base64: imageBase64, extension: 'png' });
      wsDenemeler.addImage(imgId, { tl: { col: 0, row: 1 }, ext: { width: 520, height: 260 } });
      denemeRowCursor = 16;
    } catch (e) {
      console.warn('Grafik ExcelJS görüntüsüne eklenemedi:', e);
    }
  }

  wsDenemeler.getCell(`A${denemeRowCursor + 1}`).value = 'Deneme';
  wsDenemeler.getCell(`B${denemeRowCursor + 1}`).value = 'Tarih';
  wsDenemeler.getCell(`C${denemeRowCursor + 1}`).value = 'Puan';
  wsDenemeler.getRow(denemeRowCursor + 1).font = { bold: true };
  wsDenemeler.getColumn(1).width = 24;
  wsDenemeler.getColumn(2).width = 16;
  wsDenemeler.getColumn(3).width = 12;

  if (sortedDenemeler.length === 0) {
    wsDenemeler.getCell(`A${denemeRowCursor + 2}`).value = 'Henüz deneme kaydı yok.';
  } else {
    sortedDenemeler.forEach((d, i) => {
      const r = denemeRowCursor + 2 + i;
      wsDenemeler.getCell(`A${r}`).value = d.name;
      wsDenemeler.getCell(`B${r}`).value = d.date;
      wsDenemeler.getCell(`C${r}`).value = d.score;
    });
  }

  // 5. Giriş Saatleri
  const wsLogins = wb.addWorksheet('Giriş Saatleri');
  wsLogins.columns = [{ header: 'Giriş Zamanı', key: 'login', width: 26 }];
  wsLogins.getRow(1).font = { bold: true };
  const studentLogins = student.logins || [];
  if (studentLogins.length === 0) {
    wsLogins.addRow({ login: 'Henüz giriş kaydı yok.' });
  } else {
    studentLogins.forEach((l) => wsLogins.addRow({ login: fmtDateTime(l) }));
  }

  await saveWorkbook(wb, `${student.name.replace(/\s+/g, '-')}-rapor.xlsx`);
}

// ExcelJS: Haftalık ve Aylık Soru Takvimi Raporu
export async function exportWeeklyCalendarExcel(
  studentName: string,
  weeks: WeekSummary[],
  months: MonthSummary[],
  grandTotal: number,
  dailyTarget?: number | null
) {
  const wb = new ExcelJS.Workbook();

  // 1. Sayfa: Haftalık Takvim
  const wsWeeks = wb.addWorksheet('Haftalık Takvim');
  wsWeeks.views = [{ showGridLines: true }];

  // Başlıklar
  const titleRow1 = wsWeeks.addRow([`ÖĞRENCİ: ${studentName}`, '', '', '', '', '', '', '', '', '']);
  titleRow1.font = { bold: true, size: 13 };
  const titleRow2 = wsWeeks.addRow([
    `GENEL TOPLAM: ${grandTotal} Soru`,
    '',
    '',
    `GÜNLÜK HEDEF: ${dailyTarget != null ? dailyTarget + ' Soru' : '-'}`,
    '',
    '',
    '',
    '',
    '',
    `RAPOR: ${todayStr()}`,
  ]);
  titleRow2.font = { bold: true };
  wsWeeks.addRow([]);

  const hRow = wsWeeks.addRow([
    'Ay',
    'Hafta Aralığı',
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
    'Pazar',
    'Hafta Toplamı',
    'Günlük Ort.',
  ]);
  hRow.font = { bold: true };
  hRow.alignment = { horizontal: 'center', vertical: 'middle' };

  // Sütun genişlikleri
  wsWeeks.getColumn(1).width = 16;
  wsWeeks.getColumn(2).width = 28;
  wsWeeks.getColumn(3).width = 12;
  wsWeeks.getColumn(4).width = 12;
  wsWeeks.getColumn(5).width = 12;
  wsWeeks.getColumn(6).width = 12;
  wsWeeks.getColumn(7).width = 12;
  wsWeeks.getColumn(8).width = 12;
  wsWeeks.getColumn(9).width = 12;
  wsWeeks.getColumn(10).width = 16;
  wsWeeks.getColumn(11).width = 14;

  weeks.forEach((w) => {
    const dayTotals = w.days.map((d) => d.total || 0);
    const row = wsWeeks.addRow([
      w.monthName,
      w.label,
      ...dayTotals,
      w.totalQuestions,
      w.dailyAverage,
    ]);

    row.alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'left' };
    row.getCell(10).font = { bold: true };
  });

  wsWeeks.addRow([]);
  const totalRow = wsWeeks.addRow(['', 'GENEL TOPLAM', '', '', '', '', '', '', '', grandTotal, '']);
  totalRow.font = { bold: true, size: 12 };

  // 2. Sayfa: Aylık Özet
  const wsMonths = wb.addWorksheet('Aylık Özet');
  wsMonths.columns = [
    { header: 'Ay', key: 'm', width: 20 },
    { header: 'Hafta Sayısı', key: 'w', width: 14 },
    { header: 'Toplam Çözülen Soru', key: 'tot', width: 22 },
    { header: 'Günlük Ortalama', key: 'avg', width: 18 },
  ];
  wsMonths.getRow(1).font = { bold: true };

  months.forEach((m) => {
    wsMonths.addRow({
      m: m.monthName,
      w: m.weeks.length,
      tot: m.totalQuestions,
      avg: m.dailyAverage,
    });
  });

  // 3. Sayfa: Haftalık Ders Dağılımı
  const wsSubjects = wb.addWorksheet('Haftalık Ders Dağılımı');
  wsSubjects.columns = [
    { header: 'Hafta Aralığı', key: 'week', width: 30 },
    ...SUBJECTS.map((s) => ({ header: s, key: s, width: 16 })),
    { header: 'Hafta Toplamı', key: 'total', width: 16 },
  ];
  wsSubjects.getRow(1).font = { bold: true };

  weeks.forEach((w) => {
    const rowObj: any = {
      week: w.label,
      total: w.totalQuestions,
    };
    SUBJECTS.forEach((s) => {
      rowObj[s] = w.subjectTotals[s] || 0;
    });
    wsSubjects.addRow(rowObj);
  });

  const filename = `${studentName.replace(/\s+/g, '-')}-soru-takvimi-${todayStr()}.xlsx`;
  await saveWorkbook(wb, filename);
}

// ExcelJS: Bu Haftanın Özel Yedeğini İndir (Öğretmen / Admin)
export async function exportWeeklyTeacherBackup(
  _title: string,
  students: Student[],
  weekOffset = 0
) {
  const wb = new ExcelJS.Workbook();
  const [wStart, wEnd] = weekRange(weekOffset);
  const wMonday = wStart;
  const wStartStr = toISODateStr(wStart);
  const wEndStr = toISODateStr(wEnd);

  // Günlerin tarihleri ve adları (Pzt -> Paz)
  const weekDays: { dateStr: string; label: string }[] = [];
  const dayLabels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(wMonday.getFullYear(), wMonday.getMonth(), wMonday.getDate() + i, 12, 0, 0);
    weekDays.push({
      dateStr: toISODateStr(cur),
      label: `${cur.getDate()} ${dayLabels[i]}`,
    });
  }

  // 1. Sayfa: Bu Hafta Öğrenci Özeti
  const wsOverview = wb.addWorksheet('Haftalık Özet');
  wsOverview.columns = [
    { header: 'Öğrenci', key: 'student', width: 22 },
    { header: 'Günlük Hedef', key: 'target', width: 14 },
    ...weekDays.map((d) => ({ header: d.label, key: d.dateStr, width: 12 })),
    { header: 'Hafta Toplamı', key: 'total', width: 16 },
    { header: 'Aktif Gün', key: 'active_days', width: 14 },
    { header: 'Hedef Durumu', key: 'status', width: 18 },
  ];
  wsOverview.getRow(1).font = { bold: true };

  let overallWeekTotal = 0;

  students.forEach((s) => {
    const rowObj: any = {
      student: s.name,
      target: s.daily_target != null ? s.daily_target : '-',
    };

    let studentWeekTotal = 0;
    let activeDays = 0;

    weekDays.forEach((d) => {
      const entry = (s.entries || []).find((e) => e.date === d.dateStr);
      const count = entry ? entryTotal(entry) : 0;
      rowObj[d.dateStr] = count > 0 ? count : '-';
      if (count > 0) {
        studentWeekTotal += count;
        activeDays++;
      }
    });

    overallWeekTotal += studentWeekTotal;
    rowObj.total = studentWeekTotal;
    rowObj.active_days = `${activeDays} / 7`;

    if (s.daily_target && s.daily_target > 0) {
      const weeklyTarget = s.daily_target * 7;
      rowObj.status = studentWeekTotal >= weeklyTarget ? 'Hedefe Ulaşıldı ✅' : `Hedefe %${Math.round((studentWeekTotal / weeklyTarget) * 100)}`;
    } else {
      rowObj.status = studentWeekTotal > 0 ? 'Aktif' : 'Giriş Yok';
    }

    wsOverview.addRow(rowObj);
  });

  wsOverview.addRow([]);
  const sumRow = wsOverview.addRow({
    student: 'GENEL TOPLAM',
    total: overallWeekTotal,
  });
  sumRow.font = { bold: true, size: 11 };

  // 2. Sayfa: Bu Hafta Ders Dağılımı
  const wsSubjects = wb.addWorksheet('Haftalık Dersler');
  wsSubjects.columns = [
    { header: 'Öğrenci', key: 'student', width: 22 },
    ...SUBJECTS.map((subj) => ({ header: subj, key: subj, width: 15 })),
    { header: 'Toplam', key: 'total', width: 15 },
  ];
  wsSubjects.getRow(1).font = { bold: true };

  students.forEach((s) => {
    const rowObj: any = { student: s.name };
    let studentTot = 0;
    SUBJECTS.forEach((subj) => {
      let subjCount = 0;
      (s.entries || []).forEach((e) => {
        if (inRange(e.date, wStart, wEnd)) {
          subjCount += Number(e.subjects?.[subj]) || 0;
        }
      });
      rowObj[subj] = subjCount;
      studentTot += subjCount;
    });
    rowObj.total = studentTot;
    wsSubjects.addRow(rowObj);
  });

  // 3. Sayfa: Öğrenci Plan ve Rehberlik
  const wsPlans = wb.addWorksheet('Haftalık Planlar');
  wsPlans.columns = [
    { header: 'Öğrenci', key: 'student', width: 24 },
    { header: 'Haftaya Dair Plan ve Öneriler', key: 'plan', width: 36 },
    { header: 'Rehberlik Görüş ve Notları', key: 'guidance', width: 36 },
  ];
  wsPlans.getRow(1).font = { bold: true };
  students.forEach((s) => {
    wsPlans.addRow({
      student: s.name,
      plan: s.weekly_plan || '-',
      guidance: s.guidance_note || '-',
    });
  });

  const filename = `haftalik-lgs-yedek-${wStartStr}-ila-${wEndStr}.xlsx`;
  await saveWorkbook(wb, filename);
}

// JSON Veritabanı Yedeği İndir
export function exportFullJsonBackup(_title: string, data: any) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lgs-tam-veritabani-yedek-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

