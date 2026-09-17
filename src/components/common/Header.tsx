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

  return (
    <>
      <div className="flex items-center justify-between mb-6 pb-2 border-b border-ink/5">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-muted font-semibold">
            {roleBadge}
          </span>
          <h2 className="font-serif text-2xl font-semibold text-ink tracking-tight mt-0.5">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ink/15 text-ink text-xs font-semibold hover:bg-ink/5 hover:border-ink/25 transition-colors shadow-xs"
              title="Hesap şifresini değiştir"
            >
              <Key className="w-3.5 h-3.5 text-muted" />
              <span className="hidden sm:inline">Şifre Değiştir</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-brandRed/30 text-brandRed text-xs font-semibold hover:bg-dangerBg transition-colors"
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
