import React, { useState } from 'react';
import { ArrowLeft, Download, Save, Sparkles, CheckCircle2, AlertCircle, BookOpen, Target, Award, User } from 'lucide-react';
import { Session, Student } from '../../types';
import { sb } from '../../lib/supabase';
import { SUBJECTS, fmtDate, todayStr, relDateLabel, weekRange, inRange } from '../../lib/utils';
import { exportStudentFullReport } from '../../lib/excel';
import { WeeklyMonthlyCalendar } from '../common/WeeklyMonthlyCalendar';

interface CounselorStudentDetailViewProps {
  session: Session;
  student: Student;
  onBack: () => void;
  onStudentUpdated: (updatedStudent: Student) => void;
}

export const CounselorStudentDetailView: React.FC<CounselorStudentDetailViewProps> = ({
  session,
  student: initialStudent,
  onBack,
  onStudentUpdated,
}) => {
  const [student, setStudent] = useState<Student>(initialStudent);
  const [guidanceNote, setGuidanceNote] = useState(student.guidance_note || '');
  const [guidanceSaving, setGuidanceSaving] = useState(false);
  const [guidanceMsg, setGuidanceMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // Soru istatistikleri hesaplama
  const entries = student.entries || [];
  const [wStart, wEnd] = weekRange(0);
  const currentMonthPrefix = todayStr().slice(0, 7);

  const today = todayStr();
  const todayBySubject: Record<string, number> = {};
  const weekBySubject: Record<string, number> = {};
  const monthBySubject: Record<string, number> = {};
  const totalBySubject: Record<string, number> = {};

  SUBJECTS.forEach((s) => {
    todayBySubject[s] = 0;
    weekBySubject[s] = 0;
    monthBySubject[s] = 0;
    totalBySubject[s] = 0;
  });

  entries.forEach((e) => {
    const isToday = e.date === today;
    const inWeek = inRange(e.date, wStart, wEnd);
    const inMonth = e.date.startsWith(currentMonthPrefix);

    Object.entries(e.subjects || {}).forEach(([subj, count]) => {
      const c = Number(count) || 0;
      if (!(subj in totalBySubject)) {
        todayBySubject[subj] = 0;
        totalBySubject[subj] = 0;
        weekBySubject[subj] = 0;
        monthBySubject[subj] = 0;
      }
      totalBySubject[subj] += c;
      if (isToday) todayBySubject[subj] += c;
      if (inWeek) weekBySubject[subj] += c;
      if (inMonth) monthBySubject[subj] += c;
    });
  });

  const todayTotal = Object.values(todayBySubject).reduce((a, b) => a + b, 0);
  const weekTotal = Object.values(weekBySubject).reduce((a, b) => a + b, 0);
  const monthTotal = Object.values(monthBySubject).reduce((a, b) => a + b, 0);
  const grandTotal = Object.values(totalBySubject).reduce((a, b) => a + b, 0);

  // Rehberlik Notu Kaydetme
  const handleSaveGuidance = async () => {
    setGuidanceSaving(true);
    setGuidanceMsg(null);
    try {
      const { data, error: rpcError } = await sb.rpc('counselor_save_guidance_note', {
        p_counselor_id: session.id,
        p_session_token: session.sessionToken,
        p_student_id: student.id,
        p_content: guidanceNote,
      });

      if (rpcError || !data || data.error) {
        setGuidanceMsg({ type: 'error', text: 'Rehberlik notu kaydedilemedi, lütfen tekrar deneyin.' });
        return;
      }

      const updated = { ...student, guidance_note: guidanceNote };
      setStudent(updated);
      onStudentUpdated(updated);
      setGuidanceMsg({ type: 'success', text: 'Rehberlik notu başarıyla kaydedildi ve öğrenciyle paylaşıldı.' });
    } catch (err) {
      console.error(err);
      setGuidanceMsg({ type: 'error', text: 'Bağlantı hatası oluştu.' });
    } finally {
      setGuidanceSaving(false);
    }
  };

  const handleExportReport = async () => {
    setExportLoading(true);
    try {
      await exportStudentFullReport(student);
    } catch (err) {
      console.error(err);
      alert('Rapor indirilirken hata oluştu.');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-5 pb-10">
      {/* Üst Navigasyon */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="ios-press inline-flex items-center gap-1.5 text-sm text-[#007AFF] hover:text-[#005bb5] font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Tüm Öğrencilere Dön</span>
        </button>

        <button
          type="button"
          onClick={handleExportReport}
          disabled={exportLoading}
          className="ios-press inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#F2F2F7] text-ink font-semibold rounded-xl text-xs border border-black/[0.08] shadow-xs transition-all disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>{exportLoading ? 'Hazırlanıyor…' : 'Öğrenci Raporu (Excel)'}</span>
        </button>
      </div>

      {/* Öğrenci Başlık Kartı - ZORUNLU KURAL: Öğrencinin adı soyadı yanında bağlı olduğu öğretmen parantez içinde */}
      <div className="notebook-card p-5 sm:p-6 bg-gradient-to-r from-purple-50/70 via-white to-indigo-50/50 border border-purple-200/60 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 mb-2">
              <Sparkles className="w-3 h-3" />
              <span>Öğrenci Rehberlik Dosyası</span>
            </div>
            {/* Öğrenci adı soyadı yanında hangi öğretmene bağlı olduğu parantez içinde */}
            <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight flex flex-wrap items-center gap-2">
              <span>{student.name}</span>
              <span className="text-purple-700 font-bold text-lg sm:text-2xl">
                ({student.teacher_name || 'Öğretmen Yok'})
              </span>
            </h1>
            <p className="text-xs text-muted font-medium mt-1">
              Kullanıcı Adı: <span className="font-mono text-ink font-semibold">{student.username}</span> · Son Çalışma: <span className="font-semibold text-ink">{relDateLabel(student.last_entry_date)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-100 text-purple-900 text-xs font-bold border border-purple-200/80">
              <User className="w-3.5 h-3.5 text-purple-700" />
              <span>Öğretmen: {student.teacher_name || 'Atanmamış'}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-100 text-blue-900 text-xs font-bold border border-blue-200/80">
              <Target className="w-3.5 h-3.5 text-blue-700" />
              <span>Hedef: {student.daily_target ? `${student.daily_target} Soru/Gün` : 'Hedef Yok'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* REHBERLİK NOTU PAYLAŞIM ALANI */}
      <div className="notebook-card p-5 sm:p-6 bg-gradient-to-tr from-purple-50/90 via-white to-pink-50/70 border-2 border-purple-300/80 shadow-lg relative overflow-hidden">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-600 text-white flex items-center justify-center shadow-md shadow-purple-500/25">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-ink tracking-tight flex items-center gap-2">
                <span>Rehberlik Notu Paylaş</span>
                <span className="text-xs font-normal text-purple-600 bg-purple-100/80 px-2 py-0.5 rounded-md">
                  Öğrenci Görür
                </span>
              </h3>
              <p className="text-xs text-muted">
                Buraya yazacağınız rehberlik görüşü, motivasyon veya çalışma önerisi anında öğrencinin kendi panelinde görünür.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            value={guidanceNote}
            onChange={(e) => setGuidanceNote(e.target.value)}
            rows={4}
            placeholder="Öğrenciye rehberlik tavsiyelerinizi, motivasyon mesajlarınızı veya haftalık çalışma değerlendirmenizi buraya yazın..."
            className="w-full text-sm p-4 rounded-2xl border border-purple-200 bg-white/90 text-ink focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all leading-relaxed shadow-xs"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="text-[11px] text-muted">
              {guidanceNote.trim() ? (
                <span className="text-purple-700 font-semibold">
                  ✓ {guidanceNote.length} karakter yazıldı
                </span>
              ) : (
                <span>Henüz bir rehberlik notu yazılmamış</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveGuidance}
              disabled={guidanceSaving}
              className="ios-press inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-105 active:scale-[0.98] text-white font-bold rounded-xl text-xs shadow-md shadow-purple-500/20 disabled:opacity-50 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{guidanceSaving ? 'Kaydediliyor…' : 'Rehberlik Notunu Kaydet & Paylaş'}</span>
            </button>
          </div>

          {guidanceMsg && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-fadeIn ${
                guidanceMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}
            >
              {guidanceMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <span className="font-semibold">{guidanceMsg.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Soru Çözüm Özet İstatistikleri */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="notebook-card p-4 text-center">
          <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1">Bugün</div>
          <div className="text-2xl font-black text-ink">{todayTotal}</div>
          <div className="text-[10px] text-muted font-medium mt-0.5">Soru Çözüldü</div>
        </div>

        <div className="notebook-card p-4 text-center">
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">Bu Hafta</div>
          <div className="text-2xl font-black text-blue-600">{weekTotal}</div>
          <div className="text-[10px] text-muted font-medium mt-0.5">Soru Çözüldü</div>
        </div>

        <div className="notebook-card p-4 text-center">
          <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider mb-1">Bu Ay</div>
          <div className="text-2xl font-black text-purple-600">{monthTotal}</div>
          <div className="text-[10px] text-muted font-medium mt-0.5">Soru Çözüldü</div>
        </div>

        <div className="notebook-card p-4 text-center">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Toplam</div>
          <div className="text-2xl font-black text-emerald-600">{grandTotal}</div>
          <div className="text-[10px] text-muted font-medium mt-0.5">Kayıtlı Soru</div>
        </div>
      </div>

      {/* Ders Dağılım Kartları */}
      <div className="notebook-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
            <BookOpen className="w-4 h-4" />
          </span>
          <h3 className="text-base sm:text-lg font-bold text-ink tracking-tight">
            Ders Bazında Soru Dağılımı
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {SUBJECTS.map((s) => {
            const tot = totalBySubject[s] || 0;
            const week = weekBySubject[s] || 0;
            return (
              <div key={s} className="p-3 rounded-xl bg-[#F2F2F7] border border-black/[0.04]">
                <div className="text-xs font-bold text-ink truncate mb-1">{s}</div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-black text-ink">{tot}</span>
                  <span className="text-[11px] font-semibold text-blue-600">Bu hafta: {week}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deneme Sınavları */}
      <div className="notebook-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
              <Award className="w-4 h-4" />
            </span>
            <h3 className="text-base sm:text-lg font-bold text-ink tracking-tight">
              Deneme Sınavları ({student.denemeler?.length || 0})
            </h3>
          </div>
        </div>

        {(!student.denemeler || student.denemeler.length === 0) ? (
          <div className="p-6 text-center text-xs text-muted bg-[#F2F2F7] rounded-xl border border-dashed border-black/[0.08]">
            Öğrencinin henüz kayıtlı deneme sınavı bulunmuyor.
          </div>
        ) : (
          <div className="space-y-2">
            {student.denemeler.map((d, idx) => (
              <div key={d.id || idx} className="flex items-center justify-between p-3 rounded-xl bg-[#F2F2F7] border border-black/[0.04]">
                <div>
                  <div className="text-sm font-bold text-ink">{d.name}</div>
                  <div className="text-[11px] text-muted">{fmtDate(d.date)}</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-amber-600">{d.score} Puan</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Öğretmenin Haftalık Çalışma Planı (varsa) */}
      {student.weekly_plan && (
        <div className="notebook-card p-5 sm:p-6 space-y-2 bg-blue-50/40 border border-blue-200/60">
          <div className="flex items-center gap-2">
            <span className="text-sm">📋</span>
            <h3 className="text-sm font-bold text-ink">
              Öğretmenin Haftalık Çalışma Planı ({student.teacher_name || 'Öğretmen'})
            </h3>
          </div>
          <p className="text-xs text-blue-950 bg-white p-3.5 rounded-xl border border-blue-200/60 whitespace-pre-wrap font-medium leading-relaxed">
            {student.weekly_plan}
          </p>
        </div>
      )}

      {/* Soru Giriş Takvimi */}
      <div className="notebook-card p-5 sm:p-6">
        <WeeklyMonthlyCalendar
          studentName={`${student.name} (${student.teacher_name || 'Öğretmen Yok'})`}
          entries={entries}
          dailyTarget={student.daily_target}
        />
      </div>
    </div>
  );
};
