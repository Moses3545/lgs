import React from 'react';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  roleBadge: string;
  title: string;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ roleBadge, title, onLogout }) => {
  return (
    <div className="flex items-center justify-between mb-6 pb-2 border-b border-ink/5">
      <div>
        <span className="font-mono text-xs uppercase tracking-wider text-muted font-semibold">
          {roleBadge}
        </span>
        <h2 className="font-serif text-2xl font-semibold text-ink tracking-tight mt-0.5">
          {title}
        </h2>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-brandRed/30 text-brandRed text-xs font-semibold hover:bg-dangerBg transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Çıkış</span>
      </button>
    </div>
  );
};
