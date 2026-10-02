import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase URL & Keys
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://uogcawdqegzuiecrjesn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Uf1npAPsugEXg594AFybQQ_K4gyZz1X';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const SUBJECTS = ['Türkçe', 'Paragraf', 'Matematik', 'Fen Bilimleri', 'T.C. İnkılap Tarihi', 'Din Kültürü', 'İngilizce'];

function getWeekRange() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Pazartesi
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 12, 0, 0);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 12, 0, 0);

  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  };

  return { mondayStr: fmt(monday), sundayStr: fmt(sunday), monday, sunday };
}

async function runBackup() {
  console.log('🚀 LGS Haftalık Otomatik Yedekleme Başlatılıyor...');

  // 1. Admin tarafından belirlenen e-posta adresini al
  let backupEmail = process.env.TARGET_EMAIL || '';
  try {
    const { data: emailData, error: emailError } = await sb.rpc('get_backup_email');
    if (!emailError && emailData && emailData.email) {
      backupEmail = emailData.email;
      console.log(`📬 Yönetici tarafından tanımlanan yedek e-postası: ${backupEmail}`);
    }
  } catch (err) {
    console.warn('Yönetici e-postası veritabanından çekilemedi:', err.message);
  }

  // 2. Tüm öğrencileri ve soru kayıtlarını veritabanından çek
  console.log('📥 Veritabanından öğrenci ve soru verileri çekiliyor...');
  const { data: rpcRes, error: sErr } = await sb.rpc('admin_get_all_students_data');

  if (sErr) {
    console.error('Öğrenci verileri alınamadı:', sErr);
    process.exit(1);
  }

  const students = rpcRes && rpcRes.students ? rpcRes.students : [];
  console.log(`✅ Toplam ${students.length} öğrenci kaydı bulundu.`);

  const { mondayStr, sundayStr, monday } = getWeekRange();
  const dayLabels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12, 0, 0);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const da = String(cur.getDate()).padStart(2, '0');
    weekDays.push({
      dateStr: `${y}-${m}-${da}`,
      label: `${cur.getDate()} ${dayLabels[i]}`,
    });
  }

  // 3. Excel Dosyası Oluştur
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LGS Soru Takip Sistemi';
  wb.created = new Date();

  // Sayfa 1: Haftalık Özet
  const wsOverview = wb.addWorksheet('Haftalık Özet');
  wsOverview.columns = [
    { header: 'Öğrenci', key: 'student', width: 24 },
    { header: 'Günlük Hedef', key: 'target', width: 14 },
    ...weekDays.map((d) => ({ header: d.label, key: d.dateStr, width: 12 })),
    { header: 'Hafta Toplamı', key: 'total', width: 16 },
    { header: 'Aktif Gün', key: 'active_days', width: 14 },
    { header: 'Hedef Durumu', key: 'status', width: 18 },
  ];
  wsOverview.getRow(1).font = { bold: true };

  let overallWeekTotal = 0;

  (students || []).forEach((s) => {
    const rowObj = {
      student: s.name,
      target: s.daily_target != null ? s.daily_target : '-',
    };

    let studentWeekTotal = 0;
    let activeDays = 0;

    weekDays.forEach((d) => {
      const entry = (s.entries || []).find((e) => (e.date || '').slice(0, 10) === d.dateStr);
      let count = 0;
      if (entry && entry.subjects) {
        count = Object.values(entry.subjects).reduce((a, b) => a + (Number(b) || 0), 0);
      }
      rowObj[d.dateStr] = count > 0 ? count : '-';
      if (count > 0) {
        studentWeekTotal += count;
        activeDays++;
      }
    });

    overallWeekTotal += studentWeekTotal;
    rowObj.total = studentWeekTotal;
    rowObj.active_days = `${activeDays} / 7`;

    if (s.daily_target && s.daily_target > 0) {
      const weeklyTarget = s.daily_target * 7;
      rowObj.status = studentWeekTotal >= weeklyTarget ? 'Hedefe Ulaşıldı ✅' : `Hedefe %${Math.round((studentWeekTotal / weeklyTarget) * 100)}`;
    } else {
      rowObj.status = studentWeekTotal > 0 ? 'Aktif' : 'Giriş Yok';
    }

    wsOverview.addRow(rowObj);
  });

  wsOverview.addRow([]);
  const sumRow = wsOverview.addRow({
    student: 'GENEL TOPLAM',
    total: overallWeekTotal,
  });
  sumRow.font = { bold: true, size: 11 };

  // Sayfa 2: Ders Dağılımı
  const wsSubjects = wb.addWorksheet('Haftalık Dersler');
  wsSubjects.columns = [
    { header: 'Öğrenci', key: 'student', width: 24 },
    ...SUBJECTS.map((subj) => ({ header: subj, key: subj, width: 15 })),
    { header: 'Toplam', key: 'total', width: 15 },
  ];
  wsSubjects.getRow(1).font = { bold: true };

  (students || []).forEach((s) => {
    const rowObj = { student: s.name };
    let studentTot = 0;
    SUBJECTS.forEach((subj) => {
      let subjCount = 0;
      (s.entries || []).forEach((e) => {
        const d = (e.date || '').slice(0, 10);
        if (d >= mondayStr && d <= sundayStr) {
          subjCount += Number(e.subjects?.[subj]) || 0;
        }
      });
      rowObj[subj] = subjCount;
      studentTot += subjCount;
    });
    rowObj.total = studentTot;
    wsSubjects.addRow(rowObj);
  });

  // Sayfa 3: Planlar ve Notlar
  const wsPlans = wb.addWorksheet('Planlar ve Notlar');
  wsPlans.columns = [
    { header: 'Öğrenci', key: 'student', width: 24 },
    { header: 'Haftaya Dair Plan ve Öneriler', key: 'plan', width: 36 },
    { header: 'Rehberlik Görüş ve Notları', key: 'guidance', width: 36 },
  ];
  wsPlans.getRow(1).font = { bold: true };

  (students || []).forEach((s) => {
    wsPlans.addRow({
      student: s.name,
      plan: s.weekly_plan || '-',
      guidance: s.guidance_note || '-',
    });
  });

  // Çıktı Dizinini Oluştur
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const excelFilename = `lgs-haftalik-yedek-${mondayStr}-ila-${sundayStr}.xlsx`;
  const excelFilePath = path.join(backupDir, excelFilename);
  await wb.xlsx.writeFile(excelFilePath);
  console.log(`💾 Excel yedeği kaydedildi: ${excelFilePath}`);

  // 4. JSON Veritabanı Yedeği
  const jsonFilename = `lgs-tam-veritabani-yedek-${mondayStr}.json`;
  const jsonFilePath = path.join(backupDir, jsonFilename);
  const fullBackupData = {
    backup_date: new Date().toISOString(),
    week_range: { start: mondayStr, end: sundayStr },
    overall_week_questions: overallWeekTotal,
    students_count: students?.length || 0,
    students,
  };
  fs.writeFileSync(jsonFilePath, JSON.stringify(fullBackupData, null, 2), 'utf-8');
  console.log(`💾 JSON veritabanı yedeği kaydedildi: ${jsonFilePath}`);

  // 5. GitHub Actions Çıktıları
  const summaryMd =
    `# 📋 LGS Soru Takip - Haftalık Otomatik Yedek Raporu\n\n` +
    `- **Dönem:** ${mondayStr} – ${sundayStr}\n` +
    `- **Toplam Öğrenci:** ${students?.length || 0}\n` +
    `- **Bu Hafta Çözülen Toplam Soru:** ${overallWeekTotal}\n` +
    `- **Hedef E-Posta:** ${backupEmail || '(Yönetici tarafından henüz tanımlanmadı)'}\n` +
    `- **Yedek Dosyaları:**\n` +
    `  - \`${excelFilename}\` (Excel Raporu)\n` +
    `  - \`${jsonFilename}\` (JSON Veritabanı Dökümü)\n`;

  fs.writeFileSync(path.join(backupDir, 'summary.md'), summaryMd, 'utf-8');

  // GitHub Environment File outputs
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `backup_email=${backupEmail}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `excel_file=${excelFilePath}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `json_file=${jsonFilePath}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_email=${backupEmail ? 'true' : 'false'}\n`);
  }

  console.log('✨ Haftalık yedekleme işlemi başarıyla tamamlandı!');
}

runBackup().catch((err) => {
  console.error('❌ Yedekleme işlemi sırasında hata:', err);
  process.exit(1);
});
