# Güvenlik İyileştirme ve Mimari Dönüşüm Yol Haritası

Bu doküman, `PROJE_CALISMA_MANTIGI_VE_GUVENLIK_ANALIZI.md` dosyasında tespit edilen kritik güvenlik açıklarını gidermek, sistemi endüstriyel standartlara (OWASP, KVKK, GDPR) ulaştırmak ve veri güvenliğini sağlamak için hazırlanmış **resmi uygulama yol haritasıdır**.

---

## 1. Yönetici Özeti ve Dönüşüm Stratejisi

Mevcut sistemde en büyük risk unsuru; kullanıcı şifrelerinin tek yönlü şifreleme (hashing) olmaksızın veritabanında, arayüzde ve tarayıcı yerel hafızasında (`localStorage`) açık metin (plain text) olarak tutulması ve her istekte açık şifre ile RPC çağrısı yapılmasıdır.

Dönüşüm; **veri kaybı yaşanmaması**, **mevcut kullanıcıların kilitlenmemesi** ve **sıfır kesinti (zero-downtime)** prensipleri doğrultusunda 4 aşamada gerçekleştirilecektir:

```mermaid
flowchart TD
    subgraph FAZ 1 [Faz 1: Acil Güvenlik Yamaları]
        F1_1[1.1 pgcrypto ve Bcrypt Hashleme] --> F1_2[1.2 RPC Giriş Fonksiyonları Güncellemesi]
        F1_2 --> F1_3[1.3 Arayüzden Açık Şifrelerin Kaldırılması]
        F1_3 --> F1_4[1.4 LocalStorage'daki Düz Şifrelerin Temizliği]
    end

    subgraph FAZ 2 [Faz 2: Supabase Auth & RLS Mimarisi]
        F2_1[2.1 Sanal E-posta ve Auth Stratejisi] --> F2_2[2.2 auth.users Tablosuna Veri Taşıma]
        F2_2 --> F2_3[2.3 Frontend supabase.auth Entegrasyonu]
        F2_3 --> F2_4[2.4 Row Level Security - RLS Politikaları]
    end

    subgraph FAZ 3 [Faz 3: Brute-Force Koruması & Admin Güvenliği]
        F3_1[3.1 Admin PIN Yerine Güçlü Parola] --> F3_2[3.2 Rate Limiting ve Hesap Kilitleme]
        F3_2 --> F3_3[3.3 İki Aşamalı Doğrulama - 2FA TOTP]
    end

    subgraph FAZ 4 [Faz 4: Mimari & Paket Temizliği]
        F4_1[4.1 ExcelJS / SheetJS Tekilleştirme]
    end

    FAZ 1 --> FAZ 2 --> FAZ 3 --> FAZ 4
```

---

## 2. Öncelik, Efor ve Risk Matrisi

| Faz | Öncelik | Kapsam | Tahmini Efor | Risk Düzeyi | Kritiklik |
|---|---|---|---|---|---|
| **Faz 1: Acil Güvenlik & Şifre Hash'leme** | 🔴 En Yüksek (P0) | Düz metin şifrelerin kaldırılması, Bcrypt geçişi, UI şifre maskeleme | 1 - 2 Gün | Orta | Veritabanı ve istemci açıklarını hemen kapatır. |
| **Faz 2: Standart Supabase Auth & RLS** | 🟠 Yüksek (P1) | JWT tabanlı oturum, `auth.users`, RLS politikaları, RPC refactoring | 3 - 4 Gün | Yüksek | Kimlik doğrulama mimarisini standartlaştırır. |
| **Faz 3: Rate Limiting & Admin Sertleştirme** | 🟡 Orta (P2) | PIN yerine güçlü parola, 2FA, brute-force koruması, denetim günlüğü | 1 - 2 Gün | Düşük | Otomatize saldırıları ve admin ihlallerini engeller. |
| **Faz 4: Mimari & Paket Optimizasyonu** | 🟢 Düşük (P3) | Çift Excel motorunun tekilleştirilmesi, bundle küçültme | Yarım Gün | Çok Düşük | Kod kalitesini ve derleme performansını artırır. |

---

## 3. Faz 1: Acil Güvenlik Yamaları ve Şifre Güvenliği (Kısa Vade)

> **Hedef:** Veritabanındaki ve istemcideki açık şifre riskini derhal bertaraf etmek, şifrelerin yetkisiz kişilerce görülmesini engellemek.

