import React, { useState, useEffect } from 'react';
import { UserPlus, Download, RefreshCw, KeyRound, Edit2, Trash2, Users, Eye, EyeOff } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { Session, Teacher } from '../../types';
import { Header } from '../common/Header';
import { generatePin, fmtDate } from '../../lib/utils';
import { exportAllStudentsByAdmin } from '../../lib/excel';

interface AdminDashboardProps {
  session: Session;
  onLogout: () => void;
  onViewTeacherActivity: (teacherId: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  session,
  onLogout,
  onViewTeacherActivity,
}) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add teacher form
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Edit teacher state
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Export all loading
  const [exportLoading, setExportLoading] = useState(false);

  const fetchTeachers = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await sb.rpc('admin_list_teachers');
      let res: any = data;

      if (rpcError) {
        console.error('admin_list_teachers RPC error:', rpcError);
        setError('Öğretmen listesi veritabanından alınamadı.');
        return;
      }

      let list: Teacher[] = [];
      if (Array.isArray(res)) {
        list = res;
      } else if (res && res.teachers && Array.isArray(res.teachers)) {
        list = res.teachers;
      } else if (res && res.data && Array.isArray(res.data)) {
        list = res.data;
      }

      const sanitized = list.map((t: Teacher) => ({
        ...t,
        password: undefined,
      }));

      setTeachers(sanitized);
    } catch (err) {
      console.error('fetchTeachers exception:', err);
      setError('Bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    const name = newName.trim();
    const username = newUsername.trim();
    const password = newPassword.trim();

    if (!name || !username || !password) {
      setAddError('Tüm alanları doldurun.');
      return;
    }

    setAddLoading(true);
    try {
      const { data, error: rpcError } = await sb.rpc('admin_add_teacher', {
        p_admin_id: session.id,
        p_name: name,
        p_username: username,
        p_password: password,
      });

      if (rpcError || !data || data.error) {
        setAddError(
          data?.error === 'username_taken'
            ? 'Bu kullanıcı adı zaten alınmış.'
            : 'Öğretmen eklenemedi.'
        );
        return;
      }

      setNewName('');
      setNewUsername('');
      setNewPassword('');
      await fetchTeachers();
    } catch {
      setAddError('Öğretmen eklenirken hata oluştu.');
    } finally {
      setAddLoading(false);
    }
  };

  const startEdit = (t: Teacher) => {
    setEditingTeacherId(t.id);
    setEditName(t.name);
    setEditUsername(t.username);
    setEditPassword('');
    setEditError('');
  };

  const handleSaveEdit = async (teacherId: string) => {
    setEditError('');
    const name = editName.trim();
    const username = editUsername.trim();
    const password = editPassword.trim();

    if (!name || !username) {
      setEditError('Ad Soyad ve Kullanıcı Adı alanları boş bırakılamaz.');
      return;
    }

    setSaveLoading(true);
    try {
      const { data, error: rpcError } = await sb.rpc('admin_update_teacher', {
        p_admin_id: session.id,
        p_teacher_id: teacherId,
        p_name: name,
        p_new_username: username,
        p_new_password: password || null,
      });

      if (rpcError || !data || data.error) {
        setEditError(
          data?.error === 'username_taken'
            ? 'Bu kullanıcı adı başka bir öğretmende kayıtlı.'
            : 'Güncellenemedi.'
        );
        return;
      }

      setEditingTeacherId(null);
      await fetchTeachers();
    } catch {
      setEditError('Güncelleme sırasında hata oluştu.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteTeacher = async (teacher: Teacher) => {
    if (
      !window.confirm(
        `${teacher.name} adlı öğretmeni silmek istediğine emin misin? Bu öğretmenin tüm öğrencileri ve verileri de silinecektir.`
      )
    ) {
      return;
    }

    try {
      const { data, error: rpcError } = await sb.rpc('admin_delete_teacher', {
        p_admin_id: session.id,
        p_teacher_id: teacher.id,
      });

      if (rpcError || !data || data.error) {
        alert('Öğretmen silinemedi.');
        return;
      }

      await fetchTeachers();
    } catch {
      alert('Silme işleminde hata oluştu.');
    }
  };

  const handleExportAll = async () => {
    setExportLoading(true);
    try {
      const { data, error: rpcError } = await sb.rpc('admin_get_all_students_data', {
        p_admin_id: session.id,
      });

      if (rpcError || !data || data.error) {
        alert('Veriler alınamadı.');
        return;
      }

      exportAllStudentsByAdmin(data.students || []);
    } catch {
      alert('Excel dışa aktarma hatası oluştu.');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-4">
      <Header
        roleBadge="ADMIN"
        title={`Merhaba, ${session.name}`}
        onLogout={onLogout}
      />

      <button
        type="button"
        onClick={handleExportAll}
        disabled={exportLoading}
        className="w-full bg-brandGreen text-white font-semibold py-2.5 px-4 rounded-md shadow-sm hover:opacity-90 disabled:opacity-50 transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
      >
        <Download className="w-4 h-4" />
        <span>
          {exportLoading
            ? 'Hazırlanıyor…'
            : "Tüm Öğrencileri (Bütün Öğretmenler) Excel'e Aktar"}
        </span>
      </button>

      {/* Yeni Öğretmen Ekle Kartı */}
      <div className="notebook-card">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-brandGold" />
          <h3 className="font-serif text-lg font-bold text-ink">Yeni Öğretmen Ekle</h3>
        </div>

        <form onSubmit={handleAddTeacher} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Ad Soyad</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="w-full text-xs sm:text-sm px-3 py-2 rounded border border-ink/20 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Kullanıcı Adı</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
              className="w-full text-xs sm:text-sm px-3 py-2 rounded border border-ink/20 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Şifre</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full font-mono text-xs sm:text-sm px-3 py-2 pr-8 rounded border border-ink/20 bg-white tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-2 text-muted hover:text-ink p-0.5 rounded transition-colors"
                  title={showNewPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewPassword(generatePin(8));
                  setShowNewPassword(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 bg-successBg text-brandGreen border border-brandGreen/30 text-xs font-semibold rounded hover:bg-brandGreen hover:text-white transition-colors flex-shrink-0"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Otomatik Ata</span>
              </button>
            </div>
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
            {addLoading ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </form>
      </div>

      {/* Öğretmen Listesi */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-lg font-bold text-ink flex items-center gap-2">
            <span>Öğretmenler</span>
            <span className="text-xs font-mono font-normal text-muted bg-paper px-2 py-0.5 rounded-full border border-ink/10">
              {teachers.length}
            </span>
          </h3>
          <button
            type="button"
            onClick={fetchTeachers}
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

        {loading && teachers.length === 0 ? (
          <div className="notebook-card text-center py-8 text-muted text-xs">Yükleniyor…</div>
        ) : teachers.length === 0 ? (
          <div className="notebook-card text-center py-8 text-muted text-xs">
            Henüz öğretmen eklenmedi. Yukarıdaki formdan ilk öğretmeni ekleyebilirsiniz.
          </div>
        ) : (
          <div className="space-y-3">
            {teachers.map((t) => {
              const isEditing = editingTeacherId === t.id;

              if (isEditing) {
                return (
                  <div key={t.id} className="notebook-card space-y-2 border-brandGreen/40 border">
                    <label className="block text-xs font-semibold text-muted">Ad Soyad</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded border border-ink/20 bg-white"
                    />

                    <label className="block text-xs font-semibold text-muted">Kullanıcı Adı</label>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded border border-ink/20 bg-white"
                    />

                    <label className="block text-xs font-semibold text-muted">Şifre (Değiştirmek için girin)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showEditPassword ? 'text' : 'password'}
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Yeni şifre girin"
                          className="w-full font-mono text-xs px-3 py-2 pr-8 rounded border border-ink/20 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditPassword(!showEditPassword)}
                          className="absolute right-2 top-2 text-muted hover:text-ink p-0.5 rounded transition-colors"
                          title={showEditPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                        >
                          {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditPassword(generatePin(8));
                          setShowEditPassword(true);
                        }}
                        className="px-2.5 py-1.5 bg-successBg text-brandGreen border border-brandGreen/30 text-xs font-semibold rounded hover:bg-brandGreen hover:text-white transition-colors flex-shrink-0"
                      >
                        Otomatik
                      </button>
                    </div>

                    {editError && <p className="text-brandRed text-xs">{editError}</p>}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        disabled={saveLoading}
                        onClick={() => handleSaveEdit(t.id)}
                        className="flex-1 bg-brandGreen text-white font-semibold py-1.5 rounded text-xs hover:opacity-90 disabled:opacity-50"
                      >
                        {saveLoading ? 'Kaydediliyor…' : 'Kaydet'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTeacherId(null)}
                        className="flex-1 border border-ink/20 text-muted font-semibold py-1.5 rounded text-xs hover:bg-white"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={t.id} className="notebook-card space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-base text-ink">{t.name}</h4>
                      <p className="text-xs text-muted">
                        {t.student_count || 0} öğrenci · {fmtDate(t.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs bg-cream/60 p-2.5 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[11px] text-muted uppercase">Kullanıcı Adı:</span>
                      <span className="font-mono font-medium text-ink">{t.username}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onViewTeacherActivity(t.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded border border-ink/15 text-xs font-semibold text-ink bg-white hover:bg-cream transition-colors"
                    >
                      <Users className="w-3.5 h-3.5 text-brandGreen" />
                      <span>Öğrencileri Gör</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="p-1.5 rounded border border-brandGreen/30 text-brandGreen hover:bg-successBg transition-colors"
                      title="Düzenle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTeacher(t)}
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
    </div>
  );
};
