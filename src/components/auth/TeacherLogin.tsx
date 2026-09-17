import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { sb, toVirtualEmail } from '../../lib/supabase';
import { Session } from '../../types';
import { LS_TEACHER } from '../../lib/utils';

interface TeacherLoginProps {
  onSuccess: (session: Session) => void;
  onBack: () => void;
}

export const TeacherLogin: React.FC<TeacherLoginProps> = ({ onSuccess, onBack }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const u = username.trim();
    if (!u || !password) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    setLoading(true);
    try {
      // 0. Rate Limit Kontrolü
      const { data: rlData } = await sb.rpc('check_login_rate_limit', { p_identifier: u });
      if (rlData && rlData.allowed === false) {
        setError(rlData.message || 'Çok fazla hatalı giriş yapıldı. Lütfen 15 dakika bekleyin.');
        setLoading(false);
        return;
      }

      // 1. Supabase Auth ile dene (Sanal e-posta yöntemi)
      const virtualEmail = toVirtualEmail(u);
      const { data: authData, error: authError } = await sb.auth.signInWithPassword({
        email: virtualEmail,
        password: password,
      });

      if (!authError && authData?.session) {
        await sb.rpc('record_successful_login', { p_identifier: u });
        const user = authData.user;
        const origId = user.app_metadata?.original_id || user.id;
        const name = user.user_metadata?.name || u;

        const session: Session = {
          role: 'teacher',
          id: origId,
          sessionToken: authData.session.access_token,
          secret: password,
          name,
        };

        if (remember) {
          localStorage.setItem(
            LS_TEACHER,
            JSON.stringify({
              id: origId,
              username: u,
              sessionToken: authData.session.access_token,
              name,
            })
          );
        } else {
          localStorage.removeItem(LS_TEACHER);
        }

        onSuccess(session);
        return;
      }

      // 2. RPC Fallback (Migration çalıştırılmamışsa veya geçiş aşamasındaysa)
      const { data, error: rpcError } = await sb.rpc('teacher_login', {
        p_username: u,
        p_password: password,
      });

      if (rpcError || !data || data.error) {
        await sb.rpc('record_failed_attempt', { p_identifier: u });
        setError('Kullanıcı adı veya şifre hatalı.');
        return;
      }

      await sb.rpc('record_successful_login', { p_identifier: u });

      const session: Session = {
        role: 'teacher',
        id: data.id,
        sessionToken: data.session_token,
        secret: password,
        name: data.name || u,
      };

      if (remember) {
        localStorage.setItem(
          LS_TEACHER,
          JSON.stringify({
            id: data.id,
            username: u,
            sessionToken: data.session_token,
            name: data.name || u,
          })
        );
      } else {
        localStorage.removeItem(LS_TEACHER);
      }

      onSuccess(session);
    } catch {
      setError('Giriş yapılırken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="notebook-card">
        <div className="font-mono text-xs uppercase tracking-wider text-muted mb-1 font-semibold">
          Öğretmen Girişi
        </div>
        <h2 className="font-serif text-2xl font-bold text-ink mb-4">
          Hesabına gir
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="teacher-username" className="block text-xs font-semibold text-muted mb-1.5">
              Kullanıcı Adı
            </label>
            <input
              id="teacher-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full text-sm px-3.5 py-2.5 rounded-md border border-ink/20 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brandGreen/40 focus:border-brandGreen transition-all"
            />
          </div>

          <div>
            <label htmlFor="teacher-password" className="block text-xs font-semibold text-muted mb-1.5">
              Şifre
            </label>
            <div className="relative">
              <input
                id="teacher-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full text-sm px-3.5 py-2.5 pr-10 rounded-md border border-ink/20 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brandGreen/40 focus:border-brandGreen transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted hover:text-ink p-0.5 rounded transition-colors"
                title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="teacher-remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 text-brandGreen rounded border-ink/20 focus:ring-brandGreen cursor-pointer"
            />
            <label htmlFor="teacher-remember" className="text-xs text-ink/80 cursor-pointer select-none">
              Bu cihazda beni hatırla
            </label>
          </div>

          {error && (
            <div className="text-brandRed text-xs font-medium bg-dangerBg/50 p-2.5 rounded border border-brandRed/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brandGreen text-white font-semibold py-2.5 px-4 rounded-md shadow-sm hover:opacity-90 active:scale-[0.99] disabled:opacity-50 transition-all text-sm mt-2"
          >
            {loading ? 'Kontrol ediliyor…' : 'Giriş Yap'}
          </button>
        </form>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink font-medium mt-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Rol seçimine dön</span>
        </button>
      </div>
    </div>
  );
};
