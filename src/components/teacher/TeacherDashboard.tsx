import React, { useState, useEffect } from 'react';
import { UserPlus, Download, RefreshCw, KeyRound, AlertCircle, Eye, Trash2 } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { Session, Student } from '../../types';
import { Header } from '../common/Header';
import { StudentDetailView } from './StudentDetailView';
import { generatePin, todayStr, fmtDateTime } from '../../lib/utils';
import { exportTeacherStudents } from '../../lib/excel';

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

  return (
    <div className="animate-fadeIn space-y-4">
      <Header
        roleBadge="ÖĞRETMEN"
        title={`Merhaba, ${session.name}`}
        onLogout={onLogout}
      />

      <button
        type="button"
        onClick={() => exportTeacherStudents(session.name, students)}
        disabled={students.length === 0}
        className="w-full bg-brandGreen text-white font-semibold py-2.5 px-4 rounded-md shadow-sm hover:opacity-90 disabled:opacity-50 transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
      >
        <Download className="w-4 h-4" />
        <span>Tüm Öğrencileri Excel'e Aktar</span>
      </button>

      {/* Missing today banner */}
      {missingToday.length > 0 && (
        <div className="p-3 bg-dangerBg border border-brandRed/30 rounded-lg text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-brandRed flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-brandRed">{missingToday.length} öğrenci </span>
            <span>bugün henüz soru girmedi: </span>
            <span className="font-medium text-ink">
              {missingToday.map((s) => s.name).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Students list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-lg font-bold text-ink flex items-center gap-2">
            <span>Öğrenciler</span>
            <span className="text-xs font-mono font-normal text-muted bg-paper px-2 py-0.5 rounded-full border border-ink/10">
              {students.length}
            </span>
          </h3>
          <button
            type="button"
            onClick={fetchStudents}
            className="p-1.5 text-muted hover:text-ink rounded-full hover:bg-white transition-colors"
            title="Yenile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-dangerBg text-brandRed rounded-md text-xs font-medium border border-brandRed/20 mb-3">
            {error}
          </div>
        )}

        {loading && students.length === 0 ? (
          <div className="notebook-card text-center py-8 text-muted text-xs">Yükleniyor…</div>
        ) : students.length === 0 ? (
          <div className="notebook-card text-center py-8 text-muted text-xs">
            Henüz öğrenci eklenmedi. Aşağıdaki formdan ilk öğrencinizi ekleyebilirsiniz.
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((s) => {
              const isToday = s.last_entry_date === today;
              return (
                <div key={s.id} className="notebook-card space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-base text-ink">{s.name}</h4>
                      <p className="text-xs text-muted">
                        @{s.username}
                        {s.daily_target != null && ` · Hedef: ${s.daily_target}`}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                        isToday
                          ? 'bg-successBg text-brandGreen border-brandGreen/20'
                          : 'bg-dangerBg text-brandRed border-brandRed/20'
                      }`}
                    >
                      {fmtDateTime(s.last_saved_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(s.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded border border-brandGreen/30 text-brandGreen bg-white hover:bg-successBg text-xs font-semibold transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detay</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStudent(s)}
                      className="p-1.5 rounded border border-brandRed/30 text-brandRed hover:bg-dangerBg transition-colors"
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
      <div className="notebook-card">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-brandGreen" />
          <h3 className="font-serif text-lg font-bold text-ink">Yeni Öğrenci Ekle</h3>
        </div>

        <form onSubmit={handleAddStudent} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Ad Soyad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full text-xs sm:text-sm px-3 py-2 rounded border border-ink/20 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Kullanıcı Adı</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full text-xs sm:text-sm px-3 py-2 rounded border border-ink/20 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Şifre</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex-1 font-mono text-xs sm:text-sm px-3 py-2 rounded border border-ink/20 bg-white tracking-wider"
              />
              <button
                type="button"
                onClick={() => setPassword(generatePin(8))}
                className="inline-flex items-center gap-1 px-3 py-2 bg-successBg text-brandGreen border border-brandGreen/30 text-xs font-semibold rounded hover:bg-brandGreen hover:text-white transition-colors flex-shrink-0"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Otomatik Ata</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Günlük Hedef (opsiyonel)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={dailyTarget}
              onChange={(e) => setDailyTarget(e.target.value)}
              placeholder="Örn: 100"
              className="w-full text-xs sm:text-sm px-3 py-2 rounded border border-ink/20 bg-white font-mono"
            />
          </div>

          {addError && (
            <p className="text-brandRed text-xs font-medium bg-dangerBg/50 p-2 rounded border border-brandRed/20">
              {addError}
            </p>
          )}

          <button
            type="submit"
            disabled={addLoading}
            className="w-full bg-brandGreen text-white font-semibold py-2 px-4 rounded shadow-sm hover:opacity-90 disabled:opacity-50 text-xs sm:text-sm transition-all mt-1"
          >
            {addLoading ? 'Ekleniyor…' : 'Öğrenciyi Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
};
