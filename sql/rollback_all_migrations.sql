-- ============================================================================
-- SQL Rollback: Veritabanı Geri Alma Betiği (Emergency Rollback)
-- ============================================================================
-- Bu betik, yapılan tüm RLS ve kısıtlama değişikliklerini iptal eder.
-- Sadece acil durumlarda Supabase SQL Editor üzerinden çalıştırılmalıdır.
-- ============================================================================

-- 1. RLS Politikalarını Devre Dışı Bırak
ALTER TABLE IF EXISTS public.soru_takip DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.session_tokens DISABLE ROW LEVEL SECURITY;

-- 2. RLS Politikalarını Sil
DROP POLICY IF EXISTS "Admin Full Access Policy" ON public.soru_takip;
DROP POLICY IF EXISTS "Authenticated Users Read Policy" ON public.soru_takip;
DROP POLICY IF EXISTS "Authenticated Users Update Policy" ON public.soru_takip;
DROP POLICY IF EXISTS "Session Tokens Policy" ON public.session_tokens;

-- 3. Eklenen Yardımcı Tabloları İsteğe Bağlı Temizle
-- DROP TABLE IF EXISTS public.login_attempts;
-- DROP TABLE IF EXISTS public.audit_logs;
-- DROP TABLE IF EXISTS public.session_tokens;

RAISE NOTICE 'Veritabanı RLS ve kısıtlamaları acil durum modunda devreden çıkarılmıştır.';
