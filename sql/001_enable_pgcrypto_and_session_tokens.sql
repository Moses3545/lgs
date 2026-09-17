-- ============================================================================
-- SQL Migration 001: pgcrypto Eklentisi & Session Tokens Tablosu
-- ============================================================================
-- Bu betik Supabase SQL Editor üzerinden çalıştırılmalıdır.
-- 1. pgcrypto eklentisini aktifleştirir.
-- 2. Oturum token'larını saklamak için session_tokens tablosunu oluşturur.
-- ============================================================================

-- 1. pgcrypto eklentisini aktif et (bcrypt şifreleme fonksiyonları için)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Session Tokens Tablosu (Beni Hatırla ve Token Tabanlı Oturum Doğrulama)
CREATE TABLE IF NOT EXISTS public.session_tokens (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('teacher', 'student', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- İndeksler (Sorgu performansını artırmak için)
CREATE INDEX IF NOT EXISTS idx_session_tokens_user ON public.session_tokens(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_session_tokens_token ON public.session_tokens(token);

-- Eski / Süresi dolmuş token'ları temizleyen yardımcı fonksiyon
CREATE OR REPLACE FUNCTION public.clean_expired_session_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.session_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