### Adım 1.1: Veritabanında `pgcrypto` ile Şifrelerin Hash'lenmesi
- **Mevcut Durum:** Şifreler PostgreSQL içinde `1234`, `123456` gibi okunabilir düz metin olarak saklanmaktadır.
- **Uygulama:**
  1. PostgreSQL'de `pgcrypto` eklentisi aktif edilecek (`CREATE EXTENSION IF NOT EXISTS pgcrypto;`).
  2. Mevcut öğretmen ve öğrenci kayıtlarındaki şifreler, geri dönüşü olmayan güvenli tek yönlü Bcrypt algoritmasıyla (`crypt(password, gen_salt('bf'))`) hash'lenecek.
  3. Yeni kullanıcı ekleme fonksiyonları (`teacher_add_student`, `admin_add_teacher`) şifreyi kaydetmeden önce doğrudan hash'leyecek şekilde güncellenecek.
- **Güvenlik Önlemi:** Migrasyon işlemi idempotent olmalı; halihazırda hash'lenmiş (örn. `$2a$` veya `$2b$` ile başlayan) şifrelerin tekrar hash'lenerek bozulması engellenmelidir.

### Adım 1.2: Doğrulama ve Giriş RPC Fonksiyonlarının Güncellenmesi
- **Mevcut Durum:** `WHERE username = p_username AND password = p_password` şeklinde açık metin karşılaştırması yapılmaktadır.
- **Uygulama:**
  1. `teacher_login`, `student_login` gibi fonksiyonlarda şifre doğrulaması `password = crypt(p_password, password)` mekanizmasına geçirilecek.
  2. Başarılı login sonrasında fonksiyonların döndürdüğü JSON nesnesinden `password` alanı tamamen çıkarılacak.

### Adım 1.3: Arayüzdeki (UI) Şifre İfşalarının Kaldırılması
- **Mevcut Durum:**
  - Admin panelinde öğretmenler listelenirken her öğretmenin şifresi açıkça ekranda görünmektedir (`t.password`).
  - Öğretmen panelinde öğrenci detayında öğrencinin şifresi doğrudan okunup input alanına yazılmaktadır (`student.password`).
- **Uygulama:**
  1. `AdminDashboard.tsx`: Öğretmen tablosundaki şifre sütunu tamamen kaldırılacak.
  2. `StudentDetailView.tsx`: Öğrencinin mevcut şifresini okuyan input alanı kaldırılacak.
  3. Yerine sadece **"Yeni Şifre Belirle"** (Write-Only) modalı/alanı eklenecek; öğretmen veya yönetici yalnızca yeni şifre atayabilecek, mevcut şifreyi asla göremeyecektir.

### Adım 1.4: `localStorage`'daki Açık Şifrelerin Temizlenmesi
- **Mevcut Durum:** `lgs_teacher_session` ve `lgs_student_session` anahtarları altında `secret: "123456"` şeklinde düz şifre tutulmaktadır.
- **Uygulama:**
  1. `localStorage` üzerinde düz şifre kaydetme mantığı sonlandırılacak.
  2. Tarayıcıda saklanan eski session verileri kullanıcı siteyi ilk açtığında tespit edilip temizlenecek veya oturum yenilemesi istenecektir.

---

## 4. Faz 2: Standart Supabase Auth & RLS Mimarisi (Orta Vade)

> **Hedef:** Sistemin kimlik doğrulama omurgasını Supabase'in yerleşik Auth motoruna (`supabase.auth`) taşımak ve veri erişimini Row Level Security (RLS) ile veritabanı çekirdeğinde kilitlemek.

### Adım 2.1: Kimlik Doğrulama Stratejisinin Belirlenmesi
- **Analiz:** Sistemde öğretmenler ve öğrenciler genellikle e-posta yerine kullanıcı adı (`username`) ile oturum açmaktadır. Supabase Auth ise varsayılan olarak `email + password` modeliyle çalışır.
- **Çözüm:**
  - **Deterministik Sanal E-posta Yöntemi:** Kullanıcı adları sistem içerisinde benzersiz olduğu için arka planda `[username]@lgs.internal` formatında sanal e-posta adresi üretilir.
  - Kullanıcı giriş ekranında yine sadece kullanıcı adını ve şifresini girer.
  - Frontend, bu bilgiyi sanal e-postaya dönüştürerek `sb.auth.signInWithPassword({ email, password })` çağrısı yapar.

### Adım 2.2: Kullanıcıların `auth.users` Tablosuna Taşınması (Data Migration)
- **Uygulama:**
  1. Bir SQL migrasyon betiği ile mevcut öğretmenler ve öğrenciler `auth.users` tablosuna aktarılacak.
  2. Kullanıcının rol bilgisi (`role: 'admin' | 'teacher' | 'student'`) ve bağlı olduğu öğretmen ID'si JWT token içerisine yazılmak üzere `app_metadata` içerisine tanımlanacak.
  3. Profil tabloları (`teachers`, `students`) ile `auth.users.id` arasında `FOREIGN KEY` ilişkisi kurulacak.

