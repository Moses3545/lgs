import { StudentEntry } from '../types';

export const SUBJECTS = [
  'Türkçe',
  'Matematik',
  'Fen Bilimleri',
  'T.C. İnkılap Tarihi',
  'Din Kültürü',
  'İngilizce',
] as const;

export type Subject = typeof SUBJECTS[number];

export const LS_TEACHER = 'lgs_teacher_session';
export const LS_STUDENT = 'lgs_student_session';

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Hiç giriş yapılmadı';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return (
    d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  );
}

export function todayStr(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function todayLabel(): string {
  return new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function generatePin(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0,O,1,I çıkarıldı
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function entryTotal(entry?: StudentEntry | null): number {
  if (!entry || !entry.subjects) return 0;
  return Object.values(entry.subjects).reduce((a, b) => a + (Number(b) || 0), 0);
}

export function relDateLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Hiç giriş yapılmadı';
  const today = todayStr();
  if (dateStr === today) return 'Bugün';
  const diffDays = Math.round((new Date(today).getTime() - new Date(dateStr).getTime()) / 86400000);
  if (diffDays === 1) return 'Dün';
  if (diffDays > 1) return `${diffDays} gün önce`;
  return fmtDate(dateStr);
}

export function weekRange(offsetWeeks: number): [Date, Date] {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Pazartesi
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return [monday, sunday];
}

export function inRange(dateStr: string, start: Date, end: Date): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  return d >= start && d <= end;
}

export function sumEntries(
  entries: StudentEntry[] = [],
  predicate: (date: string) => boolean
): number {
  return entries
    .filter((e) => predicate(e.date))
    .reduce((sum, e) => sum + entryTotal(e), 0);
}

export const QUOTES = [
  { text: 'Muhtaç olduğun kudret, damarlarındaki asil kanda mevcuttur.', author: 'Mustafa Kemal Atatürk' },
  { text: 'Başarısız olmadım. Sadece işe yaramayan on bin yol buldum.', author: 'Thomas Edison' },
  { text: 'Ne kadar yavaş gittiğinin önemi yok, durmadığın sürece.', author: 'Konfüçyüs' },
  { text: 'Hayatta hiçbir şeyden korkmamalı, sadece anlamalı.', author: 'Marie Curie' },
  { text: 'Yarın ölecekmiş gibi yaşa, sonsuza dek yaşayacakmış gibi öğren.', author: 'Mahatma Gandhi' },
  { text: 'Bilgi güçtür.', author: 'Konfüçyüs' },
  { text: 'Değişim istiyorsan, önce kendin o değişim ol.', author: 'Mahatma Gandhi' },
  { text: 'Büyük başarılar, küçük ama sürekli çabaların toplamıdır.', author: 'Thomas Edison' },
];
