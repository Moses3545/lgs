import React, { useState } from 'react';
import { ArrowLeft, Shield, Eye, EyeOff } from 'lucide-react';
import { sb, toVirtualEmail } from '../../lib/supabase';
import { Session } from '../../types';

interface AdminLoginProps {
  onSuccess: (session: Session) => void;
  onBack: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onBack }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    setLoading(true);
    try {
      // 1. Supabase Auth (Sanal E-posta: admin@lgs.internal veya girilen email)
      const virtualEmail = toVirtualEmail(u);
      const { data: authData, error: authError } = await sb.auth.signInWithPassword({
        email: virtualEmail,
        password: p,
      });

      if (!authError && authData?.session) {
        try { await sb.rpc('record_successful_login', { p_identifier: u }); } catch {}
        onSuccess({
          role: 'admin',
          id: authData.user.id,
          sessionToken: authData.session.access_token,
          secret: p,
          name: authData.user.user_metadata?.name || 'Sistem Yöneticisi',
        });
        return;
      }

      // 2. RPC admin_login denemesi
      const { data, error: rpcError } = await sb.rpc('admin_login', { p_username: u, p_password: p });
      if (!rpcError && data && !data.error) {
        try { await sb.rpc('record_successful_login', { p_identifier: u }); } catch {}
        onSuccess({
          role: 'admin',
          id: data.id || 'admin',
          sessionToken: data.session_token,
          secret: p,
          name: data.name || 'Sistem Yöneticisi',
        });
        return;
      }

      if (data && data.error) {
        setError(data.error);
        return;
      }

      // 3. Fallback: varsayılan admin kullanıcı adı ve parolası / PIN'i ile doğrudan giriş
      if (u.toLowerCase() === 'admin' && (p === 'Admin.Lgs2026!' || p === '1234' || p === '1923')) {
        onSuccess({
          role: 'admin',
          id: 'admin',
          secret: p,
          name: 'Sistem Yöneticisi',
        });
        return;
      }

      try { await sb.rpc('record_failed_attempt', { p_identifier: u }); } catch {}
      setError('Kullanıcı adı veya parola hatalı.');
    } catch {
      // Catch fallback for admin user
      if (u.toLowerCase() === 'admin' && (p === 'Admin.Lgs2026!' || p === '1234' || p === '1923')) {
        onSuccess({
          role: 'admin',
          id: 'admin',
          secret: p,
          name: 'Sistem Yöneticisi',
        });
        return;
      }
      setError('Bağlantı hatası oluştu, tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="notebook-card">
        <div className="font-mono text-xs uppercase tracking-wider text-muted mb-1 font-semibold flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-brandGreen" />
          <span>Yönetici Girişi</span>
        </div>
        <h2 className="font-serif text-2xl font-bold text-ink mb-4">
          Admin Paneline Bağlan
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="admin-username" className="block text-xs font-semibold text-muted mb-1.5">
              Kullanıcı Adı / E-posta
            </label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full text-sm px-3.5 py-2.5 rounded-md border border-ink/20 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brandGreen/40 focus:border-brandGreen transition-all"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-muted mb-1.5">
              Admin Parolası
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full text-sm px-3.5 py-2.5 pr-10 rounded-md border border-ink/20 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brandGreen/40 focus:border-brandGreen transition-all"
                placeholder="Admin parolanızı girin"
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
