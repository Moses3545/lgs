import React, { useState } from 'react';
import { X, Key, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { Session } from '../../types';
import { LS_TEACHER, LS_STUDENT } from '../../lib/utils';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session;
  onSessionUpdate?: (updatedSession: Session) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  session,
  onSessionUpdate,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const curr = currentPassword.trim();
    const next = newPassword.trim();
    const conf = confirmPassword.trim();

    if (!curr || !next || !conf) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    if (next.length < 4) {
      setError('Yeni şifre en az 4 karakter olmalıdır.');
      return;
    }

    if (next !== conf) {
      setError('Yeni şifreler birbiriyle eşleşmiyor.');
      return;
    }

    if (curr === next) {
      setError('Yeni şifreniz mevcut şifrenizle aynı olamaz.');
      return;
    }

    setLoading(true);

    try {
      let rpcName = '';
      let rpcParams: Record<string, any> = {
        p_current_password: curr,
        p_new_password: next,
        p_session_token: session.sessionToken || null,
      };

      if (session.role === 'admin') {
        rpcName = 'admin_change_password';
        rpcParams.p_admin_id = session.id;
      } else if (session.role === 'teacher') {
        rpcName = 'teacher_change_password';
        rpcParams.p_teacher_id = session.id;
      } else if (session.role === 'student') {
        rpcName = 'student_change_password';
        rpcParams.p_student_id = session.id;
      }

      const { data, error: rpcError } = await sb.rpc(rpcName, rpcParams);

      if (rpcError || !data || data.error) {
        setError(data?.message || 'Şifre güncellenemedi. Lütfen mevcut şifrenizi kontrol edin.');
        return;
      }

      setSuccess(data.message || 'Şifreniz başarıyla değiştirildi.');

      // Update session in memory & localStorage if stored
      const updatedSession: Session = {
        ...session,
        secret: next,
      };

      if (onSessionUpdate) {
        onSessionUpdate(updatedSession);
      }

      if (session.role === 'teacher') {
        const saved = localStorage.getItem(LS_TEACHER);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            localStorage.setItem(LS_TEACHER, JSON.stringify({ ...parsed, secret: next }));
          } catch {}
        }
      } else if (session.role === 'student') {
        const saved = localStorage.getItem(LS_STUDENT);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            localStorage.setItem(LS_STUDENT, JSON.stringify({ ...parsed, secret: next }));
          } catch {}
        }
      }

      setTimeout(() => {
        handleClose();
      }, 1400);
    } catch {
      setError('Bağlantı hatası oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm transition-all animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-ink/10 overflow-hidden">
        {/* Modal Başlık Barı */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/5 bg-cream/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brandGreen/10 flex items-center justify-center text-brandGreen">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold text-ink">Şifre Değiştir</h3>
              <p className="text-xs text-muted">Hesabınızın güvenliği için yeni şifre belirleyin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-full text-muted hover:text-ink hover:bg-ink/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Formu */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-dangerBg border border-brandRed/20 text-brandRed text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Mevcut Şifre */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Mevcut Şifre</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Mevcut şifrenizi girin"
                disabled={loading || !!success}
                className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl border border-ink/15 focus:outline-none focus:ring-2 focus:ring-brandGreen/20 focus:border-brandGreen bg-white transition-colors"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Yeni Şifre */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Yeni Şifre</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 4 karakter"
                disabled={loading || !!success}
                className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl border border-ink/15 focus:outline-none focus:ring-2 focus:ring-brandGreen/20 focus:border-brandGreen bg-white transition-colors"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Yeni Şifre Tekrar */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Yeni Şifre (Tekrar)</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Yeni şifrenizi tekrar girin"
                disabled={loading || !!success}
                className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl border border-ink/15 focus:outline-none focus:ring-2 focus:ring-brandGreen/20 focus:border-brandGreen bg-white transition-colors"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Butonlar */}
          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading || !!success}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ink/70 hover:bg-ink/5 transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={loading || !!success}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-brandGreen text-white text-xs font-semibold hover:bg-brandGreen/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <span>Şifreyi Güncelle</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