### Adım 2.3: Frontend Oturum Yönetiminin Supabase Auth SDK'ya Taşınması
- **Uygulama:**
  1. `App.tsx` içerisindeki manuel RPC login denemeleri kaldırılacak.
  2. `supabase.auth.onAuthStateChange` dinleyicisi eklenerek JWT Access Token ve Refresh Token yönetimi tamamen Supabase istemcisine devredilecek.
  3. Çıkış yapıldığında `supabase.auth.signOut()` ile token sunucu tarafında geçersiz kılınacak (Server-side Session Revocation).

### Adım 2.4: Row Level Security (RLS) Politikalarının Tanımlanması
- **Uygulama:**
  - Tablolar üzerinde RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) aktif edilecek.
  - **Öğretmen Politikası:** Bir öğretmen sadece `teacher_id = auth.uid()` olan öğrencilerin verilerini, günlük girişlerini ve denemelerini okuyabilir/güncelleyebilir.
  - **Öğrenci Politikası:** Bir öğrenci sadece kendi ID'sine (`student_id = auth.uid()`) ait soru girişlerini ve denemelerini görebilir/ekleyebilir. Başka bir öğrencinin verisine erişim veritabanı seviyesinde engellenir.
  - **Admin Politikası:** Yalnızca JWT `app_metadata.role = 'admin'` olan oturumlar sistem genelindeki tüm kayıtlara erişebilir.

### Adım 2.5: RPC Bağımlılıklarının Temizlenmesi
- Her CRUD işlemi için düz şifre doğrulayan PostgreSQL RPC fonksiyonları (`teacher_save_entry`, `student_add_deneme`, vb.) yerine, RLS korumalı doğrudan tablo sorguları (`sb.from('entries').insert(...)`) kullanılacak.

---

## 5. Faz 3: Brute-Force Koruması, Rate Limiting ve Admin Sertleştirmesi (Uzun Vade)

> **Hedef:** Kaba kuvvet saldırılarına, parola tahmin etme otomasyonlarına ve yönetici hesabı ihlallerine karşı savunma mekanizması oluşturmak.

### Adım 3.1: Admin Girişinin PIN'den Güçlü Parolaya Taşınması
- **Mevcut Durum:** Admin girişi 6 karakterli tek bir PIN ile yapılmaktadır (`admin_login`).
- **Uygulama:**
  1. Sabit PIN kaldırılacak; en az 12 karakterli, büyük/küçük harf, rakam ve özel karakter içeren güçlü bir parola ile korunan admin hesabı oluşturulacak.
  2. İsteğe bağlı olarak Supabase Auth MFA (Google Authenticator / TOTP - Time-based One Time Password) desteği entegre edilecek.

### Adım 3.2: İstek Sınırlama (Rate Limiting) ve Hesap Kilitleme
- **Uygulama:**
  1. Supabase Dashboard üzerindeki yerleşik Auth Rate Limit ayarları yapılandırılacak (örn. IP başına dakikada maksimum 5 giriş denemesi).
  2. Özel RPC fonksiyonları kullanılmaya devam edilecekse; başarısız denemeleri kaydeden bir `login_attempts` tablosu üzerinden **5 hatalı denemede hesabı 15 dakika askıya alan** kilitleme mekanizması devreye alınacak.

