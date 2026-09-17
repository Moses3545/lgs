import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, RefreshCw, UserCheck } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { Session, Student, TeacherActivityData, Teacher } from '../../types';
import { SUBJECTS, fmtDate, fmtDateTime, entryTotal } from '../../lib/utils';
import { exportTeacherActivityExcel, exportTeacherLoginsExcel } from '../../lib/excel';

interface TeacherActivityViewProps {
  session: Session;
  teacherId: string;
  onBack: () => void;
}

export const TeacherActivityView: React.FC<TeacherActivityViewProps> = ({
  session,
  teacherId,
  onBack,
}) => {
  const [activityData, setActivityData] = useState<TeacherActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Transfer modal / panel state
  const [transferringStudentId, setTransferringStudentId] = useState<string | null>(null);
  const [otherTeachers, setOtherTeachers] = useState<Teacher[]>([]);
  const [selectedNewTeacherId, setSelectedNewTeacherId] = useState<string>('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');

  const loadActivity = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await sb.rpc('admin_get_teacher_activity', {
        p_admin_id: session.id,
        p_teacher_id: teacherId,
      });

      if (rpcError || !data || data.error) {
        setError('Veriler alınamadı, lütfen tekrar deneyin.');
        return;
      }
      setActivityData(data);
    } catch {
      setError('Bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, [teacherId]);

  const openTransfer = async (studentId: string) => {
    setTransferringStudentId(studentId);
    setTransferError('');
    try {
      const { data } = await sb.rpc('admin_list_teachers');
      const others = ((data?.teachers || []) as Teacher[]).filter((t) => t.id !== teacherId);
      setOtherTeachers(others);
      if (others.length > 0) {
        setSelectedNewTeacherId(others[0].id);
      }
    } catch {
      setTransferError('Öğretmen listesi alınamadı.');
    }
  };

  const handleConfirmTransfer = async (student: Student) => {
    if (!selectedNewTeacherId) return;
    const targetTeacher = otherTeachers.find((t) => t.id === selectedNewTeacherId);
    if (
      !window.confirm(
        `${student.name} adlı öğrenciyi ${targetTeacher?.name || ''} öğretmenine aktarmak istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    setTransferring(true);
    setTransferError('');
    try {
      const { data, error: rpcError } = await sb.rpc('admin_transfer_student', {
        p_admin_id: session.id,
        p_student_id: student.id,
        p_new_teacher_id: selectedNewTeacherId,
      });

      if (rpcError || !data || data.error) {
        setTransferError('Öğrenci aktarılamadı, tekrar deneyin.');
        return;
      }

      setTransferringStudentId(null);
      await loadActivity();
    } catch {
      setTransferError('Bağlantı hatası.');
    } finally {
      setTransferring(false);
    }
  };

  // Build pivot groups
  const buildDateGroups = () => {
    if (!activityData) return [];
    const students = activityData.students || [];
    const dateSet = new Set<string>();
    students.forEach((s) => (s.entries || []).forEach((e) => dateSet.add(e.date)));
    const dates = Array.from(dateSet).sort().reverse();

    return dates.map((date) => {
      const studentRows: { studentName: string; subjects: Record<string, number>; total: number }[] = [];
      students.forEach((s) => {
        const entry = (s.entries || []).find((e) => e.date === date);
        if (!entry) return;
        studentRows.push({
          studentName: s.name,
          subjects: entry.subjects || {},
          total: entryTotal(entry),
        });
      });
      return { date, studentRows };
    });
  };

  const dateGroups = buildDateGroups();

  return (
    <div className="animate-fadeIn space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink font-semibold transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Öğretmen listesine dön</span>
      </button>

      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-muted font-semibold">
            SALT-OKUNUR GÖRÜNÜM
          </span>
          <h2 className="font-serif text-2xl font-bold text-ink">
            {activityData?.teacher_name || 'Öğretmen Aktivitesi'}
          </h2>
        </div>
        <button
          type="button"
          onClick={loadActivity}
          className="p-2 rounded-full border border-ink/10 hover:bg-white text-muted hover:text-ink transition-colors"
          title="Yenile"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-dangerBg text-brandRed rounded-md text-xs font-medium border border-brandRed/20">
          {error}
        </div>
      )}

      {loading && !activityData ? (
        <div className="notebook-card text-center py-10 text-muted text-sm">
          Yükleniyor…
        </div>
      ) : activityData ? (
        <>
          {/* Öğrenciler Gün Gün Toplam Soru Pivot Kartı */}
          <div className="notebook-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h3 className="font-serif text-lg font-semibold text-ink">
                Öğrenciler — Gün Gün Soru Dağılımı
              </h3>
              <button
                type="button"
                onClick={() =>
                  exportTeacherActivityExcel(
                    activityData.teacher_name,
                    activityData.students,
                    dateGroups
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brandGreen text-white text-xs font-semibold hover:opacity-90 transition-all self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel Olarak İndir</span>
              </button>
            </div>
            <p className="text-xs text-muted mb-4">
              Her hücre öğrencinin o gün ilgili dersten çözdüğü soru sayısıdır. Bu görünümden veri değiştirilemez.
            </p>

            {dateGroups.length === 0 ? (
              <p className="text-xs text-muted py-4">Henüz hiç soru girişi kaydedilmemiş.</p>
            ) : (
              <div className="space-y-6">
                {dateGroups.map((g) => (
                  <div key={g.date} className="border border-ink/10 rounded-lg p-3 bg-white/50">
                    <div className="font-serif font-semibold text-sm text-ink mb-2">
                      {fmtDate(g.date)}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-ink/10 text-muted font-mono uppercase text-[10px]">
                            <th className="py-2 px-2">Öğrenci</th>
                            {SUBJECTS.map((subj) => (
                              <th key={subj} className="py-2 px-2 text-right">
                                {subj}
                              </th>
                            ))}
                            <th className="py-2 px-2 text-right text-brandGreen font-bold">Toplam</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.studentRows.map((row, idx) => (
                            <tr key={idx} className="border-b border-ink/5 hover:bg-cream/40">
                              <td className="py-2 px-2 font-medium text-ink">{row.studentName}</td>
                              {SUBJECTS.map((subj) => (
                                <td key={subj} className="py-2 px-2 text-right font-mono">
                                  {row.subjects[subj] || 0}
                                </td>
                              ))}
                              <td className="py-2 px-2 text-right font-mono font-bold text-brandGreen">
                                {row.total}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Plan ve Rehberlik Notları */}
            <h3 className="font-serif text-lg font-semibold text-ink mt-8 mb-3">
              Plan ve Rehberlik Notları
            </h3>
            <div className="space-y-4">
              {(activityData.students || []).length === 0 ? (
                <p className="text-xs text-muted">Öğrenci bulunamadı.</p>
              ) : (
                activityData.students.map((s) => (
                  <div key={s.id} className="p-3.5 border border-ink/10 rounded-lg bg-white/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-ink">{s.name}</h4>
                      <button
                        type="button"
                        onClick={() => openTransfer(s.id)}
                        className="inline-flex items-center gap-1 text-xs text-brandGreen border border-brandGreen/30 px-2.5 py-1 rounded hover:bg-successBg font-medium transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Öğretmen Değiştir</span>
                      </button>
                    </div>

                    {/* Transfer Paneli */}
                    {transferringStudentId === s.id && (
                      <div className="p-3 bg-cream rounded-md border border-ink/10 my-2 space-y-2 text-xs">
                        <label className="font-semibold text-muted block">Yeni Öğretmen Seç</label>
                        {otherTeachers.length === 0 ? (
                          <p className="text-muted">Aktarılabilecek başka öğretmen bulunamadı.</p>
                        ) : (
                          <select
                            value={selectedNewTeacherId}
                            onChange={(e) => setSelectedNewTeacherId(e.target.value)}
                            className="w-full text-xs p-2 rounded border border-ink/20 bg-white"
                          >
                            {otherTeachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {transferError && <p className="text-brandRed">{transferError}</p>}
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            disabled={transferring || otherTeachers.length === 0}
                            onClick={() => handleConfirmTransfer(s)}
                            className="px-3 py-1.5 bg-brandGreen text-white font-semibold rounded hover:opacity-90 disabled:opacity-50"
                          >
                            {transferring ? 'Aktarılıyor…' : 'Aktarımı Onayla'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTransferringStudentId(null)}
                            className="px-3 py-1.5 border border-ink/20 rounded hover:bg-white text-muted"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="font-mono text-[10px] uppercase text-muted font-semibold mb-0.5">
                        Haftaya Dair Plan ve Öneriler
                      </div>
                      <p className="text-xs bg-cream/70 p-2.5 rounded text-ink whitespace-pre-wrap">
                        {s.weekly_plan?.trim() ? s.weekly_plan : '-'}
                      </p>
                    </div>

                    <div>
                      <div className="font-mono text-[10px] uppercase text-muted font-semibold mb-0.5">
                        Rehberlik Görüş ve Öneriler
                      </div>
                      <p className="text-xs bg-cream/70 p-2.5 rounded text-ink whitespace-pre-wrap">
                        {s.guidance_note?.trim() ? s.guidance_note : '-'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Son Giriş Kartı */}
          <div className="notebook-card">
            <h3 className="font-serif text-lg font-semibold text-ink mb-1">
              Öğretmenin Son Girişi
            </h3>
            <p className="font-mono text-sm text-ink mb-4">
              {activityData.logins && activityData.logins.length > 0
                ? fmtDateTime(activityData.logins[0])
                : 'Hiç giriş kaydı yok'}
            </p>
            <button
              type="button"
              onClick={() =>
                exportTeacherLoginsExcel(activityData.teacher_name, activityData.logins)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-brandGreen text-white text-xs font-semibold hover:opacity-90 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Giriş Geçmişini İndir</span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
};
