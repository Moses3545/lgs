import React, { useState, useEffect } from 'react';
import { UserPlus, Download, RefreshCw, KeyRound, AlertCircle, Trash2, Calendar, Mail } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { Session, Student } from '../../types';
import { Header } from '../common/Header';
import { StudentDetailView } from './StudentDetailView';
import { generatePin, todayStr, fmtDateTime, weekRange, inRange, entryTotal } from '../../lib/utils';
import { exportTeacherStudents, exportWeeklyTeacherBackup } from '../../lib/excel';
import { createSampleStudent } from '../../lib/demoData';
import { BackupEmailModal } from '../common/BackupEmailModal';

interface TeacherDashboardProps {
  session: Session;
  onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ session, onLogout }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected student for detail view
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Backup modal and loading state
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [weeklyExportLoading, setWeeklyExportLoading] = useState(false);

  // Add student form
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [dailyTarget, setDailyTarget] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const fetchStudents = async () => {
    setLoading(true);
    setError('');

    // Yerel Demo Modu Kontrolü
    if (session.id === 'demo-teacher') {
      const sample = createSampleStudent();
      setStudents([sample]);
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await sb.rpc('teacher_get_data', {
        p_teacher_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
      });

      if (rpcError || !data || data.error) {
        setError('Öğrenci verileri alınamadı.');
        return;
      }

      setStudents(data.students || []);
    } catch {
      setError('Bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    const n = name.trim();
    const u = username.trim();
    const p = password.trim();
    const target = dailyTarget === '' ? null : parseInt(dailyTarget, 10);

    if (!n || !u || !p) {
      setAddError('Lütfen gerekli alanları doldurun.');
      return;
    }

    setAddLoading(true);
    try {
      const { data, error: rpcError } = await sb.rpc('teacher_add_student', {
        p_teacher_id: session.id,
        p_password: session.secret,
        p_session_token: session.sessionToken,
        p_name: n,
        p_username: u,
        p_student_password: p,
        p_daily_target: target,
      });

      if (rpcError || !data || data.error) {
        setAddError(
          data?.error === 'username_taken'
            ? 'Bu kullanıcı adı zaten alınmış.'
            : 'Öğrenci eklenemedi.'
        );
        return;
      }

      setName('');
      setUsername('');
      setPassword('');
      setDailyTarget('');
      await fetchStudents();
    } catch {
      setAddError('Öğrenci ekleme hatası oluştu.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (
      !window.confirm(
        `${student.name} adlı öğrenciyi silmek istediğinize emin misiniz? Tüm soru kayıtları silinecektir.`
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
      await fetchStudents();
    } catch {
      alert('Silme işlemi başarısız oldu.');
    }
  };

  // If a student is selected, show detail view
  const currentSelectedStudent = students.find((s) => s.id === selectedStudentId);
  if (selectedStudentId && currentSelectedStudent) {
    return (
      <StudentDetailView
        session={session}
        student={currentSelectedStudent}
        onBack={() => setSelectedStudentId(null)}
        onStudentUpdated={fetchStudents}
        onStudentDeleted={() => {
          setSelectedStudentId(null);
          fetchStudents();
        }}
      />
    );
  }

  // Missing today calculation
  const today = todayStr();
  const missingToday = students.filter((s) => s.last_entry_date !== today);

  const handleExportWeekly = async () => {
    setWeeklyExportLoading(true);
    try {
      await exportWeeklyTeacherBackup(session.name, students, 0);
    } catch {
      alert('Haftalık yedek dosyası oluşturulamadı.');
    } finally {
      setWeeklyExportLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-4">
      <Header
        roleBadge="ÖĞRETMEN"
        title={`Merhaba ${session.name}, Mutlu Haftalar Dilerim!`}
        onLogout={onLogout}
        session={session}
      />

      {/* Yedekleme & Raporlama Merkezi */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={handleExportWeekly}
          disabled={students.length === 0 || weeklyExportLoading}
          className="ios-press flex items-center justify-center gap-2 px-3.5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-105 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-sm shadow-blue-500/20 text-xs sm:text-sm transition-all disabled:opacity-50"
        >
          <Calendar className="w-4 h-4" />
          <span>{weeklyExportLoading ? 'Hazırlanıyor…' : 'Bu Haftanın Yedeğini İndir'}</span>
        </button>

        <button
          type="button"
          onClick={() => exportTeacherStudents(session.name, students)}
          disabled={students.length === 0}
          className="ios-press flex items-center justify-center gap-2 px-3.5 py-3 bg-white hover:bg-cream text-ink border border-black/[0.08] font-semibold rounded-2xl shadow-xs text-xs sm:text-sm transition-all disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-[#8E8E93]" />
          <span>Tüm Öğrencileri Excel'e Aktar</span>
        </button>

        <button
          type="button"
          onClick={() => setIsBackupModalOpen(true)}
          disabled={students.length === 0}
          className="ios-press flex items-center justify-center gap-2 px-3.5 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-105 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-sm shadow-orange-500/20 text-xs sm:text-sm transition-all disabled:opacity-50"
        >
          <Mail className="w-4 h-4" />
          <span>Yedeği E-Postaya Gönder</span>
        </button>
      </div>

      <BackupEmailModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        students={students}
        teacherName={session.name}
      />

      {/* Missing today banner */}
      {missingToday.length > 0 && (
        <div className="p-3.5 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-2xl text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#FF3B30] flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-[#FF3B30]">{missingToday.length} öğrenci </span>
            <span className="text-[#1C1C1E]">bugün henüz soru girmedi: </span>
            <span className="font-semibold text-[#1C1C1E]">
              {missingToday.map((s) => s.name).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Students list */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-lg font-bold text-ink tracking-tight flex items-center gap-2">
            <span>Öğrenciler</span>
            <span className="text-xs font-semibold text-[#8E8E93] bg-[#E5E5EA] px-2.5 py-0.5 rounded-full">
              {students.length}
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchStudents}
              className="p-2 text-[#8E8E93] hover:text-ink rounded-full bg-white hover:bg-[#E5E5EA]/60 transition-colors shadow-xs ios-press"
              title="Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-[#FF3B30]/10 text-[#FF3B30] rounded-xl text-xs font-medium border border-[#FF3B30]/20 mb-3">
            {error}
          </div>
        )}

        {loading && students.length === 0 ? (
          <div className="notebook-card text-center py-10 text-muted text-xs">Yükleniyor…</div>
        ) : students.length === 0 ? (
          <div className="notebook-card text-center py-10 text-muted text-xs">
            Henüz öğrenci eklenmedi. Aşağıdaki formdan ilk öğrencinizi ekleyebilirsiniz.
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((s) => {
              const isToday = s.last_entry_date === today;
              const [cwStart, cwEnd] = weekRange(0);
              const now = new Date();
              const cmStart = new Date(now.getFullYear(), now.getMonth(), 1);
              const cmEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

              const sEntries = s.entries || [];
              const sWeekTotal = sEntries
                .filter((e) => inRange(e.date, cwStart, cwEnd))
                .reduce((acc, e) => acc + entryTotal(e), 0);
              const sMonthTotal = sEntries
                .filter((e) => inRange(e.date, cmStart, cmEnd))
                .reduce((acc, e) => acc + entryTotal(e), 0);
              const sGrandTotal = sEntries.reduce((acc, e) => acc + entryTotal(e), 0);

              return (
                <div key={s.id} className="notebook-card space-y-3 p-4 sm:p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-base text-ink tracking-tight">{s.name}</h4>
                      <p className="text-xs text-[#8E8E93] mt-0.5">
                        @{s.username}
                        {s.daily_target != null && ` · Hedef: ${s.daily_target} soru`}
                      </p>
                    </div>

                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                        isToday
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20'
                      }`}
                    >
                      {fmtDateTime(s.last_saved_at)}
                    </span>
                  </div>

                  {/* Haftalık, Aylık ve Genel Toplam Sayaçları - iOS Widget Style */}
                  <div className="grid grid-cols-3 gap-2 bg-[#F2F2F7] p-2.5 rounded-xl border border-black/[0.04] text-center text-xs">
                    <div>
                      <div className="text-[10px] text-[#8E8E93] uppercase font-semibold">Bu Hafta</div>
                      <div className="font-bold text-base text-ink mt-0.5">{sWeekTotal}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#8E8E93] uppercase font-semibold">Bu Ay</div>
                      <div className="font-bold text-base text-blue-600 mt-0.5">{sMonthTotal}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#8E8E93] uppercase font-semibold">Toplam</div>
                      <div className="font-bold text-base text-[#FF9500] mt-0.5">{sGrandTotal}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(s.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/15 text-xs font-semibold transition-all ios-press"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Haftalık & Aylık Takvim / Detay</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStudent(s)}
                      className="p-2.5 rounded-xl text-[#FF3B30] bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 transition-all ios-press"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Yeni Öğrenci Ekle Formu */}
      <div className="notebook-card p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-8 h-8 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center">
            <UserPlus className="w-4 h-4" />
          </span>
          <h3 className="text-lg font-bold text-ink tracking-tight">Yeni Öğrenci Ekle</h3>
        </div>

        <form onSubmit={handleAddStudent} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1.5">
              Ad Soyad
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Öğrencinin Adı Soyadı"
              className="w-full text-sm px-4 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#34C759]/30 focus:border-[#34C759] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1.5">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="örn: ahmetk"
              className="w-full text-sm px-4 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#34C759]/30 focus:border-[#34C759] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1.5">
              Şifre
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Şifre"
                className="flex-1 font-mono text-sm px-4 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#34C759]/30 focus:border-[#34C759] tracking-wider transition-all"
              />
              <button
                type="button"
                onClick={() => setPassword(generatePin(8))}
                className="inline-flex items-center gap-1 px-3.5 py-2.5 bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 text-xs font-semibold rounded-xl hover:bg-[#34C759]/20 transition-all flex-shrink-0 ios-press"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Otomatik Ata</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1.5">
              Günlük Hedef (opsiyonel)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={dailyTarget}
              onChange={(e) => setDailyTarget(e.target.value)}
              placeholder="Örn: 100"
              className="w-full text-sm px-4 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#34C759]/30 focus:border-[#34C759] transition-all"
            />
          </div>

          {addError && (
            <p className="text-[#FF3B30] text-xs font-medium bg-[#FF3B30]/10 p-3 rounded-xl border border-[#FF3B30]/20 animate-fadeIn">
              {addError}
            </p>
          )}

          <button
            type="submit"
            disabled={addLoading}
            className="w-full bg-[#34C759] hover:bg-[#30B753] active:bg-[#289945] text-white font-semibold py-3 px-4 rounded-xl shadow-sm disabled:opacity-50 text-sm transition-all mt-2 ios-press"
          >
            {addLoading ? 'Ekleniyor…' : 'Öğrenciyi Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
};
