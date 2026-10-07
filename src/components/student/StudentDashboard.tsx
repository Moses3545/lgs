import React, { useState, useEffect } from 'react';
import {
  Save,
  Plus,
  BookOpen,
  FileText,
  Calculator,
  FlaskConical,
  Landmark,
  HeartHandshake,
  Globe,
  Target,
} from 'lucide-react';
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
import { createSampleStudent } from '../../lib/demoData';
import {
  SUBJECTS,
  fmtDate,
  todayStr,
  todayLabel,
  weekRange,
  inRange,
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

    // Yerel Demo Modu Kontrolü
    if (session.id === 'demo-student') {
      const sample = createSampleStudent();
      setStudent(sample);
      const today = todayStr();
      const existingToday = (sample.entries || []).find((e: any) => e.date === today);
      if (existingToday && existingToday.subjects) {
        setTodayCounts(existingToday.subjects);
      }
      setLoading(false);
      return;
    }

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
  const [wStart, wEnd] = weekRange(0);
  const currentMonthPrefix = todayStr().slice(0, 7); // 'YYYY-MM'

  // Subject table & bar chart
  const weekBySubject: Record<string, number> = {};
  const monthBySubject: Record<string, number> = {};
  const totalBySubject: Record<string, number> = {};
  SUBJECTS.forEach((s) => {
    weekBySubject[s] = 0;
    monthBySubject[s] = 0;
    totalBySubject[s] = 0;
  });
  entries.forEach((e) => {
    const inWeek = inRange(e.date, wStart, wEnd);
    const inMonth = e.date.startsWith(currentMonthPrefix);
    Object.entries(e.subjects || {}).forEach(([subj, count]) => {
      const c = Number(count) || 0;
      if (!(subj in totalBySubject)) {
        totalBySubject[subj] = 0;
        weekBySubject[subj] = 0;
        monthBySubject[subj] = 0;
      }
      totalBySubject[subj] += c;
      if (inWeek) weekBySubject[subj] += c;
      if (inMonth) monthBySubject[subj] += c;
    });
  });
  const weekTotal = Object.values(weekBySubject).reduce((a, b) => a + b, 0);
  const monthTotal = Object.values(monthBySubject).reduce((a, b) => a + b, 0);
  const grandTotal = Object.values(totalBySubject).reduce((a, b) => a + b, 0);

  const subjectChartData = {
    labels: [...SUBJECTS],
    datasets: [
      {
        label: 'Toplam Soru',
        data: SUBJECTS.map((s) => totalBySubject[s] || 0),
        backgroundColor: [
          '#FF2D55', // Türkçe (Canlı Pembe/Kırmızı)
          '#00C7BE', // Paragraf (Canlı Turkuaz / Teal)
          '#007AFF', // Matematik (Elektrik Mavisi)
          '#10B981', // Fen Bilimleri (Zümrüt Yeşili)
          '#FF9500', // İnkılap (Sıcak Turuncu)
          '#AF52DE', // Din Kültürü (Canlı Mor)
          '#5856D6', // İngilizce (Parlak İndigo)
        ],
        borderRadius: 10,
      },
    ],
  };

  const SUBJECT_META: Record<string, {
    bgLight: string;
    border: string;
    text: string;
    ring: string;
    badge: string;
    icon: React.ReactNode;
  }> = {
    'Türkçe': {
      bgLight: 'bg-gradient-to-b from-rose-50/90 to-white',
      border: 'border-rose-200 hover:border-rose-400',
      text: 'text-rose-700',
      ring: 'focus-within:ring-4 focus-within:ring-rose-500/20 focus-within:border-rose-500',
      badge: 'bg-rose-500 text-white',
      icon: <BookOpen className="w-4 h-4 text-rose-600" />,
    },
    'Paragraf': {
      bgLight: 'bg-gradient-to-b from-teal-50/90 to-white',
      border: 'border-teal-200 hover:border-teal-400',
      text: 'text-teal-700',
      ring: 'focus-within:ring-4 focus-within:ring-teal-500/20 focus-within:border-teal-500',
      badge: 'bg-teal-500 text-white',
      icon: <FileText className="w-4 h-4 text-teal-600" />,
    },
    'Matematik': {
      bgLight: 'bg-gradient-to-b from-blue-50/90 to-white',
      border: 'border-blue-200 hover:border-blue-400',
      text: 'text-blue-700',
      ring: 'focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-500',
      badge: 'bg-blue-500 text-white',
      icon: <Calculator className="w-4 h-4 text-blue-600" />,
    },
    'Fen Bilimleri': {
      bgLight: 'bg-gradient-to-b from-emerald-50/90 to-white',
      border: 'border-emerald-200 hover:border-emerald-400',
      text: 'text-emerald-700',
      ring: 'focus-within:ring-4 focus-within:ring-emerald-500/20 focus-within:border-emerald-500',
      badge: 'bg-emerald-500 text-white',
      icon: <FlaskConical className="w-4 h-4 text-emerald-600" />,
    },
    'T.C. İnkılap Tarihi': {
      bgLight: 'bg-gradient-to-b from-amber-50/90 to-white',
      border: 'border-amber-200 hover:border-amber-400',
      text: 'text-amber-700',
      ring: 'focus-within:ring-4 focus-within:ring-amber-500/20 focus-within:border-amber-500',
      badge: 'bg-amber-500 text-white',
      icon: <Landmark className="w-4 h-4 text-amber-600" />,
    },
    'Din Kültürü': {
      bgLight: 'bg-gradient-to-b from-purple-50/90 to-white',
      border: 'border-purple-200 hover:border-purple-400',
      text: 'text-purple-700',
      ring: 'focus-within:ring-4 focus-within:ring-purple-500/20 focus-within:border-purple-500',
      badge: 'bg-purple-500 text-white',
      icon: <HeartHandshake className="w-4 h-4 text-purple-600" />,
    },
    'İngilizce': {
      bgLight: 'bg-gradient-to-b from-indigo-50/90 to-white',
      border: 'border-indigo-200 hover:border-indigo-400',
      text: 'text-indigo-700',
      ring: 'focus-within:ring-4 focus-within:ring-indigo-500/20 focus-within:border-indigo-500',
      badge: 'bg-indigo-500 text-white',
      icon: <Globe className="w-4 h-4 text-indigo-600" />,
    },
  };

  // Deneme chart
  const sortedDenemeler = (student.denemeler || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const denemeLineData = {
    labels: sortedDenemeler.map((d) => fmtDate(d.date)),
    datasets: [
      {
        label: 'Puan',
        data: sortedDenemeler.map((d) => Number(d.score)),
        borderColor: '#FF9500',
        backgroundColor: 'rgba(255, 149, 0, 0.15)',
        tension: 0.35,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#FF9500',
      },
    ],
  };

  return (
    <div className="animate-fadeIn space-y-4">
      <Header
        roleBadge="ÖĞRENCİ"
        title={`Merhaba, ${session.name} 👋`}
        onLogout={onLogout}
        session={session}
      />

      {/* 3 Canlı Özet Kutucuğu: Bu Hafta, Bu Ay, Toplam */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        {/* Bu Hafta */}
        <div className="bg-gradient-to-br from-[#007AFF] via-[#3B82F6] to-[#4F46E5] text-white rounded-2xl p-3 sm:p-4 text-center shadow-lg shadow-blue-500/20 flex flex-col justify-between transition-all hover:scale-[1.02]">
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-blue-100 flex items-center justify-center gap-1">
            <span>⚡</span> Bu Hafta
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black my-1 tracking-tight drop-shadow-xs">
            {weekTotal.toLocaleString('tr-TR')}
          </div>
          <div className="text-[10px] font-bold bg-white/20 text-white py-0.5 px-2.5 rounded-full mx-auto backdrop-blur-xs">
            haftalık
          </div>
        </div>

        {/* Bu Ay */}
        <div className="bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] text-white rounded-2xl p-3 sm:p-4 text-center shadow-lg shadow-emerald-500/20 flex flex-col justify-between transition-all hover:scale-[1.02]">
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-100 flex items-center justify-center gap-1">
            <span>🚀</span> Bu Ay
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black my-1 tracking-tight drop-shadow-xs">
            {monthTotal.toLocaleString('tr-TR')}
          </div>
          <div className="text-[10px] font-bold bg-white/20 text-white py-0.5 px-2.5 rounded-full mx-auto backdrop-blur-xs">
            aylık
          </div>
        </div>

        {/* Toplam */}
        <div className="bg-gradient-to-br from-[#FF9500] via-[#F97316] to-[#EA580C] text-white rounded-2xl p-3 sm:p-4 text-center shadow-lg shadow-orange-500/20 flex flex-col justify-between transition-all hover:scale-[1.02]">
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-orange-100 flex items-center justify-center gap-1">
            <span>🏆</span> Toplam
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-black my-1 tracking-tight drop-shadow-xs">
            {grandTotal.toLocaleString('tr-TR')}
          </div>
          <div className="text-[10px] font-bold bg-white/20 text-white py-0.5 px-2.5 rounded-full mx-auto backdrop-blur-xs">
            genel
          </div>
        </div>
      </div>

      {/* Bugün Kaç Soru Çözdün? */}
      <div className="notebook-card p-5 sm:p-6 border border-white shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center text-sm shadow-xs">
              🎯
            </span>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-ink tracking-tight">
                Bugün Kaç Soru Çözdün?
              </h3>
              <p className="text-xs text-[#8E8E93] font-medium">{todayLabel()}</p>
            </div>
          </div>
          {student.daily_target != null && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-[#007AFF] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              <Target className="w-3.5 h-3.5" />
              <span>Hedef: {student.daily_target} soru</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
          {SUBJECTS.map((subj) => {
            const meta = SUBJECT_META[subj] || {
              bgLight: 'bg-white',
              border: 'border-black/[0.08]',
              text: 'text-ink',
              ring: 'focus-within:ring-2 focus-within:ring-blue-500/30',
              badge: 'bg-gray-100 text-ink',
              icon: null,
            };

            return (
              <div
                key={subj}
                className={`${meta.bgLight} border-2 ${meta.border} ${meta.ring} rounded-2xl p-3 transition-all flex flex-col justify-between shadow-xs hover:shadow-sm`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                    <span className="flex-shrink-0">{meta.icon}</span>
                    <label className={`text-xs font-black truncate ${meta.text}`}>
                      {subj}
                    </label>
                  </div>
                </div>
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
                  className="w-full text-lg font-mono font-black text-ink px-2 py-2 rounded-xl border border-black/[0.08] bg-white shadow-inner focus:outline-none text-center focus:bg-white transition-all"
                />
              </div>
            );
          })}
        </div>

        <button
          type="button"
          disabled={savingEntry}
          onClick={handleSaveEntry}
          className="w-full inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#10B981] via-[#059669] to-[#047857] hover:brightness-105 active:scale-[0.98] text-white font-black text-sm sm:text-base py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-500/25 transition-all ios-press disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{savingEntry ? 'Kaydediliyor…' : 'Bugünkü Soruları Kaydet 🚀'}</span>
        </button>

        {saveSuccessMsg && (
          <p className="text-xs text-emerald-800 font-bold text-center mt-3 bg-emerald-100/90 p-3 rounded-2xl border border-emerald-300 animate-fadeIn">
            {saveSuccessMsg}
          </p>
        )}

        {/* Goal message */}
        {goalFeedback && (
          <div
            className={`mt-3 p-3.5 rounded-2xl text-xs font-bold text-center border animate-fadeIn ${
              goalFeedback.hit
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 border-emerald-400'
                : 'bg-amber-50 text-amber-900 border-amber-300'
            }`}
          >
            {goalFeedback.msg}
          </div>
        )}

        {/* Motivation quote */}
        {activeQuote && (
          <div className="mt-3.5 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl text-xs italic text-ink space-y-1 shadow-2xs">
            <p className="leading-relaxed font-medium">"{activeQuote.text}"</p>
            <p className="text-right not-italic font-bold text-amber-700 text-[11px]">
              — {activeQuote.author}
            </p>
          </div>
        )}
      </div>

      {/* Derslere Göre & Çubuk Grafik */}
      <div className="notebook-card p-5 sm:p-6 border border-white shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm shadow-xs">
            📊
          </span>
          <h3 className="text-lg sm:text-xl font-black text-ink tracking-tight">Derslere Göre Dağılım</h3>
        </div>
        <div className="overflow-x-auto mb-5">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-black/[0.08] text-[#8E8E93] uppercase font-bold text-[10px] tracking-wider">
                <th className="py-2.5 px-2">Ders</th>
                <th className="py-2.5 px-2 text-right">Bu Hafta</th>
                <th className="py-2.5 px-2 text-right">Bu Ay</th>
                <th className="py-2.5 px-2 text-right">Toplam</th>
                <th className="py-2.5 px-2 text-right">Oran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {SUBJECTS.map((subj) => {
                const pct =
                  grandTotal > 0
                    ? Math.round(((totalBySubject[subj] || 0) / grandTotal) * 100)
                    : 0;
                const meta = SUBJECT_META[subj];
                return (
                  <tr key={subj} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-2.5 px-2 font-bold text-ink flex items-center gap-1.5">
                      <span>{meta?.icon}</span>
                      <span>{subj}</span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium text-[#8E8E93]">
                      {weekBySubject[subj] || 0}
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-emerald-600">
                      {monthBySubject[subj] || 0}
                    </td>
                    <td className="py-2.5 px-2 text-right font-black text-ink">
                      {totalBySubject[subj] || 0}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                        %{pct}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black/[0.08] font-bold bg-gray-50/80 text-ink">
                <td className="py-3 px-2 font-black">Toplam</td>
                <td className="py-3 px-2 text-right font-bold text-[#8E8E93]">
                  {weekTotal.toLocaleString('tr-TR')}
                </td>
                <td className="py-3 px-2 text-right font-bold text-emerald-600">
                  {monthTotal.toLocaleString('tr-TR')}
                </td>
                <td className="py-3 px-2 text-right font-black text-ink">
                  {grandTotal.toLocaleString('tr-TR')}
                </td>
                <td className="py-3 px-2 text-right font-bold text-amber-600">
                  %100
                </td>
              </tr>
            </tfoot>
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
                x: { ticks: { font: { size: 9, weight: 'bold' } } },
              },
            }}
          />
        </div>
      </div>

      {/* Denemelerim */}
      <div className="notebook-card p-5 sm:p-6 border border-white shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center text-sm shadow-xs">
            📝
          </span>
          <h3 className="text-lg sm:text-xl font-black text-ink tracking-tight">Denemelerim</h3>
        </div>

        <form onSubmit={handleAddDeneme} className="space-y-3 mb-4 bg-gradient-to-r from-amber-50/80 to-orange-50/80 p-4 rounded-2xl border border-amber-200/80">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">Deneme Adı</label>
              <input
                type="text"
                placeholder="Örn: 2. Deneme"
                value={denemeName}
                onChange={(e) => setDenemeName(e.target.value)}
                required
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-amber-200 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">Puan</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="465.0"
                value={denemeScore}
                onChange={(e) => setDenemeScore(e.target.value)}
                required
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-amber-200 bg-white font-mono font-bold shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">Tarih</label>
              <input
                type="date"
                max={todayStr()}
                value={denemeDate}
                onChange={(e) => setDenemeDate(e.target.value)}
                required
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-amber-200 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </div>

          {denemeError && <p className="text-rose-600 text-xs font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">{denemeError}</p>}

          <button
            type="submit"
            disabled={denemeLoading}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md shadow-amber-500/25 active:scale-[0.98] disabled:opacity-50 transition-all ios-press"
          >
            <Plus className="w-4 h-4" />
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

            <div className="space-y-2">
              {sortedDenemeler.slice().reverse().map((d) => (
                <div
                  key={d.id}
                  className="p-3 bg-white hover:bg-orange-50/40 rounded-2xl border border-black/[0.06] transition-colors flex items-center justify-between text-xs shadow-xs"
                >
                  <div>
                    <div className="font-bold text-ink">{d.name}</div>
                    <div className="text-[11px] text-[#8E8E93]">{fmtDate(d.date)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-sm text-orange-600 bg-orange-100 px-3 py-1 rounded-xl shadow-xs">
                      {d.score}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteDeneme(d.id)}
                      className="text-rose-500 hover:text-rose-700 text-xs font-bold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors ios-press"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-[#8E8E93] text-center py-3">Henüz deneme kaydın yok.</p>
        )}
      </div>

      {/* Haftaya Dair Planlananlar ve Öneriler */}
      <div className="notebook-card p-5 sm:p-6 border border-white shadow-md">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
            📅
          </span>
          <h3 className="text-lg font-black text-ink tracking-tight">
            Haftaya Dair Planlananlar ve Öneriler
          </h3>
        </div>
        <p className="text-xs text-blue-950 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200/80 p-4 rounded-2xl leading-relaxed whitespace-pre-wrap font-medium shadow-xs">
          {student.weekly_plan?.trim()
            ? student.weekly_plan
            : 'Öğretmenin henüz bir plan yazmamış.'}
        </p>
      </div>

      {/* Rehberlik Görüş ve Öneriler */}
      <div className="notebook-card p-5 sm:p-6 border border-white shadow-md">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">
              💡
            </span>
            <h3 className="text-lg font-black text-ink tracking-tight">
              Rehberlik Görüş ve Öneriler
            </h3>
          </div>
          {student.guidance_note?.trim() && (
            <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">
              Yeni Değerlendirme
            </span>
          )}
        </div>
        <p className="text-xs text-purple-950 bg-gradient-to-r from-purple-50/90 to-pink-50/90 border border-purple-200/80 p-4 rounded-2xl leading-relaxed whitespace-pre-wrap font-medium shadow-xs">
          {student.guidance_note?.trim()
            ? student.guidance_note
            : 'Rehberlik uzmanınız veya öğretmeniniz henüz bir rehberlik notu paylaşmadı.'}
        </p>
      </div>
    </div>
  );
};
