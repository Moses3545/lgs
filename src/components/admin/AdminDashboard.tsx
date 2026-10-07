import React, { useState, useEffect } from 'react';
import { UserPlus, Download, RefreshCw, KeyRound, Edit2, Trash2, Users, Eye, EyeOff, Mail, Calendar, FileJson, CheckCircle2, AlertCircle, Save, Sparkles, GraduationCap } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { Session, Teacher, Student, Counselor } from '../../types';
import { Header } from '../common/Header';
import { generatePin, fmtDate } from '../../lib/utils';
import { exportAllStudentsByAdmin, exportWeeklyTeacherBackup, exportFullJsonBackup } from '../../lib/excel';
import { BackupEmailModal } from '../common/BackupEmailModal';

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
  const [activeTab, setActiveTab] = useState<'teachers' | 'counselors'>('teachers');
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

  // Rehberlik Uzmanları State
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [counselorsLoading, setCounselorsLoading] = useState(false);
  const [counselorsError, setCounselorsError] = useState('');

  // Add counselor form
  const [newCounselorName, setNewCounselorName] = useState('');
  const [newCounselorUsername, setNewCounselorUsername] = useState('');
  const [newCounselorPassword, setNewCounselorPassword] = useState('');
  const [showNewCounselorPassword, setShowNewCounselorPassword] = useState(false);
  const [addCounselorLoading, setAddCounselorLoading] = useState(false);
  const [addCounselorError, setAddCounselorError] = useState('');

  // Edit counselor state
  const [editingCounselorId, setEditingCounselorId] = useState<string | null>(null);
  const [editCounselorName, setEditCounselorName] = useState('');
  const [editCounselorUsername, setEditCounselorUsername] = useState('');
  const [editCounselorPassword, setEditCounselorPassword] = useState('');
  const [showEditCounselorPassword, setShowEditCounselorPassword] = useState(false);
  const [saveCounselorLoading, setSaveCounselorLoading] = useState(false);
  const [editCounselorError, setEditCounselorError] = useState('');

  // Export all loading
  const [exportLoading, setExportLoading] = useState(false);
  const [weeklyExportLoading, setWeeklyExportLoading] = useState(false);
  const [jsonExportLoading, setJsonExportLoading] = useState(false);

  // Backup email settings
  const [backupEmail, setBackupEmail] = useState('');
  const [savingBackupEmail, setSavingBackupEmail] = useState(false);
  const [backupEmailMsg, setBackupEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [allStudentsData, setAllStudentsData] = useState<Student[]>([]);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

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

  const fetchCounselors = async () => {
    setCounselorsLoading(true);
    setCounselorsError('');
    try {
      const { data, error: rpcError } = await sb.rpc('admin_list_counselors', {
        p_admin_id: session.id,
      });

      if (rpcError) {
        console.error('admin_list_counselors RPC error:', rpcError);
        setCounselorsError('Rehberlik uzmanı listesi alınamadı.');
        return;
      }

      setCounselors(data?.counselors || []);
    } catch (err) {
      console.error('fetchCounselors exception:', err);
      setCounselorsError('Bağlantı hatası oluştu.');
    } finally {
      setCounselorsLoading(false);
    }
  };

  const fetchBackupEmail = async () => {
    try {
      const { data, error: rpcError } = await sb.rpc('get_backup_email');
      if (!rpcError && data && data.email) {
        setBackupEmail(data.email);
      }
    } catch (err) {
      console.error('fetchBackupEmail error:', err);
    }
  };

  useEffect(() => {
    fetchTeachers();
    fetchCounselors();
    fetchBackupEmail();
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

  const handleAddCounselor = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCounselorError('');
    const name = newCounselorName.trim();
    const username = newCounselorUsername.trim();
    const password = newCounselorPassword.trim();

    if (!name || !username || !password) {
      setAddCounselorError('Tüm alanları doldurun.');
      return;
    }

    setAddCounselorLoading(true);
    try {
      const { data, error: rpcError } = await sb.rpc('admin_add_counselor', {
        p_admin_id: session.id,
        p_name: name,
        p_username: username,
        p_password: password,
      });

      if (rpcError || !data || data.error) {
        setAddCounselorError(
          data?.error === 'username_taken'
            ? 'Bu kullanıcı adı zaten alınmış.'
            : 'Rehberlik uzmanı eklenemedi.'
        );
        return;
      }

      setNewCounselorName('');
      setNewCounselorUsername('');
      setNewCounselorPassword('');
      await fetchCounselors();
    } catch {
      setAddCounselorError('Rehberlik uzmanı eklenirken hata oluştu.');
    } finally {
      setAddCounselorLoading(false);
    }
  };

  const startEditCounselor = (c: Counselor) => {
    setEditingCounselorId(c.id);
    setEditCounselorName(c.name);
    setEditCounselorUsername(c.username);
    setEditCounselorPassword('');
    setEditCounselorError('');
  };

  const handleSaveEditCounselor = async (counselorId: string) => {
    setEditCounselorError('');
    const name = editCounselorName.trim();
    const username = editCounselorUsername.trim();
    const password = editCounselorPassword.trim();

    if (!name || !username) {
      setEditCounselorError('Ad Soyad ve Kullanıcı Adı alanları boş bırakılamaz.');
      return;
    }

    setSaveCounselorLoading(true);
    try {
      const { data, error: rpcError } = await sb.rpc('admin_update_counselor', {
        p_admin_id: session.id,
        p_counselor_id: counselorId,
        p_name: name,
        p_new_username: username,
        p_new_password: password || null,
      });

      if (rpcError || !data || data.error) {
        setEditCounselorError(
          data?.error === 'username_taken'
            ? 'Bu kullanıcı adı başka bir hesapta kayıtlı.'
            : 'Güncellenemedi.'
        );
        return;
      }

      setEditingCounselorId(null);
      await fetchCounselors();
    } catch {
      setEditCounselorError('Güncelleme sırasında hata oluştu.');
    } finally {
      setSaveCounselorLoading(false);
    }
  };

  const handleDeleteCounselor = async (counselor: Counselor) => {
    if (
      !window.confirm(
        `${counselor.name} adlı rehberlik uzmanını silmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    try {
      const { data, error: rpcError } = await sb.rpc('admin_delete_counselor', {
        p_admin_id: session.id,
        p_counselor_id: counselor.id,
      });

      if (rpcError || !data || data.error) {
        alert('Rehberlik uzmanı silinemedi.');
        return;
      }

      await fetchCounselors();
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

  const handleExportWeeklyAll = async () => {
    setWeeklyExportLoading(true);
    try {
      const { data, error: rpcError } = await sb.rpc('admin_get_all_students_data', {
        p_admin_id: session.id,
      });

      if (rpcError || !data || data.error) {
        alert('Veriler alınamadı.');
        return;
      }

      await exportWeeklyTeacherBackup('Tüm Okul', data.students || [], 0);
    } catch {
      alert('Haftalık Excel dışa aktarma hatası oluştu.');
    } finally {
      setWeeklyExportLoading(false);
    }
  };

  const handleExportJsonAll = async () => {
    setJsonExportLoading(true);
    try {
      const { data, error: rpcError } = await sb.rpc('admin_get_all_students_data', {
        p_admin_id: session.id,
      });

      if (rpcError || !data || data.error) {
        alert('Veriler alınamadı.');
        return;
      }

      exportFullJsonBackup('LGS Tüm Veritabanı', {
        exported_at: new Date().toISOString(),
        admin_name: session.name,
        backup_email: backupEmail,
        teachers_count: teachers.length,
        students_count: (data.students || []).length,
        teachers,
        students: data.students || [],
      });
    } catch {
      alert('JSON yedek dosyası oluşturulamadı.');
    } finally {
      setJsonExportLoading(false);
    }
  };

  const handleSaveBackupEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = backupEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setBackupEmailMsg({ type: 'error', text: 'Lütfen geçerli bir e-posta adresi girin.' });
      return;
    }

    setSavingBackupEmail(true);
    setBackupEmailMsg(null);
    try {
      const { data, error: rpcError } = await sb.rpc('admin_set_backup_email', {
        p_admin_id: session.id,
        p_email: trimmed,
      });

      if (rpcError || !data || !data.success) {
        throw new Error('E-posta kaydedilemedi.');
      }

      localStorage.setItem('lgs_backup_email', trimmed);
      setBackupEmailMsg({
        type: 'success',
        text: `Haftalık yedeklerin gönderileceği e-posta adresi "${trimmed}" olarak kaydedildi!`,
      });
    } catch {
      setBackupEmailMsg({ type: 'error', text: 'E-posta kaydedilirken bir hata oluştu.' });
    } finally {
      setSavingBackupEmail(false);
    }
  };

  const handleOpenEmailModal = async () => {
    try {
      const { data, error: rpcError } = await sb.rpc('admin_get_all_students_data', {
        p_admin_id: session.id,
      });
      if (!rpcError && data && data.students) {
        setAllStudentsData(data.students);
      }
    } catch (err) {
      console.error(err);
    }
    setIsBackupModalOpen(true);
  };

  return (
    <div className="animate-fadeIn space-y-4">
      <Header
        roleBadge="ADMIN"
        title={`Merhaba, ${session.name}`}
        onLogout={onLogout}
        session={session}
      />

      {/* 1. Bölüm: Yedekleme ve Dışa Aktarma Eylemleri */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={handleExportWeeklyAll}
          disabled={weeklyExportLoading}
          className="ios-press flex items-center justify-center gap-2 px-3 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-105 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-sm shadow-blue-500/20 text-xs transition-all disabled:opacity-50"
        >
          <Calendar className="w-4 h-4" />
          <span>{weeklyExportLoading ? 'Hazırlanıyor…' : 'Bu Haftanın Yedeği (Excel)'}</span>
        </button>

        <button
          type="button"
          onClick={handleExportAll}
          disabled={exportLoading}
          className="ios-press flex items-center justify-center gap-2 px-3 py-3 bg-white hover:bg-cream text-ink border border-black/[0.08] font-semibold rounded-2xl shadow-xs text-xs transition-all disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>{exportLoading ? 'Hazırlanıyor…' : 'Tüm Veriler (Excel)'}</span>
        </button>

        <button
          type="button"
          onClick={handleExportJsonAll}
          disabled={jsonExportLoading}
          className="ios-press flex items-center justify-center gap-2 px-3 py-3 bg-white hover:bg-cream text-ink border border-black/[0.08] font-semibold rounded-2xl shadow-xs text-xs transition-all disabled:opacity-50"
        >
          <FileJson className="w-4 h-4 text-purple-600" />
          <span>{jsonExportLoading ? 'Hazırlanıyor…' : 'Tam JSON Yedeği'}</span>
        </button>

        <button
          type="button"
          onClick={handleOpenEmailModal}
          className="ios-press flex items-center justify-center gap-2 px-3 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-105 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-sm shadow-orange-500/20 text-xs transition-all"
        >
          <Mail className="w-4 h-4" />
          <span>Yedeği E-Postaya Gönder</span>
        </button>
      </div>

      {/* 2. Bölüm: Otomatik Haftalık Yedekleme & E-Posta Yönetimi Kartı */}
      <div className="notebook-card p-5 sm:p-6 space-y-3.5">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-base">
            📬
          </span>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-ink tracking-tight">
              Haftalık Otomatik Yedek & E-Posta Yönetimi
            </h3>
            <p className="text-xs text-muted">
              Yedeklerin her hafta sonu otomatik olarak gönderileceği e-posta adresini buradan belirleyin.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveBackupEmail} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1.5">
              Haftalık Yedeklerin Gönderileceği E-Posta Adresi
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-muted absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={backupEmail}
                  onChange={(e) => setBackupEmail(e.target.value)}
                  required
                  placeholder="ornek@okul.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium text-xs sm:text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={savingBackupEmail}
                className="ios-press inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl text-xs shadow-sm disabled:opacity-50 transition-all flex-shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingBackupEmail ? 'Kaydediliyor…' : 'E-Posta Adresini Kaydet'}</span>
              </button>
            </div>
          </div>

          {backupEmailMsg && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 animate-fadeIn ${
                backupEmailMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}
            >
              {backupEmailMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <span>{backupEmailMsg.text}</span>
            </div>
          )}

          <div className="text-[11px] text-muted bg-[#F2F2F7] p-3 rounded-xl border border-black/[0.04] space-y-1">
            <p className="font-semibold text-ink">💡 Otomatik Yedek Bilgilendirmesi:</p>
            <p>
              • Burada kaydettiğiniz e-posta adresi güvenli bir şekilde veritabanında saklanır.
            </p>
            <p>
              • GitHub Actions haftalık iş akışı her Pazar gecesi bu adrese Excel raporunu otomatik gönderir.
            </p>
            <p>
              • Öğretmenler de kendi panellerinde bu adresi görerek tek tıkla doğrudan yedek iletebilir.
            </p>
          </div>
        </form>
      </div>

      <BackupEmailModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        students={allStudentsData}
        teacherName="Tüm Okul (Yönetici)"
        isAdmin={true}
        adminId={session.id}
      />

      {/* Tab Switcher: Öğretmenler vs Rehberlik Uzmanları */}
      <div className="flex bg-[#E5E5EA]/70 p-1.5 rounded-2xl max-w-lg mx-auto sm:mx-0 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('teachers')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'teachers'
              ? 'bg-white text-ink shadow-sm'
              : 'text-[#8E8E93] hover:text-ink'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-emerald-600" />
          <span>Öğretmenler ({teachers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('counselors')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'counselors'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
              : 'text-[#8E8E93] hover:text-ink'
          }`}
        >
          <Sparkles className="w-4 h-4 text-pink-400" />
          <span>Rehberlik Uzmanları ({counselors.length})</span>
        </button>
      </div>

      {/* 1. ÖĞRETMEN YÖNETİMİ SEKMESİ */}
      {activeTab === 'teachers' && (
        <>
          {/* Yeni Öğretmen Ekle Kartı */}
          <div className="notebook-card p-5 sm:p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-8 h-8 rounded-full bg-[#FF9500]/10 text-[#FF9500] flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-bold text-ink tracking-tight">Yeni Öğretmen Ekle</h3>
            </div>

            <form onSubmit={handleAddTeacher} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1.5">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="Öğretmenin Adı Soyadı"
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1.5">
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  placeholder="örn: mehmetogretmen"
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1.5">
                  Şifre
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Şifre"
                      className="w-full font-mono text-sm px-4 py-2.5 pr-10 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 tracking-wider transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-2.5 text-[#8E8E93] hover:text-ink p-1 rounded-lg transition-colors ios-press"
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
                    className="inline-flex items-center gap-1 px-3.5 py-2.5 bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 text-xs font-semibold rounded-xl hover:bg-[#34C759]/20 transition-all flex-shrink-0 ios-press"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Otomatik Ata</span>
                  </button>
                </div>
              </div>

              {addError && (
                <p className="text-[#FF3B30] text-xs font-medium bg-[#FF3B30]/10 p-3 rounded-xl border border-[#FF3B30]/20 animate-fadeIn">
                  {addError}
                </p>
              )}

              <button
                type="submit"
                disabled={addLoading}
                className="w-full bg-[#007AFF] hover:bg-[#0071E3] active:bg-[#005bb5] text-white font-semibold py-3 px-4 rounded-xl shadow-sm disabled:opacity-50 text-sm transition-all mt-2 ios-press"
              >
                {addLoading ? 'Ekleniyor…' : 'Öğretmeni Ekle'}
              </button>
            </form>
          </div>

          {/* Öğretmen Listesi */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-lg font-bold text-ink tracking-tight flex items-center gap-2">
                <span>Öğretmenler</span>
                <span className="text-xs font-semibold text-[#8E8E93] bg-[#E5E5EA] px-2.5 py-0.5 rounded-full">
                  {teachers.length}
                </span>
              </h3>
              <button
                type="button"
                onClick={fetchTeachers}
                className="p-2 text-[#8E8E93] hover:text-ink rounded-full bg-white hover:bg-[#E5E5EA]/60 transition-colors shadow-xs ios-press"
                title="Yenile"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-[#FF3B30]/10 text-[#FF3B30] rounded-xl text-xs font-medium border border-[#FF3B30]/20 mb-3">
                {error}
              </div>
            )}

            {loading && teachers.length === 0 ? (
              <div className="notebook-card text-center py-10 text-muted text-xs">Yükleniyor…</div>
            ) : teachers.length === 0 ? (
              <div className="notebook-card text-center py-10 text-muted text-xs">
                Henüz öğretmen eklenmedi. Yukarıdaki formdan ilk öğretmeni ekleyebilirsiniz.
              </div>
            ) : (
              <div className="space-y-3">
                {teachers.map((t) => {
                  const isEditing = editingTeacherId === t.id;

                  if (isEditing) {
                    return (
                      <div key={t.id} className="notebook-card p-5 space-y-3 border-[#007AFF]/40 border">
                        <div>
                          <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">Ad Soyad</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">Kullanıcı Adı</label>
                          <input
                            type="text"
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">Şifre (Değiştirmek için girin)</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type={showEditPassword ? 'text' : 'password'}
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="Yeni şifre girin"
                                className="w-full font-mono text-xs px-3.5 py-2.5 pr-9 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditPassword(!showEditPassword)}
                                className="absolute right-2 top-2.5 text-[#8E8E93] hover:text-ink p-0.5 rounded-lg transition-colors ios-press"
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
                              className="px-3 py-2 bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 text-xs font-semibold rounded-xl hover:bg-[#34C759]/20 transition-all flex-shrink-0 ios-press"
                            >
                              Otomatik
                            </button>
                          </div>
                        </div>

                        {editError && <p className="text-[#FF3B30] text-xs font-medium bg-[#FF3B30]/10 p-2.5 rounded-xl border border-[#FF3B30]/20">{editError}</p>}

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            disabled={saveLoading}
                            onClick={() => handleSaveEdit(t.id)}
                            className="flex-1 bg-[#007AFF] text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-[#0071E3] disabled:opacity-50 ios-press"
                          >
                            {saveLoading ? 'Kaydediliyor…' : 'Kaydet'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTeacherId(null)}
                            className="flex-1 bg-[#F2F2F7] text-[#8E8E93] font-semibold py-2.5 rounded-xl text-xs hover:bg-[#E5E5EA] ios-press"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={t.id} className="notebook-card p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-base text-ink tracking-tight">{t.name}</h4>
                          <p className="text-xs text-[#8E8E93] mt-0.5">
                            {t.student_count || 0} öğrenci · {fmtDate(t.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs bg-[#F2F2F7] p-2.5 rounded-xl border border-black/[0.04]">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-[#8E8E93] uppercase font-semibold">Kullanıcı Adı:</span>
                          <span className="font-mono font-semibold text-ink">{t.username}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onViewTeacherActivity(t.id)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/15 transition-all ios-press"
                        >
                          <Users className="w-3.5 h-3.5 text-[#007AFF]" />
                          <span>Öğrencileri Gör</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(t)}
                          className="p-2.5 rounded-xl text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 transition-all ios-press"
                          title="Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTeacher(t)}
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
        </>
      )}

      {/* 2. REHBERLİK UZMANLARI YÖNETİMİ SEKMESİ */}
      {activeTab === 'counselors' && (
        <>
          {/* Rehberlik Uzmanı Bilgilendirme */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/50 to-pink-50 border border-purple-200/60 shadow-xs flex items-start gap-3">
            <span className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center flex-shrink-0 text-base shadow-sm">
              🎯
            </span>
            <div className="text-xs text-purple-950 space-y-1">
              <h4 className="font-bold text-ink text-sm">Rehberlik Uzmanı Rolü & Yetkileri</h4>
              <p className="leading-relaxed">
                Atanan rehberlik uzmanları sisteme giriş yaptıklarında <strong>tüm öğretmenlerin öğrencilerini</strong> ve öğrencilerin günlük çözdüğü soruları, ders analizlerini ve deneme puanlarını inceleyebilirler.
              </p>
              <p className="leading-relaxed">
                Rehberlik uzmanı istediği öğrenciye <strong>Rehberlik Notu</strong> paylaşabilir. Bu not anında öğrencinin ana ekranındaki rehberlik alanında görünür.
              </p>
            </div>
          </div>

          {/* Yeni Rehberlik Uzmanı Ekle Formu */}
          <div className="notebook-card p-5 sm:p-6 border border-purple-200 shadow-md">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-lg font-bold text-ink tracking-tight">Yeni Rehberlik Uzmanı Ata / Ekle</h3>
            </div>

            <form onSubmit={handleAddCounselor} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1.5">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  value={newCounselorName}
                  onChange={(e) => setNewCounselorName(e.target.value)}
                  required
                  placeholder="Rehberlik Uzmanının Adı Soyadı"
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1.5">
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  value={newCounselorUsername}
                  onChange={(e) => setNewCounselorUsername(e.target.value)}
                  required
                  placeholder="örn: rehberlik_uzmani"
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1.5">
                  Şifre
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showNewCounselorPassword ? 'text' : 'password'}
                      value={newCounselorPassword}
                      onChange={(e) => setNewCounselorPassword(e.target.value)}
                      required
                      placeholder="Şifre"
                      className="w-full font-mono text-sm px-4 py-2.5 pr-10 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 tracking-wider transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewCounselorPassword(!showNewCounselorPassword)}
                      className="absolute right-2.5 top-2.5 text-[#8E8E93] hover:text-ink p-1 rounded-lg transition-colors ios-press"
                      title={showNewCounselorPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                    >
                      {showNewCounselorPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCounselorPassword(generatePin(8));
                      setShowNewCounselorPassword(true);
                    }}
                    className="inline-flex items-center gap-1 px-3.5 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold rounded-xl hover:bg-purple-100 transition-all flex-shrink-0 ios-press"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Otomatik Ata</span>
                  </button>
                </div>
              </div>

              {addCounselorError && (
                <p className="text-[#FF3B30] text-xs font-medium bg-[#FF3B30]/10 p-3 rounded-xl border border-[#FF3B30]/20 animate-fadeIn">
                  {addCounselorError}
                </p>
              )}

              <button
                type="submit"
                disabled={addCounselorLoading}
                className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-105 active:scale-[0.98] text-white font-semibold py-3 px-4 rounded-xl shadow-md shadow-purple-500/20 disabled:opacity-50 text-sm transition-all mt-2 ios-press"
              >
                {addCounselorLoading ? 'Ekleniyor…' : 'Rehberlik Uzmanını Ata / Kaydet'}
              </button>
            </form>
          </div>

          {/* Rehberlik Uzmanları Listesi */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-lg font-bold text-ink tracking-tight flex items-center gap-2">
                <span>Kayıtlı Rehberlik Uzmanları</span>
                <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                  {counselors.length}
                </span>
              </h3>
              <button
                type="button"
                onClick={fetchCounselors}
                className="p-2 text-[#8E8E93] hover:text-ink rounded-full bg-white hover:bg-[#E5E5EA]/60 transition-colors shadow-xs ios-press"
                title="Yenile"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${counselorsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {counselorsError && (
              <div className="p-3 bg-[#FF3B30]/10 text-[#FF3B30] rounded-xl text-xs font-medium border border-[#FF3B30]/20 mb-3">
                {counselorsError}
              </div>
            )}

            {counselorsLoading && counselors.length === 0 ? (
              <div className="notebook-card text-center py-10 text-muted text-xs">Yükleniyor…</div>
            ) : counselors.length === 0 ? (
              <div className="notebook-card text-center py-10 text-muted text-xs">
                Henüz rehberlik uzmanı eklenmedi. Yukarıdaki formdan ilk uzmanı ekleyebilirsiniz.
              </div>
            ) : (
              <div className="space-y-3">
                {counselors.map((c) => {
                  const isEditing = editingCounselorId === c.id;

                  if (isEditing) {
                    return (
                      <div key={c.id} className="notebook-card p-5 space-y-3 border-purple-500/50 border">
                        <div>
                          <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">Ad Soyad</label>
                          <input
                            type="text"
                            value={editCounselorName}
                            onChange={(e) => setEditCounselorName(e.target.value)}
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">Kullanıcı Adı</label>
                          <input
                            type="text"
                            value={editCounselorUsername}
                            onChange={(e) => setEditCounselorUsername(e.target.value)}
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wide mb-1">Şifre (Değiştirmek için girin)</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type={showEditCounselorPassword ? 'text' : 'password'}
                                value={editCounselorPassword}
                                onChange={(e) => setEditCounselorPassword(e.target.value)}
                                placeholder="Yeni şifre girin"
                                className="w-full font-mono text-xs px-3.5 py-2.5 pr-9 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink focus:bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditCounselorPassword(!showEditCounselorPassword)}
                                className="absolute right-2 top-2.5 text-[#8E8E93] hover:text-ink p-0.5 rounded-lg transition-colors ios-press"
                                title={showEditCounselorPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                              >
                                {showEditCounselorPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditCounselorPassword(generatePin(8));
                                setShowEditCounselorPassword(true);
                              }}
                              className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold rounded-xl hover:bg-purple-100 transition-all flex-shrink-0 ios-press"
                            >
                              Otomatik
                            </button>
                          </div>
                        </div>

                        {editCounselorError && <p className="text-[#FF3B30] text-xs font-medium bg-[#FF3B30]/10 p-2.5 rounded-xl border border-[#FF3B30]/20">{editCounselorError}</p>}

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            disabled={saveCounselorLoading}
                            onClick={() => handleSaveEditCounselor(c.id)}
                            className="flex-1 bg-purple-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-purple-700 disabled:opacity-50 ios-press"
                          >
                            {saveCounselorLoading ? 'Kaydediliyor…' : 'Kaydet'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCounselorId(null)}
                            className="flex-1 bg-[#F2F2F7] text-[#8E8E93] font-semibold py-2.5 rounded-xl text-xs hover:bg-[#E5E5EA] ios-press"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={c.id} className="notebook-card p-4 sm:p-5 space-y-3 border-purple-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-base text-ink tracking-tight flex items-center gap-2">
                            <span>{c.name}</span>
                            <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">
                              Rehberlik Uzmanı
                            </span>
                          </h4>
                          <p className="text-xs text-[#8E8E93] mt-0.5">
                            Eklenme: {fmtDate(c.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs bg-[#F2F2F7] p-2.5 rounded-xl border border-black/[0.04]">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-[#8E8E93] uppercase font-semibold">Kullanıcı Adı:</span>
                          <span className="font-mono font-semibold text-ink">{c.username}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => startEditCounselor(c)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-all ios-press"
                          title="Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Düzenle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCounselor(c)}
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
        </>
      )}
    </div>
  );
};
