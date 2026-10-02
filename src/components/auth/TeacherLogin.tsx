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
      <button
        type="button"
        onClick={onBack}
        className="ios-press inline-flex items-center gap-1.5 text-sm text-[#007AFF] hover:text-[#005bb5] font-bold mb-3 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Geri Dön</span>
      </button>

      <div className="notebook-card p-6 sm:p-8 border border-white shadow-lg">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase mb-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs">
          <span>📚</span> Öğretmen Girişi
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-ink tracking-tight mb-5">
          Öğretmen Paneli Girişi
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="teacher-username" className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wide">
              Kullanıcı Adı
            </label>
            <input
              id="teacher-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="Öğretmen kullanıcı adı"
              required
              className="w-full text-base sm:text-sm px-4 py-3 rounded-2xl border border-black/[0.08] bg-emerald-50/40 text-ink focus:outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
            />
          </div>

          <div>
            <label htmlFor="teacher-password" className="block text-xs font-bold text-ink mb-1.5 uppercase tracking-wide">
              Şifre
            </label>
            <div className="relative">
              <input
                id="teacher-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Şifrenizi girin"
                required
                className="w-full text-base sm:text-sm px-4 py-3 pr-11 rounded-2xl border border-black/[0.08] bg-emerald-50/40 text-ink focus:outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#8E8E93] hover:text-ink p-1 rounded-lg transition-colors ios-press"
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
              className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="teacher-remember" className="text-xs text-ink/80 cursor-pointer select-none font-semibold">
              Beni hatırla
            </label>
          </div>

          {error && (
            <div className="text-rose-600 text-xs font-bold bg-rose-50 p-3 rounded-2xl border border-rose-200 animate-fadeIn">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="ios-press w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 active:scale-[0.98] text-white font-black py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-500/25 disabled:opacity-50 transition-all text-base mt-3"
          >
            {loading ? 'Kontrol ediliyor…' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
};
