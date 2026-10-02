import { Student, StudentEntry } from '../types';

/**
 * 28 Ekim - 4 Kasım ve takip eden haftaları içeren örnek öğrenci soru girişleri
 */
export function generateSampleEntries(): StudentEntry[] {
  return [
    // --- 14 Ekim - 20 Ekim 2024 Haftası (Toplam: 540) ---
    { date: '2024-10-14', subjects: { 'Türkçe': 25, 'Paragraf': 20, 'Matematik': 30, 'Fen Bilimleri': 20 } },
    { date: '2024-10-15', subjects: { 'Türkçe': 20, 'Paragraf': 15, 'Matematik': 25, 'T.C. İnkılap Tarihi': 15, 'Din Kültürü': 15 } },
    { date: '2024-10-16', subjects: { 'Fen Bilimleri': 35, 'Paragraf': 20, 'İngilizce': 25, 'Matematik': 20 } },
    { date: '2024-10-17', subjects: { 'Türkçe': 30, 'Paragraf': 20, 'Matematik': 30, 'Fen Bilimleri': 25 } },
    { date: '2024-10-18', subjects: { 'T.C. İnkılap Tarihi': 20, 'Din Kültürü': 20, 'İngilizce': 25 } },
    { date: '2024-10-19', subjects: { 'Matematik': 40, 'Fen Bilimleri': 35, 'Türkçe': 30, 'Paragraf': 25 } },
    { date: '2024-10-20', subjects: { 'Türkçe': 25, 'Matematik': 35, 'Fen Bilimleri': 20 } },

    // --- 21 Ekim - 27 Ekim 2024 Haftası (Toplam: 585) ---
    { date: '2024-10-21', subjects: { 'Türkçe': 30, 'Paragraf': 20, 'Matematik': 35, 'Fen Bilimleri': 25 } },
    { date: '2024-10-22', subjects: { 'Matematik': 40, 'Paragraf': 15, 'İngilizce': 20, 'Din Kültürü': 15 } },
    { date: '2024-10-23', subjects: { 'Fen Bilimleri': 30, 'T.C. İnkılap Tarihi': 25, 'Türkçe': 25, 'Paragraf': 20 } },
    { date: '2024-10-24', subjects: { 'Matematik': 35, 'Fen Bilimleri': 30, 'Türkçe': 25 } },
    { date: '2024-10-25', subjects: { 'Türkçe': 25, 'Din Kültürü': 20, 'İngilizce': 25 } },
    { date: '2024-10-26', subjects: { 'Matematik': 45, 'Fen Bilimleri': 40, 'Türkçe': 30, 'Paragraf': 20 } },
    { date: '2024-10-27', subjects: { 'T.C. İnkılap Tarihi': 25, 'Matematik': 30, 'Fen Bilimleri': 30 } },

    // --- 28 EKİM - 3/4 KASIM 2024 HAFTASI (KULLANICININ ÖRNEĞİ - Toplam: 635 Soru) ---
    // 28 Ekim Pazartesi
    { date: '2024-10-28', subjects: { 'Türkçe': 30, 'Paragraf': 20, 'Matematik': 35, 'Fen Bilimleri': 30 } }, // 115 soru
    // 29 Ekim Salı (Cumhuriyet Bayramı)
    { date: '2024-10-29', subjects: { 'Türkçe': 35, 'Paragraf': 25, 'Matematik': 40, 'Fen Bilimleri': 35 } }, // 135 soru
    // 30 Ekim Çarşamba
    { date: '2024-10-30', subjects: { 'Türkçe': 25, 'Paragraf': 20, 'Matematik': 30, 'Din Kültürü': 15, 'T.C. İnkılap Tarihi': 15 } }, // 105 soru
    // 31 Ekim Perşembe
    { date: '2024-10-31', subjects: { 'Matematik': 40, 'Fen Bilimleri': 30, 'İngilizce': 20, 'Paragraf': 20 } }, // 110 soru
    // 1 Kasım Cuma
    { date: '2024-11-01', subjects: { 'Türkçe': 25, 'Fen Bilimleri': 30, 'İngilizce': 25 } }, // 80 soru
    // 2 Kasım Cumartesi
    { date: '2024-11-02', subjects: { 'Matematik': 45, 'Fen Bilimleri': 35, 'Din Kültürü': 15 } }, // 95 soru
    // 3 Kasım Pazar
    { date: '2024-11-03', subjects: { 'Türkçe': 30, 'Matematik': 30, 'T.C. İnkılap Tarihi': 20 } }, // 80 soru

    // --- 4 Kasım - 10 Kasım 2024 Haftası (Toplam: 610) ---
    { date: '2024-11-04', subjects: { 'Türkçe': 30, 'Matematik': 35, 'Fen Bilimleri': 25 } }, // 90 soru
    { date: '2024-11-05', subjects: { 'Matematik': 40, 'T.C. İnkılap Tarihi': 20, 'İngilizce': 20 } },
    { date: '2024-11-06', subjects: { 'Fen Bilimleri': 35, 'Türkçe': 25, 'Din Kültürü': 20 } },
    { date: '2024-11-07', subjects: { 'Matematik': 40, 'Fen Bilimleri': 30, 'Türkçe': 25 } },
    { date: '2024-11-08', subjects: { 'İngilizce': 25, 'T.C. İnkılap Tarihi': 25, 'Din Kültürü': 20 } },
    { date: '2024-11-09', subjects: { 'Matematik': 50, 'Fen Bilimleri': 40, 'Türkçe': 30 } },
    { date: '2024-11-10', subjects: { 'Türkçe': 30, 'Matematik': 35, 'Fen Bilimleri': 25 } },

    // --- 11 Kasım - 17 Kasım 2024 Haftası (Toplam: 640) ---
    { date: '2024-11-11', subjects: { 'Türkçe': 35, 'Matematik': 40, 'Fen Bilimleri': 30 } },
    { date: '2024-11-12', subjects: { 'Matematik': 45, 'Fen Bilimleri': 35, 'İngilizce': 20 } },
    { date: '2024-11-13', subjects: { 'Türkçe': 30, 'T.C. İnkılap Tarihi': 25, 'Din Kültürü': 20 } },
    { date: '2024-11-14', subjects: { 'Matematik': 40, 'Fen Bilimleri': 35, 'Türkçe': 30 } },
    { date: '2024-11-15', subjects: { 'İngilizce': 30, 'Din Kültürü': 25, 'T.C. İnkılap Tarihi': 20 } },
    { date: '2024-11-16', subjects: { 'Matematik': 50, 'Fen Bilimleri': 45, 'Türkçe': 35 } },
    { date: '2024-11-17', subjects: { 'Türkçe': 35, 'Matematik': 40, 'Fen Bilimleri': 30 } },

    // --- 18 Kasım - 24 Kasım 2024 Haftası (Toplam: 670) ---
    { date: '2024-11-18', subjects: { 'Türkçe': 40, 'Matematik': 45, 'Fen Bilimleri': 30 } },
    { date: '2024-11-19', subjects: { 'Matematik': 45, 'Fen Bilimleri': 35, 'İngilizce': 25 } },
    { date: '2024-11-20', subjects: { 'Türkçe': 35, 'T.C. İnkılap Tarihi': 25, 'Din Kültürü': 25 } },
    { date: '2024-11-21', subjects: { 'Matematik': 45, 'Fen Bilimleri': 40, 'Türkçe': 30 } },
    { date: '2024-11-22', subjects: { 'İngilizce': 30, 'Din Kültürü': 25, 'T.C. İnkılap Tarihi': 25 } },
    { date: '2024-11-23', subjects: { 'Matematik': 55, 'Fen Bilimleri': 45, 'Türkçe': 40 } },
    { date: '2024-11-24', subjects: { 'Türkçe': 35, 'Matematik': 40, 'Fen Bilimleri': 35 } },
  ];
}

export function createSampleStudent(): Student {
  const entries = generateSampleEntries();
  return {
    id: 'sample-student-1',
    name: 'Deniz Kaya (Örnek Öğrenci)',
    username: 'denizkaya',
    daily_target: 90,
    last_entry_date: '2024-11-24',
    last_saved_at: '2024-11-24T18:45:00.000Z',
    created_at: '2024-10-01T09:00:00.000Z',
    weekly_plan: 'Haftada en az 600 soru hedefi. Özellikle Matematik yeni nesil sorular ve Fen Bilimleri deney sorularına ağırlık verilmeli.',
    guidance_note: 'Düzenli çalışma disiplini çok iyi, 28 Ekim haftasında hedefi başarıyla aştı.',
    entries,
    denemeler: [
      { id: 'd1', name: '1. Kurumsal Deneme', score: 445.5, date: '2024-10-19' },
      { id: 'd2', name: '2. Genel Değerlendirme', score: 462.0, date: '2024-11-02' },
      { id: 'd3', name: '3. LGS Prova Sınavı', score: 478.25, date: '2024-11-16' },
    ],
  };
}
