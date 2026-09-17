import React, { useState, useRef } from 'react';
import { ArrowLeft, Download, Trash2, Save, Plus, Eye, EyeOff } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { sb } from '../../lib/supabase';
import { Session, Student, Deneme } from '../../types';
import {
  SUBJECTS,
  fmtDate,
  todayStr,
  relDateLabel,
  weekRange,
  inRange,
  sumEntries,
  entryTotal,
} from '../../lib/utils';
import { exportStudentFullReport } from '../../lib/excel';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface StudentDetailViewProps {
  session: Session;
  student: Student;
  onBack: () => void;
  onStudentUpdated: () => void;
  onStudentDeleted: () => void;
}

export const StudentDetailView: React.FC<StudentDetailViewProps> = ({
  session,
  student: initialStudent,
  onBack,
  onStudentUpdated,
  onStudentDeleted,
}) => {
  const [student, setStudent] = useState<Student>(initialStudent);
  const chartRef = useRef<any>(null);

  // Deneme form
  const [denemeName, setDenemeName] = useState('');
  const [denemeScore, setDenemeScore] = useState('');
  const [denemeDate, setDenemeDate] = useState(todayStr());
  const [denemeLoading, setDenemeLoading] = useState(false);
  const [denemeError, setDenemeError] = useState('');

  // Boş Güne Soru Girişi form
  const [entryDate, setEntryDate] = useState(todayStr());
  const [entrySubjectCounts, setEntrySubjectCounts] = useState<Record<string, number>>({});
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryMsg, setEntryMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Plan & Guidance
  const [weeklyPlan, setWeeklyPlan] = useState(student.weekly_plan || '');
  const [planSaving, setPlanSaving] = useState(false);
  const [guidanceNote, setGuidanceNote] = useState(student.guidance_note || '');
  const [guidanceSaving, setGuidanceSaving] = useState(false);

  // Target
  const [dailyTarget, setDailyTarget] = useState<string>(
    student.daily_target != null ? String(student.daily_target) : ''
  );
  const [targetSaving, setTargetSaving] = useState(false);

  // Credentials
  const [username, setUsername] = useState(student.username);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credError, setCredError] = useState('');

  // Excel Export loading
  const [exportLoading, setExportLoading] = useState(false);

  // Calculate statistics
  const entries = student.entries || [];
  const today = todayStr();
  const [wStart, wEnd] = weekRange(0);
  const [lwStart, lwEnd] = weekRange(-1);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const stats = [
    { label: 'Bugün', value: sumEntries(entries, (d) => d === today) },
    { label: 'Bu Hafta', value: sumEntries(entries, (d) => inRange(d, wStart, wEnd)) },
    { label: 'Geçen Hafta', value: sumEntries(entries, (d) => inRange(d, lwStart, lwEnd)) },
    { label: 'Bu Ay', value: sumEntries(entries, (d) => inRange(d, monthStart, monthEnd)) },
    { label: 'Geçen Ay', value: sumEntries(entries, (d) => inRange(d, lastMonthStart, lastMonthEnd)) },
    { label: 'Tüm Zamanlar', value: entries.reduce((sum, e) => sum + entryTotal(e), 0) },
  ];

  // Subject table calculations
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

  // Check if chosen entry date already has a record
  const existingEntry = entries.find((e) => e.date === entryDate);
  const isDateLocked = !!existingEntry;

  // Add deneme
  const handleAddDeneme = async (e: React.FormEvent) => {
    e.preventDefault();
    setDenemeError('');
    const name = denemeName.trim();
    const score = parseFloat(denemeScore);
    if (!name || isNaN(score) || !denemeDate) {
      setDenemeError('Lütfen tüm deneme alanlarını geçerli doldurun.');
      return;
    }

    setDenemeLoading(true);
    try {
      const { data, error: rpcError } = await sb.rpc('teacher_add_deneme', {
        p_teacher_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_student_id: student.id,
        p_name: name,
        p_score: score,
        p_date: denemeDate,
      });

      if (rpcError || !data || data.error) {
        setDenemeError('Deneme eklenemedi.');
        return;
      }

      const newDeneme: Deneme = { id: data.id, name, score, date: denemeDate };
      const updated = {
        ...student,
        denemeler: [...(student.denemeler || []), newDeneme],
      };
      setStudent(updated);
      setDenemeName('');
      setDenemeScore('');
      onStudentUpdated();
    } catch {
      setDenemeError('Deneme eklenirken hata oluştu.');
    } finally {
      setDenemeLoading(false);
    }
  };

  // Delete deneme
  const handleDeleteDeneme = async (denemeId: string) => {
    if (!window.confirm('Bu deneme kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const { data, error: rpcError } = await sb.rpc('teacher_delete_deneme', {
        p_teacher_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_deneme_id: denemeId,
      });

      if (rpcError || !data || data.error) {
        alert('Deneme silinemedi.');
        return;
      }

      const updated = {
        ...student,
        denemeler: (student.denemeler || []).filter((d) => d.id !== denemeId),
      };
      setStudent(updated);
      onStudentUpdated();
    } catch {
      alert('Silme sırasında hata oluştu.');
    }
  };

  // Save empty day entry
  const handleSaveEntry = async () => {
    setEntryMsg(null);
    if (!entryDate) {
      setEntryMsg({ type: 'error', text: 'Tarih seçiniz.' });
      return;
    }

    const filteredSubjects: Record<string, number> = {};
    Object.entries(entrySubjectCounts).forEach(([subj, count]) => {
      if (count > 0) filteredSubjects[subj] = count;
    });

    setEntrySaving(true);
    try {
      const { data, error: rpcError } = await sb.rpc('teacher_save_entry', {
        p_teacher_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_student_id: student.id,
        p_date: entryDate,
        p_subjects: filteredSubjects,
      });

      if (rpcError || !data || data.error) {
        setEntryMsg({ type: 'error', text: 'Kaydedilemedi, tekrar deneyin.' });
        return;
      }

      const newEntries = [...(student.entries || [])];
      const existingIdx = newEntries.findIndex((e) => e.date === entryDate);
      if (existingIdx >= 0) {
        newEntries[existingIdx].subjects = filteredSubjects;
      } else {
        newEntries.push({ date: entryDate, subjects: filteredSubjects });
      }

      const updatedStudent = {
        ...student,
        entries: newEntries,
        last_entry_date:
          !student.last_entry_date || entryDate > student.last_entry_date
            ? entryDate
            : student.last_entry_date,
      };
      setStudent(updatedStudent);
      setEntrySubjectCounts({});
      setEntryMsg({ type: 'success', text: 'Soru girişi başarıyla kaydedildi.' });
      onStudentUpdated();
    } catch {
      setEntryMsg({ type: 'error', text: 'Kayıt sırasında bağlantı hatası.' });
    } finally {
      setEntrySaving(false);
    }
  };

  // Save weekly plan
  const handleSavePlan = async () => {
    setPlanSaving(true);
    try {
      await sb.rpc('teacher_save_weekly_plan', {
        p_teacher_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_student_id: student.id,
        p_content: weeklyPlan,
      });
      setStudent({ ...student, weekly_plan: weeklyPlan });
      onStudentUpdated();
    } finally {
      setPlanSaving(false);
    }
  };

  // Save guidance note
  const handleSaveGuidance = async () => {
    setGuidanceSaving(true);
    try {
      await sb.rpc('teacher_save_guidance_note', {
        p_teacher_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_student_id: student.id,
        p_content: guidanceNote,
      });
      setStudent({ ...student, guidance_note: guidanceNote });
      onStudentUpdated();
    } finally {
      setGuidanceSaving(false);
    }
  };

  // Save daily target
  const handleSaveTarget = async () => {
    setTargetSaving(true);
    const parsed = dailyTarget === '' ? null : parseInt(dailyTarget, 10);
    try {
      await sb.rpc('teacher_update_target', {
        p_teacher_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_student_id: student.id,
        p_daily_target: parsed,
      });
      setStudent({ ...student, daily_target: parsed });
      onStudentUpdated();
    } finally {
      setTargetSaving(false);
    }
  };

  // Save credentials
  const handleSaveCredentials = async () => {
    setCredError('');
    const u = username.trim();
    const p = password.trim();
    if (!u) {
      setCredError('Kullanıcı adı boş bırakılamaz.');
      return;
    }

    setCredSaving(true);
    try {
      const { data, error: rpcError } = await sb.rpc('teacher_update_credentials', {
        p_teacher_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_student_id: student.id,
        p_username: u,
        p_student_password: p || null,
      });

      if (rpcError || !data || data.error) {
        setCredError(
          data?.error === 'username_taken'
            ? 'Bu kullanıcı adı başka bir öğrencide kayıtlı.'
            : 'Güncellenemedi.'
        );
        return;
      }
      setStudent({ ...student, username: u });
      setPassword('');
      onStudentUpdated();
    } catch {
      setCredError('Güncelleme hatası.');
    } finally {
      setCredSaving(false);
    }
  };

  // Delete student
  const handleDeleteStudent = async () => {
    if (
      !window.confirm(
        `${student.name} adlı öğrenciyi ve tüm kayıtlarını silmek istediğine emin misin? Bu işlem geri alınamaz.`
      )
    ) {
      return;
    }

    try {
      const { data, error: rpcError } = await sb.rpc('teacher_delete_student', {
        p_teacher_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_student_id: student.id,
      });

      if (rpcError || !data || data.error) {
        alert('Öğrenci silinemedi.');
        return;
      }
      onStudentDeleted();
    } catch {
      alert('Silme sırasında hata oluştu.');
    }
  };

  // Export report
  const handleExportReport = async () => {
    setExportLoading(true);
    try {
      const canvas = chartRef.current?.canvas || null;
      await exportStudentFullReport(student, canvas);
    } catch {
      alert('Excel raporu oluşturulamadı.');
    } finally {
      setExportLoading(false);
    }
  };

  // Deneme chart data
  const sortedDenemeler = (student.denemeler || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const denemeChartData = {
    labels: sortedDenemeler.map((d) => fmtDate(d.date)),
    datasets: [
      {
        label: 'Puan',
        data: sortedDenemeler.map((d) => Number(d.score)),
        borderColor: '#B8902E',
        backgroundColor: 'rgba(184, 144, 46, 0.12)',
        tension: 0.3,
        fill: true,
        pointRadius: 3.5,
      },
    ],
  };

  return (
    <div className="animate-fadeIn space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink font-semibold transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Öğrenci listesine dön</span>
      </button>

      <div>
        <span className="font-mono text-xs uppercase tracking-wider text-muted font-semibold">
          ÖĞRENCİ
        </span>
        <h2 className="font-serif text-2xl font-bold text-ink">{student.name}</h2>
      </div>

      {/* Son Giriş */}
      <div className="notebook-card">
        <div className="font-mono text-xs uppercase tracking-wider text-muted font-semibold mb-1">
          Son Soru Girişi
        </div>
        <p className="font-mono text-base font-semibold text-ink">
          {relDateLabel(student.last_entry_date)}
        </p>
      </div>

      {/* İstatistikler */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-3">İstatistikler</h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {stats.map((st) => (
            <div
              key={st.label}
              className="bg-cream/70 rounded-md p-2.5 text-center border border-ink/5"
            >
              <div className="font-mono text-xl sm:text-2xl font-bold text-ink">{st.value}</div>
              <div className="text-[10px] sm:text-xs font-mono uppercase text-muted tracking-wider mt-1">
                {st.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Derslere Göre */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-3">Derslere Göre</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-ink/10 text-muted font-mono uppercase text-[10px]">
                <th className="py-2 px-1">Ders</th>
                <th className="py-2 px-1 text-right">Bu Hafta</th>
                <th className="py-2 px-1 text-right">Toplam</th>
                <th className="py-2 px-1 text-right">Yüzde</th>
              </tr>
            </thead>
            <tbody>
              {SUBJECTS.map((subj) => {
                const pct =
                  grandTotal > 0
                    ? Math.round(((totalBySubject[subj] || 0) / grandTotal) * 100)
                    : 0;
                return (
                  <tr key={subj} className="border-b border-ink/5 hover:bg-cream/40">
                    <td className="py-2 px-1 font-medium text-ink">{subj}</td>
                    <td className="py-2 px-1 text-right font-mono text-muted">
                      {weekBySubject[subj] || 0}
                    </td>
                    <td className="py-2 px-1 text-right font-mono font-semibold text-ink">
                      {totalBySubject[subj] || 0}
                    </td>
                    <td className="py-2 px-1 text-right font-mono text-brandGreen font-semibold">
                      %{pct}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Denemeler */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-3">Denemeler</h3>

        <form onSubmit={handleAddDeneme} className="space-y-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Deneme Adı</label>
              <input
                type="text"
                placeholder="Örn: 3. Deneme"
                value={denemeName}
                onChange={(e) => setDenemeName(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-2 rounded border border-ink/20 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Puan</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="450.5"
                value={denemeScore}
                onChange={(e) => setDenemeScore(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-2 rounded border border-ink/20 bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Tarih</label>
              <input
                type="date"
                max={todayStr()}
                value={denemeDate}
                onChange={(e) => setDenemeDate(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-2 rounded border border-ink/20 bg-white"
              />
            </div>
          </div>

          {denemeError && <p className="text-brandRed text-xs">{denemeError}</p>}

          <button
            type="submit"
            disabled={denemeLoading}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-brandGreen text-white text-xs font-semibold py-2 px-3 rounded hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{denemeLoading ? 'Ekleniyor…' : 'Deneme Ekle'}</span>
          </button>
        </form>

        {sortedDenemeler.length > 0 ? (
          <>
            <div className="h-44 w-full mb-4">
              <Line
                ref={chartRef}
                data={denemeChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: false } },
                }}
              />
            </div>

            <div className="divide-y divide-ink/10">
              {sortedDenemeler.slice().reverse().map((d) => (
                <div key={d.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-ink">{d.name}</div>
                    <div className="text-[11px] text-muted">{fmtDate(d.date)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-brandGold">{d.score}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteDeneme(d.id)}
                      className="text-brandRed hover:underline text-xs"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted text-center py-3">Henüz kayıtlı deneme bulunmuyor.</p>
        )}
      </div>

      {/* Boş Güne Soru Girişi */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-1">Boş Güne Soru Girişi</h3>
        <p className="text-xs text-muted mb-3">
          Öğrenci girmeyi unutursa, sadece kaydı olmayan bir gün için soru girebilirsiniz. Girilmiş günler değiştirilemez.
        </p>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-muted mb-1">Tarih</label>
          <input
            type="date"
            max={todayStr()}
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded border border-ink/20 bg-white"
          />
        </div>

        {isDateLocked ? (
          <div className="p-3 bg-dangerBg text-brandRed rounded text-xs mb-3 border border-brandRed/20">
            Bu gün için zaten soru kaydı bulunmaktadır — kilitlidir ve değiştirilemez.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {SUBJECTS.map((subj) => (
                <div key={subj}>
                  <label className="block text-[11px] font-semibold text-muted mb-0.5">
                    {subj}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={entrySubjectCounts[subj] || ''}
                    onChange={(e) =>
                      setEntrySubjectCounts({
                        ...entrySubjectCounts,
                        [subj]: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    placeholder="0"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-ink/20 bg-white font-mono"
                  />
                </div>
              ))}
            </div>

            {entryMsg && (
              <p
                className={`text-xs p-2 rounded mb-2 ${
                  entryMsg.type === 'error'
                    ? 'text-brandRed bg-dangerBg'
                    : 'text-brandGreen bg-successBg'
                }`}
              >
                {entryMsg.text}
              </p>
            )}

            <button
              type="button"
              disabled={entrySaving}
              onClick={handleSaveEntry}
              className="w-full inline-flex items-center justify-center gap-1 bg-brandGreen text-white text-xs font-semibold py-2 px-3 rounded hover:opacity-90 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{entrySaving ? 'Kaydediliyor…' : 'Kaydet'}</span>
            </button>
          </>
        )}
      </div>

      {/* Haftalık Plan */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-1">
          Haftaya Dair Planlananlar ve Öneriler
        </h3>
        <p className="text-xs text-muted mb-2">Öğrenci bu alanı kendi panelinde salt-okunur olarak görür.</p>
        <textarea
          rows={3}
          value={weeklyPlan}
          onChange={(e) => setWeeklyPlan(e.target.value)}
          placeholder="Bu hafta öğrenciden beklentileriniz..."
          className="w-full text-xs p-2.5 rounded border border-ink/20 bg-white mb-2"
        />
        <button
          type="button"
          disabled={planSaving}
          onClick={handleSavePlan}
          className="w-full bg-brandGreen text-white text-xs font-semibold py-2 px-3 rounded hover:opacity-90 disabled:opacity-50"
        >
          {planSaving ? 'Kaydediliyor…' : 'Planı Kaydet'}
        </button>
      </div>

      {/* Rehberlik Notu */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-1">
          Rehberlik Görüş ve Öneriler
        </h3>
        <p className="text-xs text-muted mb-2">Öğrenci bu alanı kendi panelinde salt-okunur olarak görür.</p>
        <textarea
          rows={3}
          value={guidanceNote}
          onChange={(e) => setGuidanceNote(e.target.value)}
          placeholder="Motivasyon ve çalışma alışkanlıkları gözlemleriniz..."
          className="w-full text-xs p-2.5 rounded border border-ink/20 bg-white mb-2"
        />
        <button
          type="button"
          disabled={guidanceSaving}
          onClick={handleSaveGuidance}
          className="w-full bg-brandGreen text-white text-xs font-semibold py-2 px-3 rounded hover:opacity-90 disabled:opacity-50"
        >
          {guidanceSaving ? 'Kaydediliyor…' : 'Notu Kaydet'}
        </button>
      </div>

      {/* Günlük Hedef */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-2">Günlük Hedef</h3>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={dailyTarget}
            onChange={(e) => setDailyTarget(e.target.value)}
            placeholder="Hedef soru sayısı (opsiyonel)"
            className="flex-1 text-xs px-3 py-2 rounded border border-ink/20 bg-white font-mono"
          />
          <button
            type="button"
            disabled={targetSaving}
            onClick={handleSaveTarget}
            className="bg-brandGreen text-white text-xs font-semibold px-4 py-2 rounded hover:opacity-90 disabled:opacity-50"
          >
            {targetSaving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Excel Rapor İndir */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-1">Excel Olarak İndir</h3>
        <p className="text-xs text-muted mb-3">
          Özet, ders dağılımları, günlük sorular, deneme tablosu ve grafik görseli içeren tam öğrenci raporu.
        </p>
        <button
          type="button"
          disabled={exportLoading}
          onClick={handleExportReport}
          className="w-full inline-flex items-center justify-center gap-2 bg-brandGreen text-white text-xs sm:text-sm font-semibold py-2.5 px-4 rounded shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{exportLoading ? 'Rapor Oluşturuluyor…' : 'Excel Raporu İndir'}</span>
        </button>
      </div>

      {/* Giriş Bilgileri */}
      <div className="notebook-card space-y-2">
        <h3 className="font-serif text-lg font-semibold text-ink mb-2">Giriş Bilgileri</h3>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">Kullanıcı Adı</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded border border-ink/20 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted mb-1">
            Yeni Şifre <span className="font-normal text-muted/70">(değiştirmek için doldurun)</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Değiştirmek için yeni şifre girin"
              className="w-full text-xs px-3 py-2 pr-9 rounded border border-ink/20 bg-white font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-2 text-muted hover:text-ink p-0.5 rounded transition-colors"
              title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        {credError && <p className="text-brandRed text-xs">{credError}</p>}
        <button
          type="button"
          disabled={credSaving}
          onClick={handleSaveCredentials}
          className="w-full bg-brandGreen text-white text-xs font-semibold py-2 px-3 rounded hover:opacity-90 disabled:opacity-50 mt-1"
        >
          {credSaving ? 'Kaydediliyor…' : 'Giriş Bilgilerini Kaydet'}
        </button>
      </div>

      {/* Tehlikeli Bölge */}
      <div className="notebook-card border border-brandRed/30">
        <h3 className="font-serif text-lg font-semibold text-brandRed mb-1">Tehlikeli Bölge</h3>
        <p className="text-xs text-muted mb-3">
          Öğrenciyi ve tüm kayıtlarını (sorular, denemeler, plan ve notlar) kalıcı olarak siler.
        </p>
        <button
          type="button"
          onClick={handleDeleteStudent}
          className="w-full inline-flex items-center justify-center gap-1.5 bg-brandRed text-white text-xs font-semibold py-2 px-3 rounded hover:opacity-90"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Öğrenciyi Sil</span>
        </button>
      </div>
    </div>
  );
};
