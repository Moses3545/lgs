-- ============================================================================
-- SQL Migration 006: Row Level Security (RLS) Politikaları
-- ============================================================================
-- Bu betik Supabase SQL Editor üzerinden çalıştırılmalıdır.
-- 1. public.soru_takip ve public.session_tokens tablolarında RLS aktif eder.
-- 2. JWT auth.jwt()->'app_metadata'->>'role' alanına göre yetkilendirme kuralları yazar.
-- ============================================================================

-- 1. RLS Aktifleştirme
ALTER TABLE public.soru_takip ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_tokens ENABLE ROW LEVEL SECURITY;

-- 2. Mevcut Politikaları Temizle (Gerekiyorsa)
DROP POLICY IF EXISTS "Admin Full Access Policy" ON public.soru_takip;
DROP POLICY IF EXISTS "Authenticated Users Read Policy" ON public.soru_takip;
DROP POLICY IF EXISTS "Authenticated Users Update Policy" ON public.soru_takip;
DROP POLICY IF EXISTS "Session Tokens Policy" ON public.session_tokens;

-- 3. soru_takip Tablosu RLS Politikaları

-- Admin: Tüm verilere tam okuma/yazma erişimi
CREATE POLICY "Admin Full Access Policy"
ON public.soru_takip
FOR ALL
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Öğretmen ve Öğrenciler için okuma erişimi
CREATE POLICY "Authenticated Users Read Policy"
ON public.soru_takip
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('teacher', 'student', 'admin')
);

-- Öğretmen ve Öğrenciler için güncelleme erişimi
CREATE POLICY "Authenticated Users Update Policy"
ON public.soru_takip
FOR UPDATE
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('teacher', 'student', 'admin')
)
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('teacher', 'student', 'admin')
);

-- 4. session_tokens Tablosu RLS Politikaları
CREATE POLICY "Session Tokens Policy"
ON public.session_tokens
FOR ALL
TO authenticated, anon
USING (true)
WITH CHECK (true);
