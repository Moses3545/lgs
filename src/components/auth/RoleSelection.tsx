import React from 'react';
import { Shield, GraduationCap, BookOpen } from 'lucide-react';
import { Role } from '../../types';

interface RoleSelectionProps {
  onSelectRole: (role: Role) => void;
}

export const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectRole }) => {
  return (
    <div className="animate-fadeIn">
      <div className="font-mono text-xs uppercase tracking-widest text-muted mb-2 font-semibold">
        Soru Takip
      </div>
      <h1 className="font-serif text-3xl font-bold text-ink tracking-tight mb-2">
        Kim giriş yapıyor?
      </h1>
      <p className="text-muted text-sm mb-6">
        Rolünü seç, devam edelim.
      </p>

      <div className="flex flex-col gap-3.5">
        <button
          type="button"
          onClick={() => onSelectRole('admin')}
          className="group flex items-center gap-4 w-full bg-paper border border-ink/10 rounded-lg p-4 text-left shadow-notebook hover:-translate-y-0.5 hover:border-brandGold/40 transition-all duration-200"
        >
          <div className="w-11 h-11 rounded-full bg-brandGold text-white flex items-center justify-center flex-shrink-0 font-serif font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base text-ink">Admin</div>
            <div className="text-xs text-muted mt-0.5">Öğretmen hesaplarını yönet</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectRole('teacher')}
          className="group flex items-center gap-4 w-full bg-paper border border-ink/10 rounded-lg p-4 text-left shadow-notebook hover:-translate-y-0.5 hover:border-brandGreen/40 transition-all duration-200"
        >
          <div className="w-11 h-11 rounded-full bg-brandGreen text-white flex items-center justify-center flex-shrink-0 font-serif font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base text-ink">Öğretmen</div>
            <div className="text-xs text-muted mt-0.5">Öğrencilerini takip et</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectRole('student')}
          className="group flex items-center gap-4 w-full bg-paper border border-ink/10 rounded-lg p-4 text-left shadow-notebook hover:-translate-y-0.5 hover:border-brandRed/40 transition-all duration-200"
        >
          <div className="w-11 h-11 rounded-full bg-brandRed text-white flex items-center justify-center flex-shrink-0 font-serif font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base text-ink">Öğrenci</div>
            <div className="text-xs text-muted mt-0.5">Bugünün sorularını gir</div>
          </div>
        </button>
      </div>
    </div>
  );
};
