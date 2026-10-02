import React from 'react';
import { Shield, GraduationCap, BookOpen, ChevronRight } from 'lucide-react';
import { Role } from '../../types';

interface RoleSelectionProps {
  onSelectRole: (role: Role) => void;
}

export const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectRole }) => {
  return (
    <div className="animate-fadeIn">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase mb-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-sm shadow-blue-500/25">
        <span>🚀</span> LGS 2026 HEDEF PORTALI
      </div>
      <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight mb-2">
        Kim giriş yapıyor?
      </h1>
      <p className="text-[#8E8E93] text-sm font-medium mb-6">
        Devam etmek için profilini seç ve hemen başla!
      </p>

      <div className="flex flex-col gap-3.5">
        <button
          type="button"
          onClick={() => onSelectRole('student')}
          className="ios-press group flex items-center gap-4 w-full bg-gradient-to-r from-blue-50/90 via-white to-indigo-50/50 border-2 border-blue-200 hover:border-blue-400 rounded-3xl p-4 sm:p-5 text-left shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg text-blue-950 flex items-center gap-1.5">
              <span>Öğrenci Girişi</span>
              <span className="text-sm">🎒</span>
            </div>
            <div className="text-xs text-blue-900/70 font-medium mt-0.5">Bugünün sorularını kaydet, hedefini yakala ve seriyi koru!</div>
          </div>
          <ChevronRight className="w-6 h-6 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
        </button>

        <button
          type="button"
          onClick={() => onSelectRole('teacher')}
          className="ios-press group flex items-center gap-4 w-full bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/50 border-2 border-emerald-200 hover:border-emerald-400 rounded-3xl p-4 sm:p-5 text-left shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-200"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg text-emerald-950 flex items-center gap-1.5">
              <span>Öğretmen Girişi</span>
              <span className="text-sm">📚</span>
            </div>
            <div className="text-xs text-emerald-900/70 font-medium mt-0.5">Öğrencilerin haftalık & aylık soru analizlerini ve hedeflerini incele</div>
          </div>
          <ChevronRight className="w-6 h-6 text-emerald-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
        </button>

        <button
          type="button"
          onClick={() => onSelectRole('admin')}
          className="ios-press group flex items-center gap-4 w-full bg-gradient-to-r from-amber-50/90 via-white to-orange-50/50 border-2 border-amber-200 hover:border-amber-400 rounded-3xl p-4 sm:p-5 text-left shadow-md shadow-amber-500/10 hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-200"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/30 group-hover:scale-105 transition-transform">
            <Shield className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg text-amber-950 flex items-center gap-1.5">
              <span>Yönetici (Admin)</span>
              <span className="text-sm">⚙️</span>
            </div>
            <div className="text-xs text-amber-900/70 font-medium mt-0.5">Öğretmen hesaplarını ve tüm sistemi yönet</div>
          </div>
          <ChevronRight className="w-6 h-6 text-amber-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
        </button>
      </div>
    </div>
  );
};
