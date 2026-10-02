import React, { useState, useEffect } from 'react';
import { X, Mail, Download, CheckCircle2, AlertCircle, Copy, Check, FileSpreadsheet, FileJson } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { Student } from '../../types';
import { exportWeeklyTeacherBackup, exportTeacherStudents, exportFullJsonBackup } from '../../lib/excel';
import { todayStr, weekRange, inRange } from '../../lib/utils';
import { toISODateStr } from '../../lib/calendarUtils';

interface BackupEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  teacherName: string;
  isAdmin?: boolean;
  adminId?: string;
}

export const BackupEmailModal: React.FC<BackupEmailModalProps> = ({
  isOpen,
  onClose,
  students,
  teacherName,
  isAdmin = false,
  adminId,
}) => {
  const [email, setEmail] = useState('');
  const [adminConfiguredEmail, setAdminConfiguredEmail] = useState<string | null>(null);
  const [backupType, setBackupType] = useState<'weekly' | 'all' | 'json'>('weekly');
  const [loading, setLoading] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch admin configured backup email from Supabase
  useEffect(() => {
    if (!isOpen) return;
    setMsg(null);
    const fetchBackupEmail = async () => {
      try {
        const { data, error } = await sb.rpc('get_backup_email');
        if (!error && data && data.email) {
          setAdminConfiguredEmail(data.email);
          setEmail(data.email);
        } else {
          // Fallback to localStorage if any
          const cached = localStorage.getItem('lgs_backup_email');
          if (cached) setEmail(cached);
        }
      } catch (err) {
        console.error('Error fetching backup email:', err);
      }
    };

    fetchBackupEmail();
  }, [isOpen]);

  if (!isOpen) return null;

  const [wStart, wEnd] = weekRange(0);
  const wStartStr = toISODateStr(wStart);
  const wEndStr = toISODateStr(wEnd);

  // Toplam haftalık soru
  const weekTotal = students.reduce((acc, s) => {
    const sTotal = (s.entries || [])
      .filter((e) => inRange(e.date, wStart, wEnd))
      .reduce((sum, e) => {
        return sum + Object.values(e.subjects || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      }, 0);
    return acc + sTotal;
  }, 0);

  // Admin saves default email
  const handleSaveDefaultEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setMsg({ type: 'error', text: 'Lütfen geçerli bir e-posta adresi girin.' });
      return;
    }

    setSavingEmail(true);
    setMsg(null);
    try {
      if (isAdmin && adminId) {
        const { data, error } = await sb.rpc('admin_set_backup_email', {
          p_admin_id: adminId,
          p_email: trimmed,
        });
        if (error || !data || !data.success) {
          throw new Error('E-posta kaydedilemedi.');
        }
      }
      localStorage.setItem('lgs_backup_email', trimmed);
      setAdminConfiguredEmail(trimmed);
      setMsg({ type: 'success', text: 'Yedekleme e-posta adresi başarıyla kaydedildi!' });
    } catch {
      setMsg({ type: 'error', text: 'E-posta kaydedilirken bir hata oluştu.' });
    } finally {
      setSavingEmail(false);
    }
  };

  // İndir ve E-posta İstemcisini Aç (Mailto)
  const handleSendViaEmail = async () => {
    const targetEmail = email.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setMsg({ type: 'error', text: 'Lütfen yedeğin gönderileceği geçerli bir e-posta adresi girin.' });
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      // 1. Dosyayı indir
      if (backupType === 'weekly') {
        await exportWeeklyTeacherBackup(teacherName, students, 0);
      } else if (backupType === 'all') {
        await exportTeacherStudents(teacherName, students);
      } else {
        exportFullJsonBackup(teacherName, {
          exported_at: new Date().toISOString(),
          teacher: teacherName,
          students_count: students.length,
          students,
        });
      }

      // 2. Mailto içeriğini hazırla
      const subject = encodeURIComponent(
        `[LGS Soru Takip] ${backupType === 'weekly' ? `Haftalık Yedek (${wStartStr} - ${wEndStr})` : 'Genel Veri Yedeği'} - ${teacherName}`
      );

      const bodyText =
        `Merhaba,\n\n` +
        `LGS Soru Takip Sistemi üzerinden hazırlanan yedek raporu ekte yer almaktadır.\n\n` +
        `• Öğretmen: ${teacherName}\n` +
        `• Öğrenci Sayısı: ${students.length}\n` +
        (backupType === 'weekly'
          ? `• Hafta Aralığı: ${wStartStr} – ${wEndStr}\n• Bu Hafta Toplam Çözülen Soru: ${weekTotal}\n\n`
          : `• Rapor Tarihi: ${todayStr()}\n\n`) +
        `Bilgisayarınıza indirilen "${backupType === 'weekly' ? 'haftalik-lgs-yedek' : 'lgs-yedek'}.xlsx" dosyasını bu e-postaya ekleyerek arşivleyebilirsiniz.\n\n` +
        `İyi çalışmalar dileriz.`;

      const body = encodeURIComponent(bodyText);

      // Mailto bağlantısını tetikle
      window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`;

      setMsg({
        type: 'success',
        text: 'Yedek dosyası bilgisayarınıza indirildi ve e-posta taslağınız açıldı! Lütfen indirilen dosyayı ekleyerek gönderin.',
      });
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Yedekleme dosyası hazırlanırken bir hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  // Doğrudan PC'ye indir
  const handleDirectDownload = async () => {
    setLoading(true);
    try {
      if (backupType === 'weekly') {
        await exportWeeklyTeacherBackup(teacherName, students, 0);
      } else if (backupType === 'all') {
        await exportTeacherStudents(teacherName, students);
      } else {
        exportFullJsonBackup(teacherName, {
          exported_at: new Date().toISOString(),
          teacher: teacherName,
          students_count: students.length,
          students,
        });
      }
      setMsg({ type: 'success', text: 'Yedek dosyası bilgisayarınıza başarıyla indirildi!' });
    } catch {
      setMsg({ type: 'error', text: 'İndirme sırasında bir hata oluştu.' });
    } finally {
      setLoading(false);
    }
  };

  // Özeti panoya kopyala
  const handleCopySummary = () => {
    const summary =
      `📋 LGS Soru Takip - ${teacherName} Haftalık Özeti\n` +
      `📅 Dönem: ${wStartStr} – ${wEndStr}\n` +
      `👥 Öğrenci Sayısı: ${students.length}\n` +
      `🔥 Bu Hafta Çözülen Soru: ${weekTotal}\n\n` +
      `Öğrenci Dağılımı:\n` +
      students
        .map((s) => {
          const tot = (s.entries || [])
            .filter((e) => inRange(e.date, wStart, wEnd))
            .reduce((sum, e) => sum + Object.values(e.subjects || {}).reduce((a, b) => a + (Number(b) || 0), 0), 0);
          return `• ${s.name}: ${tot} soru ${s.daily_target ? `(Hedef: ${s.daily_target * 7})` : ''}`;
        })
        .join('\n');

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl border border-black/10 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Üst Başlık */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-lg">
              📬
            </span>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Haftalık Yedekleme & E-Posta</h3>
              <p className="text-[11px] text-blue-100">Verileri Excel veya JSON olarak yedekleyin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors ios-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* İçerik */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Yönetici E-Posta Bilgisi */}
          {adminConfiguredEmail ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Yönetici Tarafından Tanımlanan Yedek Maili: </span>
                <span className="font-mono font-bold text-emerald-700">{adminConfiguredEmail}</span>
                <p className="text-[10px] text-emerald-800/80 mt-0.5">
                  Her Pazar gecesi otomatik yedek bu adrese gönderilmek üzere ayarlanmıştır.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Henüz Yönetici Yedek E-postası Tanımlanmamış: </span>
                <span className="text-[11px] text-amber-800">
                  Lütfen aşağıya yedeklerin gönderileceği e-posta adresini girin.
                </span>
              </div>
            </div>
          )}

          {/* E-Posta Adresi Girişi */}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8E93] uppercase tracking-wide mb-1.5">
              Yedeğin Gönderileceği E-Posta Adresi
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-muted absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@okul.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-black/10 bg-[#F2F2F7] text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-medium text-xs sm:text-sm"
                />
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleSaveDefaultEmail}
                  disabled={savingEmail || !email.trim()}
                  className="ios-press px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs whitespace-nowrap shadow-xs disabled:opacity-50"
                  title="Bu e-postayı veritabanında varsayılan olarak kaydeder"
                >
                  {savingEmail ? 'Kaydediliyor…' : 'Varsayılan Yap'}
                </button>
              )}
            </div>
          </div>

          {/* Yedek Türü Seçimi */}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8E93] uppercase tracking-wide mb-1.5">
              Yedekleme Kapsamı
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBackupType('weekly')}
                className={`ios-press p-2.5 rounded-2xl border text-center transition-all ${
                  backupType === 'weekly'
                    ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold shadow-xs'
                    : 'border-black/10 bg-white text-muted hover:text-ink'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                <div className="text-xs">Bu Hafta</div>
                <div className="text-[9px] text-muted">Özet & Günlük</div>
              </button>

              <button
                type="button"
                onClick={() => setBackupType('all')}
                className={`ios-press p-2.5 rounded-2xl border text-center transition-all ${
                  backupType === 'all'
                    ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold shadow-xs'
                    : 'border-black/10 bg-white text-muted hover:text-ink'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                <div className="text-xs">Tüm Zamanlar</div>
                <div className="text-[9px] text-muted">Tam Excel Tablosu</div>
              </button>

              <button
                type="button"
                onClick={() => setBackupType('json')}
                className={`ios-press p-2.5 rounded-2xl border text-center transition-all ${
                  backupType === 'json'
                    ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold shadow-xs'
                    : 'border-black/10 bg-white text-muted hover:text-ink'
                }`}
              >
                <FileJson className="w-4 h-4 mx-auto mb-1 text-purple-600" />
                <div className="text-xs">Tam Veritabanı</div>
                <div className="text-[9px] text-muted">JSON Formatı</div>
              </button>
            </div>
          </div>

          {/* Bildirim / Mesaj Kutusu */}
          {msg && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 animate-fadeIn ${
                msg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          {/* Alt Eylemler */}
          <div className="pt-2 border-t border-black/5 space-y-2">
            <button
              type="button"
              onClick={handleSendViaEmail}
              disabled={loading || !email.trim()}
              className="w-full ios-press flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-105 active:scale-[0.98] text-white font-bold rounded-2xl shadow-md shadow-blue-500/20 text-sm disabled:opacity-50 transition-all"
            >
              <Mail className="w-4 h-4" />
              <span>{loading ? 'Dosya Hazırlanıyor…' : 'İndir ve E-Posta Taslağı Aç'}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDirectDownload}
                disabled={loading}
                className="ios-press flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#F2F2F7] hover:bg-[#E5E5EA] text-ink font-semibold rounded-xl text-xs transition-all border border-black/5"
              >
                <Download className="w-3.5 h-3.5 text-muted" />
                <span>Yalnızca PC'ye İndir</span>
              </button>

              <button
                type="button"
                onClick={handleCopySummary}
                className="ios-press flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#F2F2F7] hover:bg-[#E5E5EA] text-ink font-semibold rounded-xl text-xs transition-all border border-black/5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted" />}
                <span>{copied ? 'Kopyalandı!' : 'Özeti Kopyala'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
