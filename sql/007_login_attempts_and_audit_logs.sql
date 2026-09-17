-- ============================================================================
-- SQL Migration 007: Rate Limiting, Audit Logging & Admin Hardening
-- ============================================================================
-- Bu betik Supabase SQL Editor üzerinden çalıştırılmalıdır.
-- 1. login_attempts tablosu ve 5 hatalı denemede 15dk kilitleme fonksiyonu.
-- 2. audit_logs tablosu ve denetim günlüğü kaydetme fonksiyonu.
-- 3. Admin hesabı için auth.users ve public.admins tablolarına ekleme.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Login Attempts (Başarısız Giriş Denemeleri & Rate Limiting)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON public.login_attempts(identifier, attempted_at);

CREATE OR REPLACE FUNCTION public.check_login_rate_limit(p_identifier TEXT)
RETURNS JSONB AS $$
DECLARE
    v_attempts INT;
    v_clean_ident TEXT := TRIM(LOWER(p_identifier));
BEGIN
    SELECT COUNT(*) INTO v_attempts
    FROM public.login_attempts
    WHERE LOWER(identifier) = v_clean_ident
      AND attempted_at > (NOW() - INTERVAL '15 minutes');

    IF v_attempts >= 5 THEN
        RETURN jsonb_build_object(
            'allowed', FALSE,
            'reason', 'locked',
            'attempts', v_attempts,
            'message', 'Çok fazla hatalı giriş yapıldı. Lütfen 15 dakika bekleyin.'
        );
    ELSE
        RETURN jsonb_build_object(
            'allowed', TRUE,
            'attempts', v_attempts,
            'remaining', 5 - v_attempts
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_failed_attempt(p_identifier TEXT)
RETURNS void AS $$
BEGIN
    INSERT INTO public.login_attempts (identifier)
    VALUES (TRIM(LOWER(p_identifier)));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_successful_login(p_identifier TEXT)
RETURNS void AS $$
BEGIN
    DELETE FROM public.login_attempts
    WHERE LOWER(identifier) = TRIM(LOWER(p_identifier));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 2. Audit Logs (Güvenlik Denetim Günlüğü)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at);

CREATE OR REPLACE FUNCTION public.log_audit_event(
    p_user_id TEXT,
    p_user_role TEXT,
    p_action TEXT,
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, user_role, action, details)
    VALUES (p_user_id, p_user_role, p_action, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3. Admin Sertleştirmesi (auth.users & public.admins)
-- ----------------------------------------------------------------------------
-- 3.1 auth.users tablosuna admin ekle
DO $$
DECLARE
    admin_email TEXT := 'admin@lgs.internal';
    admin_pass TEXT := crypt('Admin.Lgs2026!', gen_salt('bf'));
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            admin_email,
            admin_pass,
            NOW(),
            jsonb_build_object(
                'provider', 'email',
                'providers', jsonb_build_array('email'),
                'role', 'admin'
            ),
            jsonb_build_object(
                'name', 'Sistem Yöneticisi',
                'username', 'admin'
            ),
            NOW(),
            NOW()
        );
    ELSE
        UPDATE auth.users
        SET encrypted_password = admin_pass,
            raw_app_meta_data = jsonb_build_object(
                'provider', 'email',
                'providers', jsonb_build_array('email'),
                'role', 'admin'
            ),
            updated_at = NOW()
        WHERE email = admin_email;
    END IF;
END $$;

-- 3.2 public.admins tablosu varsa veya oluşturulursa ekle
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    pin TEXT DEFAULT '1234',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.admins (username, password, pin)
VALUES ('admin', crypt('Admin.Lgs2026!', gen_salt('bf')), '1234')
ON CONFLICT (username) DO UPDATE
SET password = crypt('Admin.Lgs2026!', gen_salt('bf')), pin = '1234';