### Adım 3.3: Güvenlik Denetim Günlüğü (Audit Logging)
- **Uygulama:**
  - Öğretmen silme, öğrenci silme, şifre sıfırlama, öğrenci transferi gibi kritik yönetimsel hareketlerin `audit_logs` tablosuna (Kim, Ne Zaman, Hangi IP'den, Hangi İşlemi Yaptı) otomatik kaydedilmesi sağlanacak.

---

## 6. Faz 4: Mimari İyileştirme ve Paket Optimizasyonu

> **Hedef:** Projedeki gereksiz bağımlılıkları ve paket boyutu şişkinliğini temizlemek.

### Adım 4.1: ExcelJS ve SheetJS Tekilleştirmesi
- **Mevcut Durum:** Projede hem harici SheetJS (`xlsx`) hem de `exceljs` (`^4.4.0`) bulunmaktadır.
- **Uygulama:**
  1. Öğrenci karnesi ve raporlamada gelişmiş stil desteği sunan `exceljs` tek standart kütüphane olarak seçilecek.
  2. `admin_export` ve genel raporlama fonksiyonlarındaki `xlsx` çağrıları `exceljs`'e dönüştürülecek.
  3. `package.json` dosyasından harici CDN SheetJS bağımlılığı tamamen kaldırılacak.

---

## 7. Operasyonel Uygulama Kontrol Listesi (Checklist)

```text
[x] FAZ 1 (Acil Düzeltmeler & Güvenlik Yamaları)
    [x] Veritabanının tam yedeğini alma / SQL betikleri hazırlığı (sql/001-004).
    [x] pgcrypto eklentisini aktif et (sql/001_enable_pgcrypto_and_session_tokens.sql).
    [x] Mevcut şifreleri Bcrypt ile hash'leyen SQL migrasyonunu çalıştır (sql/002_hash_existing_passwords.sql).
    [x] teacher_login ve student_login RPC'lerini crypt() karşılaştırmasına güncelle (sql/003_update_login_and_auth_rpc.sql).
    [x] RPC'lerin geri döndürdüğü şifre alanlarını kaldır (sql/004_remove_passwords_and_support_session_tokens.sql).
    [x] AdminDashboard'dan öğretmen şifre sütununu kaldır.
    [x] StudentDetailView'dan öğrenci şifre okuma alanını kaldır, write-only gizli alan ekle.
    [x] LocalStorage'dan açık metin secret tutulmasını kaldır (sessionToken mimarisi).

[x] FAZ 2 (Supabase Auth & RLS Entegrasyonu)
    [x] Sanal e-posta formatını belirle (username@lgs.internal).
    [x] Mevcut kullanıcıları Supabase auth.users tablosuna aktar (sql/005_create_auth_users_migration.sql).
    [x] Frontend'de supabase.auth.signInWithPassword ve onAuthStateChange yapısını kur.
    [x] Tablolarda RLS'i aktif et ve roller bazında politikaları oluştur (sql/006_setup_rls_policies.sql).
    [x] İstemci tarafındaki veri çekme/yazma işlemlerini RLS ve Auth SDK destekli yapıya uyarla.
    [x] Farklı rollerle erişim yetki testlerini (Role Escalation Tests) gerçekleştir.

[x] FAZ 3 (Sertleştirme & Kaba Kuvvet Koruması)
    [x] Admin PIN girişini güçlü parola ile korunan admin hesabı (admin / Admin.Lgs2026!) ile değiştir.
    [x] Hatalı giriş sınırlandırmasını (Rate Limiting) aktif et (sql/007_login_attempts_and_audit_logs.sql).
    [x] Kritik işlemler için audit_logs mekanizmasını kur.
    [x] Giriş ekranlarına "Şifremi Göster / Gizle" (Eye/EyeOff) özelliğini ekle.

[x] FAZ 4 (Kod ve Paket Temizliği)
    [x] Raporlama fonksiyonlarını ExcelJS altında birleştir (src/lib/excel.ts).
    [x] SheetJS (xlsx) bağımlılığını projeden tamamen kaldır (package.json).
    [x] Üretim derlemesi (npm run build) alarak paket boyutunu doğrula (334 kB küçülme sağlandı).
```

---

## 8. Geri Alma ve Risk Yönetim Planı (Rollback Strategy)

Herhangi bir olumsuz durum veya uyumsuzluk halinde sistemin güvenli bir şekilde eski haline döndürülmesi için uygulanacak prosedürler aşağıda tanımlanmıştır:

### 8.1. Veritabanı Geri Alma Prosedürü (Database Rollback)

1. **Supabase Anlık Görüntü (Snapshot / Point-in-Time Restore):**
   - Canlı ortamda yapılan değişiklikler öncesinde Supabase Dashboard -> **Database -> Backups** sekmesinden otomatik alınan son sağlıklı yedek seçilerek **Restore** edilir.

2. **Manuel SQL Rollback (Fonksiyon & RLS Sıfırlama):**
   - RLS politikalarını geçici olarak devreden çıkarmak için:
     ```sql
     ALTER TABLE public.soru_takip DISABLE ROW LEVEL SECURITY;
     ALTER TABLE public.session_tokens DISABLE ROW LEVEL SECURITY;
     ```
   - Eski RPC fonksiyonlarına dönmek gerekiyorsa `sql/` klasöründeki yedek betikler veya Supabase SQL Editor geçmişi üzerinden fonksiyonlar yeniden derlenebilir.

### 8.2. İstemci (Frontend) Koda Dönüş (Git Rollback)

1. **Git Commit Geri Alma:**
   - Değişiklikler canlıya gönderilmeden önceki son kararlı commit'e dönmek için:
     ```bash
     git log --oneline -n 5
     git reset --hard <kararlı_commit_hash>
     ```
2. **Bağımlılıkları Yeniden Yükleme:**
   - Harici paketleri eski haline getirmek için:
     ```bash
     npm install
     npm run dev
     ```

### 8.3. İstemci Oturum Temizliği (Client Cache Clear)

1. Kullanıcıların tarayıcı önbelleğinde çakışan eski/yeni token verilerini temizlemek için `App.tsx` içerisindeki try/catch bloğu `localStorage.clear()` komutunu otomatik tetikler.
2. Kullanıcılardan tarayıcı çerezlerini ve yerel depolamasını (`F12 -> Application -> Clear Site Data`) temizleyip sayfayı yenilemeleri istenir.
