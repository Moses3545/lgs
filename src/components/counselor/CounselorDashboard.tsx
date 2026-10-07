import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Sparkles, Download, ChevronRight } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { Session, Student, Teacher } from '../../types';
import { Header } from '../common/Header';
import { CounselorStudentDetailView } from './CounselorStudentDetailView';
import { todayStr, weekRange, inRange, entryTotal, relDateLabel } from '../../lib/utils';
import { exportAllStudentsByAdmin } from '../../lib/excel';

interface CounselorDashboardProps {
  session: Session;
  onLogout: () => void;
}

type FilterStatus = 'all' | 'active-today' | 'has-note' | 'no-note' | 'target-reached';
type SortOption = 'name-asc' | 'teacher-asc' | 'week-questions-desc' | 'last-entry-desc';

export const CounselorDashboard: React.FC<CounselorDashboardProps> = ({ session, onLogout }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected student for detail view
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [exportLoading, setExportLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await sb.rpc('counselor_get_data', {
        p_counselor_id: session.id,
        p_session_token: session.sessionToken,
      });

      if (rpcError || !data || data.error) {
        console.error('counselor_get_data error:', rpcError || data?.error);
        setError('Öğrenci ve öğretmen verileri alınamadı.');
        return;
      }

      setTeachers(data.teachers || []);
      setStudents(data.students || []);
    } catch (err) {
      console.error(err);
      setError('Bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Hafta aralığı
  const [wStart, wEnd] = weekRange(0);
  const today = todayStr();

  // Her öğrenci için bu hafta çözülen soru ve bugün çözülen soru hesaplama
  const studentMetrics = useMemo(() => {
    const metrics: Record<string, { todayCount: number; weekCount: number }> = {};
    students.forEach((s) => {
      let tCount = 0;
      let wCount = 0;
      (s.entries || []).forEach((e) => {
        const tot = entryTotal(e);
        if (e.date === today) tCount += tot;
        if (inRange(e.date, wStart, wEnd)) wCount += tot;
      });
      metrics[s.id] = { todayCount: tCount, weekCount: wCount };
    });
    return metrics;
  }, [students, today, wStart, wEnd]);

  // Filtrelenmiş ve Sıralanmış Öğrenciler
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        // Öğretmen filtresi
        if (selectedTeacherId !== 'all' && s.teacher_id !== selectedTeacherId) {
          return false;
        }

        // Arama sorgusu
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = s.name.toLowerCase().includes(q);
          const teacherMatch = (s.teacher_name || '').toLowerCase().includes(q);
          const usernameMatch = s.username.toLowerCase().includes(q);
          if (!nameMatch && !teacherMatch && !usernameMatch) return false;
        }

        // Durum filtresi
        const m = studentMetrics[s.id] || { todayCount: 0, weekCount: 0 };
        if (statusFilter === 'active-today' && m.todayCount === 0) return false;
        if (statusFilter === 'has-note' && (!s.guidance_note || !s.guidance_note.trim())) return false;
        if (statusFilter === 'no-note' && s.guidance_note && s.guidance_note.trim()) return false;
        if (statusFilter === 'target-reached') {
          if (!s.daily_target || m.todayCount < s.daily_target) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name-asc') {
          return a.name.localeCompare(b.name, 'tr');
        }
        if (sortBy === 'teacher-asc') {
          return (a.teacher_name || '').localeCompare(b.teacher_name || '', 'tr');
        }
        if (sortBy === 'week-questions-desc') {
          const wA = studentMetrics[a.id]?.weekCount || 0;
          const wB = studentMetrics[b.id]?.weekCount || 0;
          return wB - wA;
        }
        if (sortBy === 'last-entry-desc') {
          return (b.last_entry_date || '').localeCompare(a.last_entry_date || '');
        }
        return 0;
      });
  }, [students, selectedTeacherId, searchQuery, statusFilter, sortBy, studentMetrics]);

  // Genel KPI İstatistikleri
  const totalStudents = students.length;
  const activeTodayCount = Object.values(studentMetrics).filter((m) => m.todayCount > 0).length;
  const totalWeekQuestions = Object.values(studentMetrics).reduce((acc, m) => acc + m.weekCount, 0);
  const studentsWithNoteCount = students.filter((s) => s.guidance_note && s.guidance_note.trim()).length;

  const handleExportAll = () => {
    setExportLoading(true);
    try {
      exportAllStudentsByAdmin(students);
    } catch (err) {
      console.error(err);
      alert('Excel raporu indirilirken hata oluştu.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleStudentUpdated = (updatedStudent: Student) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s))
    );
  };

  // Seçili öğrenci varsa detay görünümüne geç
  const currentSelectedStudent = students.find((s) => s.id === selectedStudentId);
  if (selectedStudentId && currentSelectedStudent) {
    return (
      <CounselorStudentDetailView
        session={session}
        student={currentSelectedStudent}
        onBack={() => setSelectedStudentId(null)}
        onStudentUpdated={handleStudentUpdated}
      />
    );
  }

  return (
    <div className="animate-fadeIn space-y-5 pb-12">
      {/* Header */}
      <Header
        roleBadge="REHBERLİK UZMANI"
        title={`Rehberlik Servisi — ${session.name}`}
        onLogout={onLogout}
        session={session}
      />

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="notebook-card p-4 bg-gradient-to-br from-purple-50/80 to-white border border-purple-200/60 shadow-xs">
          <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Toplam Öğrenci</span>
            <span>🎒</span>
          </div>
          <div className="text-2xl font-black text-ink">{totalStudents}</div>
          <div className="text-[10px] text-muted font-medium mt-0.5">
            {teachers.length} öğretmen bünyesinde
          </div>
        </div>

        <div className="notebook-card p-4 bg-gradient-to-br from-blue-50/80 to-white border border-blue-200/60 shadow-xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Bugün Aktif</span>
            <span>⚡</span>
          </div>
          <div className="text-2xl font-black text-blue-600">{activeTodayCount}</div>
          <div className="text-[10px] text-muted font-medium mt-0.5">Öğrenci bugün soru çözdü</div>
        </div>

        <div className="notebook-card p-4 bg-gradient-to-br from-emerald-50/80 to-white border border-emerald-200/60 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Bu Hafta Toplam</span>
            <span>📊</span>
          </div>
          <div className="text-2xl font-black text-emerald-600">{totalWeekQuestions.toLocaleString('tr-TR')}</div>
          <div className="text-[10px] text-muted font-medium mt-0.5">Haftalık çözülen soru</div>
        </div>

        <div className="notebook-card p-4 bg-gradient-to-br from-pink-50/80 to-white border border-pink-200/60 shadow-xs">
          <div className="text-[11px] font-bold text-pink-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Rehberlik Notu</span>
            <span>💡</span>
          </div>
          <div className="text-2xl font-black text-pink-600">{studentsWithNoteCount}</div>
          <div className="text-[10px] text-muted font-medium mt-0.5">Öğrenciye not paylaşıldı</div>
        </div>
      </div>

      {/* Kontrol Çubuğu & Filtreleme */}
      <div className="notebook-card p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Canlı Arama */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Öğrenci adı veya öğretmen adı ile ara..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-xs sm:text-sm font-medium"
            />
          </div>

          {/* Öğretmen Filtresi */}
          <div className="sm:w-60">
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-xs font-semibold"
            >
              <option value="all">Tüm Öğretmenler ({teachers.length})</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.student_count || 0} öğrenci)
                </option>
              ))}
            </select>
          </div>

          {/* Sıralama */}
          <div className="sm:w-52">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-xs font-semibold"
            >
              <option value="name-asc">Ada Göre (A-Z)</option>
              <option value="teacher-asc">Öğretmene Göre (A-Z)</option>
              <option value="week-questions-desc">Bu Hafta Soru (Çoktan Aza)</option>
              <option value="last-entry-desc">Son Çalışma Tarihine Göre</option>
            </select>
          </div>

          {/* Excel Raporu İndir Butonu */}
          <button
            type="button"
            onClick={handleExportAll}
            disabled={exportLoading || students.length === 0}
            className="ios-press inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-[#F2F2F7] text-ink font-semibold rounded-xl text-xs border border-black/[0.08] shadow-xs transition-all disabled:opacity-50 flex-shrink-0"
            title="Tüm öğrencilerin verilerini Excel olarak indir"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>{exportLoading ? 'Hazırlanıyor…' : 'Tüm Excel Yedeği'}</span>
          </button>
        </div>

        {/* Hızlı Filtre Sekmeleri */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-[#F2F2F7] text-[#8E8E93] hover:text-ink'
            }`}
          >
            Tüm Öğrenciler ({students.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('active-today')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
              statusFilter === 'active-today'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-[#F2F2F7] text-[#8E8E93] hover:text-ink'
            }`}
          >
            Bugün Çalışanlar ({activeTodayCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('has-note')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
              statusFilter === 'has-note'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'bg-[#F2F2F7] text-[#8E8E93] hover:text-ink'
            }`}
          >
            Rehberlik Notu Olanlar ({studentsWithNoteCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('no-note')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
              statusFilter === 'no-note'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-[#F2F2F7] text-[#8E8E93] hover:text-ink'
            }`}
          >
            Not Bekleyenler ({students.length - studentsWithNoteCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('target-reached')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
              statusFilter === 'target-reached'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-[#F2F2F7] text-[#8E8E93] hover:text-ink'
            }`}
          >
            Bugün Hedefi Aşanlar
          </button>
        </div>
      </div>

      {/* Öğrenci Listesi */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="text-sm font-bold text-ink flex items-center gap-2">
            <span>Öğrenci Listesi</span>
            <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
              {filteredStudents.length} öğrenci gösteriliyor
            </span>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="p-1.5 text-muted hover:text-ink rounded-lg bg-white shadow-xs transition-colors ios-press"
            title="Yenile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-900 border border-red-200 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        {loading && students.length === 0 ? (
          <div className="notebook-card text-center py-12 text-muted text-xs">
            Öğrenci verileri yükleniyor…
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="notebook-card text-center py-12 text-muted text-xs">
            Arama kriterlerine uygun öğrenci bulunamadı.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredStudents.map((s) => {
              const m = studentMetrics[s.id] || { todayCount: 0, weekCount: 0 };
              const hasNote = !!(s.guidance_note && s.guidance_note.trim());

              return (
                <div
                  key={s.id}
                  className="notebook-card p-4 sm:p-5 flex flex-col justify-between hover:border-purple-300 transition-all group border border-black/[0.06] shadow-xs"
                >
                  <div className="space-y-3">
                    {/* ZORUNLU KURAL: Öğrencinin adı soyadı yanında hangi öğretmene bağlı olduğu parantez içinde yazsın */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-base text-ink tracking-tight flex items-baseline gap-1.5 flex-wrap">
                          <span className="group-hover:text-purple-900 transition-colors">{s.name}</span>
                          <span className="text-purple-700 font-semibold text-xs sm:text-sm">
                            ({s.teacher_name || 'Öğretmen Yok'})
                          </span>
                        </h4>
                        <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                          <span>Son çalışma: {relDateLabel(s.last_entry_date)}</span>
                          {s.daily_target && (
                            <span>· Hedef: {s.daily_target} soru/gün</span>
                          )}
                        </div>
                      </div>

                      {hasNote ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[10px] font-bold flex-shrink-0">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Not Var</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-medium flex-shrink-0">
                          <span>Not Yok</span>
                        </span>
                      )}
                    </div>

                    {/* Soru Özet İstatistikleri */}
                    <div className="grid grid-cols-3 gap-2 text-center bg-[#F2F2F7]/70 p-2.5 rounded-xl border border-black/[0.04]">
                      <div>
                        <div className="text-[10px] text-muted uppercase font-semibold">Bugün</div>
                        <div className={`text-sm font-black ${m.todayCount > 0 ? 'text-blue-600' : 'text-ink'}`}>
                          {m.todayCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted uppercase font-semibold">Bu Hafta</div>
                        <div className="text-sm font-black text-purple-600">
                          {m.weekCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted uppercase font-semibold">Deneme</div>
                        <div className="text-sm font-black text-amber-600">
                          {s.denemeler?.length || 0}
                        </div>
                      </div>
                    </div>

                    {/* Rehberlik Notu Önizlemesi (varsa) */}
                    {hasNote && (
                      <div className="text-xs bg-purple-50/70 p-2.5 rounded-xl border border-purple-200/50 text-purple-950">
                        <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Rehberlik Notu:</span>
                        </div>
                        <p className="line-clamp-2 text-[11px] leading-relaxed italic font-medium">
                          "{s.guidance_note}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Detay & Not Yaz Butonu */}
                  <div className="pt-3 mt-2 border-t border-black/[0.04]">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(s.id)}
                      className="ios-press w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-105 transition-all shadow-xs"
                    >
                      <span>İncele & Rehberlik Notu Paylaş</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
