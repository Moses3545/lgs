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
    <div className="animate-fadeIn max-w-md mx-auto">
      <div className="notebook-card p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-full bg-[#AF52DE]/10 text-[#AF52DE] flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </span>
          <span className="text-xs font-semibold text-[#8E8E93] tracking-wide uppercase">Yönetici Paneli</span>
        </div>
        <h2 className="text-2xl font-bold text-ink tracking-tight mb-6">
          Admin Girişi
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-username" className="block text-xs font-semibold text-[#8E8E93] mb-1.5 uppercase tracking-wide">
              Kullanıcı Adı / E-posta
            </label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              placeholder="admin"
              className="w-full text-sm px-4 py-3 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink placeholder:text-[#8E8E93]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] transition-all"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-[#8E8E93] mb-1.5 uppercase tracking-wide">
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
                className="w-full text-sm px-4 py-3 pr-11 rounded-xl border border-black/[0.08] bg-[#F2F2F7] text-ink placeholder:text-[#8E8E93]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] transition-all"
                placeholder="Parolanızı girin"
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

          {error && (
            <div className="text-[#FF3B30] text-xs font-medium bg-[#FF3B30]/10 p-3 rounded-xl border border-[#FF3B30]/20 animate-fadeIn">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#007AFF] hover:bg-[#0071E3] active:bg-[#005bb5] text-white font-semibold py-3.5 px-4 rounded-xl shadow-sm disabled:opacity-50 transition-all text-sm mt-3 ios-press"
          >
            {loading ? 'Kontrol ediliyor…' : 'Giriş Yap'}
          </button>
        </form>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-[#007AFF] hover:text-[#005bb5] font-medium mt-5 transition-colors ios-press"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Rol seçimine dön</span>
        </button>
      </div>
    </div>
  );
};
