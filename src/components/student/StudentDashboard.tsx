import React, { useState, useEffect } from 'react';
import { Save, Plus } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { sb } from '../../lib/supabase';
import { Session, Student, Deneme } from '../../types';
import { Header } from '../common/Header';
import {
  SUBJECTS,
  fmtDate,
  todayStr,
  todayLabel,
  weekRange,
  inRange,
  sumEntries,
  entryTotal,
  QUOTES,
} from '../../lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface StudentDashboardProps {
  session: Session;
  onLogout: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ session, onLogout }) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Today question inputs
  const [todayCounts, setTodayCounts] = useState<Record<string, number>>({});
  const [savingEntry, setSavingEntry] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [goalFeedback, setGoalFeedback] = useState<{ hit: boolean; msg: string } | null>(null);
  const [activeQuote, setActiveQuote] = useState<{ text: string; author: string } | null>(null);

  // Deneme form
  const [denemeName, setDenemeName] = useState('');
  const [denemeScore, setDenemeScore] = useState('');
  const [denemeDate, setDenemeDate] = useState(todayStr());
  const [denemeLoading, setDenemeLoading] = useState(false);
  const [denemeError, setDenemeError] = useState('');

  const fetchStudentData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await sb.rpc('student_get_data', {
        p_student_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
      });

      if (rpcError || !data || data.error) {
        setError('Veriler yüklenemedi. Lütfen tekrar deneyin.');
        return;
      }

      setStudent(data);

      // Pre-fill today's counts if already entered
      const today = todayStr();
      const existingToday = (data.entries || []).find((e: any) => e.date === today);
      if (existingToday && existingToday.subjects) {
        setTodayCounts(existingToday.subjects);
      }
    } catch {
      setError('Bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, []);

  const handleSaveEntry = async () => {
    setSaveSuccessMsg(null);
    setGoalFeedback(null);
    setSavingEntry(true);

    const filtered: Record<string, number> = {};
    let totalQuestions = 0;
    Object.entries(todayCounts).forEach(([subj, count]) => {
      const num = Number(count) || 0;
      if (num > 0) {
        filtered[subj] = num;
        totalQuestions += num;
      }
    });

    try {
      const { data, error: rpcError } = await sb.rpc('student_save_entry', {
        p_student_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_subjects: filtered,
      });

      if (rpcError || !data || data.error) {
        alert('Kaydedilemedi, tekrar deneyin.');
        return;
      }

      const today = todayStr();
      if (student) {
        const newEntries = [...(student.entries || [])];
        const existingIdx = newEntries.findIndex((e) => e.date === today);
        if (existingIdx >= 0) {
          newEntries[existingIdx].subjects = filtered;
        } else {
          newEntries.push({ date: today, subjects: filtered });
        }
        setStudent({ ...student, entries: newEntries });
      }

      // Calculate goal status
      if (student && student.daily_target != null) {
        const diff = totalQuestions - student.daily_target;
        if (diff >= 0) {
          setGoalFeedback({
            hit: true,
            msg: `Hedefini ${diff} soru farkla geçtin! Harika iş! 🎉`,
          });
        } else {
          setGoalFeedback({
            hit: false,
            msg: `Bugünkü hedefe ${Math.abs(diff)} soru kaldı. Devam et!`,
          });
        }
      }

      // Pick random quote
      const randomQ = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      setActiveQuote(randomQ);
      setSaveSuccessMsg('Sorular başarıyla kaydedildi!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch {
      alert('Kayıt sırasında bağlantı hatası oluştu.');
    } finally {
      setSavingEntry(false);
    }
  };

  const handleAddDeneme = async (e: React.FormEvent) => {
    e.preventDefault();
    setDenemeError('');
    const name = denemeName.trim();
    const score = parseFloat(denemeScore);

    if (!name || isNaN(score) || !denemeDate) {
      setDenemeError('Tüm alanları doldurun.');
      return;
    }

    setDenemeLoading(true);
    try {
      const { data, error: rpcError } = await sb.rpc('student_add_deneme', {
        p_student_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_name: name,
        p_score: score,
        p_date: denemeDate,
      });

      if (rpcError || !data || data.error) {
        setDenemeError('Deneme eklenemedi.');
        return;
      }

      const newDeneme: Deneme = { id: data.id, name, score, date: denemeDate };
      if (student) {
        setStudent({
          ...student,
          denemeler: [...(student.denemeler || []), newDeneme],
        });
      }
      setDenemeName('');
      setDenemeScore('');
    } catch {
      setDenemeError('Deneme eklenirken hata oluştu.');
    } finally {
      setDenemeLoading(false);
    }
  };

  const handleDeleteDeneme = async (denemeId: string) => {
    if (!window.confirm('Bu deneme kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const { data, error: rpcError } = await sb.rpc('student_delete_deneme', {
        p_student_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_deneme_id: denemeId,
      });

      if (rpcError || !data || data.error) {
        alert('Silinemedi.');
        return;
      }

      if (student) {
        setStudent({
          ...student,
          denemeler: (student.denemeler || []).filter((d) => d.id !== denemeId),
        });
      }
    } catch {
      alert('Silme sırasında hata oluştu.');
    }
  };

  if (loading && !student) {
    return (
      <div className="notebook-card text-center py-12 text-muted text-sm animate-fadeIn">
        Bilgilerin yükleniyor…
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="notebook-card text-center py-8 space-y-3">
        <p className="text-brandRed text-sm">{error || 'Öğrenci bilgileri alınamadı.'}</p>
        <button
          type="button"
          onClick={fetchStudentData}
          className="px-4 py-2 bg-brandGreen text-white text-xs font-semibold rounded hover:opacity-90"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  // Calculations for stats and charts
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

  // Subject table & bar chart
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

  const subjectChartData = {
    labels: [...SUBJECTS],
    datasets: [
      {
        label: 'Toplam Soru',
        data: SUBJECTS.map((s) => totalBySubject[s] || 0),
        backgroundColor: '#2F6F4F',
        borderRadius: 4,
      },
    ],
  };

  // Last 7 days line chart
  const last7Days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    last7Days.push(local.toISOString().slice(0, 10));
  }
  const weekLineData = {
    labels: last7Days.map((d) => fmtDate(d).replace(/\s\d{4}$/, '')),
    datasets: [
      {
        label: 'Soru Sayısı',
        data: last7Days.map((d) => entryTotal(entries.find((en) => en.date === d))),
        borderColor: '#C0392B',
        backgroundColor: 'rgba(192, 57, 43, 0.12)',
        tension: 0.3,
        fill: true,
        pointRadius: 3.5,
      },
    ],
  };

  // Deneme chart
  const sortedDenemeler = (student.denemeler || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const denemeLineData = {
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
      <Header
        roleBadge="ÖĞRENCİ"
        title={`Merhaba, ${session.name}`}
        onLogout={onLogout}
        session={session}
      />

      {/* Bugün Kaç Soru Çözdün? */}
      <div className="notebook-card">
        <div className="font-mono text-xs uppercase tracking-wider text-muted font-semibold mb-1">
          {todayLabel()}
        </div>
        <h3 className="font-serif text-xl font-bold text-ink mb-4">
          Bugün Kaç Soru Çözdün?
        </h3>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {SUBJECTS.map((subj) => (
            <div key={subj}>
              <label className="block text-xs font-semibold text-muted mb-1">{subj}</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={todayCounts[subj] || ''}
                onChange={(e) =>
                  setTodayCounts({
                    ...todayCounts,
                    [subj]: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="w-full text-sm px-3 py-2 rounded border border-ink/20 bg-white font-mono"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={savingEntry}
          onClick={handleSaveEntry}
          className="w-full inline-flex items-center justify-center gap-1.5 bg-brandGreen text-white font-semibold py-2.5 px-4 rounded shadow-sm hover:opacity-90 disabled:opacity-50 text-sm transition-all"
        >
          <Save className="w-4 h-4" />
          <span>{savingEntry ? 'Kaydediliyor…' : 'Bugünkü Soruları Kaydet'}</span>
        </button>

        {saveSuccessMsg && (
          <p className="text-xs text-brandGreen font-medium text-center mt-2.5 bg-successBg p-2 rounded">
            {saveSuccessMsg}
          </p>
        )}

        {/* Goal message */}
        {goalFeedback && (
          <div
            className={`mt-3 p-3 rounded-md text-xs font-bold text-center border ${
              goalFeedback.hit
                ? 'bg-successBg text-brandGreen border-brandGreen/30'
                : 'bg-dangerBg text-brandRed border-brandRed/30'
            }`}
          >
            {goalFeedback.msg}
          </div>
        )}

        {/* Motivation quote */}
        {activeQuote && (
          <div className="mt-3 p-3.5 border-l-4 border-brandGold bg-cream/70 rounded-r-md text-xs italic text-ink space-y-1">
            <p>"{activeQuote.text}"</p>
            <p className="text-right not-italic font-semibold text-muted text-[11px]">
              — {activeQuote.author}
            </p>
          </div>
        )}
      </div>

      {/* İstatistiklerin */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-3">İstatistiklerin</h3>
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

      {/* Derslere Göre & Çubuk Grafik */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-3">Derslere Göre</h3>
        <div className="overflow-x-auto mb-4">
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

        <div className="h-44 w-full">
          <Bar
            data={subjectChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
                x: { ticks: { font: { size: 9 } } },
              },
            }}
          />
        </div>
      </div>

      {/* Son 7 Gün Çizgi Grafiği */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-3">Son 7 Gün</h3>
        <div className="h-44 w-full">
          <Line
            data={weekLineData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
            }}
          />
        </div>
      </div>

      {/* Denemelerim */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-3">Denemelerim</h3>

        <form onSubmit={handleAddDeneme} className="space-y-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Deneme Adı</label>
              <input
                type="text"
                placeholder="Örn: 2. Deneme"
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
                placeholder="465.0"
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
                data={denemeLineData}
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
          <p className="text-xs text-muted text-center py-3">Henüz deneme kaydın yok.</p>
        )}
      </div>

      {/* Haftaya Dair Planlananlar ve Öneriler */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-1">
          Haftaya Dair Planlananlar ve Öneriler
        </h3>
        <p className="text-xs text-ink/90 bg-cream/70 p-3 rounded-md leading-relaxed whitespace-pre-wrap">
          {student.weekly_plan?.trim()
            ? student.weekly_plan
            : 'Öğretmenin henüz bir plan yazmamış.'}
        </p>
      </div>

      {/* Rehberlik Görüş ve Öneriler */}
      <div className="notebook-card">
        <h3 className="font-serif text-lg font-semibold text-ink mb-1">
          Rehberlik Görüş ve Öneriler
        </h3>
        <p className="text-xs text-ink/90 bg-cream/70 p-3 rounded-md leading-relaxed whitespace-pre-wrap">
          {student.guidance_note?.trim()
            ? student.guidance_note
            : 'Öğretmenin henüz bir rehberlik notu yazmamış.'}
        </p>
      </div>
    </div>
  );
};
