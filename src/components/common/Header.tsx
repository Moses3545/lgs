import React, { useState } from 'react';
import { LogOut, Key } from 'lucide-react';
import { Session } from '../../types';
import { ChangePasswordModal } from './ChangePasswordModal';

interface HeaderProps {
  roleBadge: string;
  title: string;
  onLogout: () => void;
  session?: Session;
  onSessionUpdate?: (updatedSession: Session) => void;
}

export const Header: React.FC<HeaderProps> = ({
  roleBadge,
  title,
  onLogout,
  session,
  onSessionUpdate,
}) => {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const badgeGradient =
    roleBadge === 'ÖĞRENCİ'
      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-sm shadow-blue-500/20'
      : roleBadge === 'ÖĞRETMEN'
      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-500/20'
      : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm shadow-amber-500/20';

  return (
    <>
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-black/[0.06]">
        <div className="min-w-0 pr-2">
          <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase mb-1 ${badgeGradient}`}>
            {roleBadge === 'ÖĞRENCİ' ? '🎒 ' : roleBadge === 'ÖĞRETMEN' ? '📚 ' : '⚙️ '}
            {roleBadge}
          </span>
          <h2 className="text-base sm:text-2xl font-black text-ink tracking-tight">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {session && (
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="ios-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] text-ink text-xs font-semibold bg-white/90 hover:bg-white transition-all shadow-xs"
              title="Hesap şifresini değiştir"
            >
              <Key className="w-3.5 h-3.5 text-[#8E8E93]" />
              <span className="hidden sm:inline">Şifre Değiştir</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="ios-press inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#FF3B30]/20 text-[#FF3B30] text-xs font-semibold bg-white/90 hover:bg-[#FF3B30]/10 transition-all shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Çıkış</span>
          </button>
        </div>
      </div>

      {session && (
        <ChangePasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          session={session}
          onSessionUpdate={onSessionUpdate}
        />
      )}
    </>
  );
};
