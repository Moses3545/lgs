-- ============================================================================
-- LGS SORU TAKİP SİSTEMİ — TÜM MİGRASYONLAR (TEK TIKLA ÇALIŞTIRMA BETİĞİ)
-- ============================================================================
-- Supabase Dashboard -> SQL Editor ekranına bu dosyanın TAMAMINI kopyalayıp
-- "RUN" (Çalıştır) butonuna basmanız veritabanını %100 güncelleyecektir.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. pgcrypto Eklentisi & session_tokens Tablosu
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.session_tokens (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('teacher', 'student', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_session_tokens_user ON public.session_tokens(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_session_tokens_token ON public.session_tokens(token);

CREATE OR REPLACE FUNCTION public.clean_expired_session_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.session_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 2. Mevcut Düz Metin Şifrelerin Bcrypt ile Hash'lenmesi
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    rec RECORD;
    t_elem JSONB;
    s_elem JSONB;
    teachers_arr JSONB;
    students_arr JSONB;
    new_teachers JSONB;
    new_students JSONB;
    cur_pass TEXT;
    hashed_pass TEXT;
    i INT;
    j INT;
BEGIN
    FOR rec IN SELECT id, data FROM public.soru_takip LOOP
        new_teachers := '[]'::jsonb;
        new_students := '[]'::jsonb;
        
        IF rec.data ? 'teachers' AND jsonb_typeof(rec.data->'teachers') = 'array' THEN
            teachers_arr := rec.data->'teachers';
            FOR i IN 0 .. jsonb_array_length(teachers_arr) - 1 LOOP
                t_elem := teachers_arr->i;
                cur_pass := t_elem->>'password';
                
                IF cur_pass IS NOT NULL AND cur_pass !~ '^\$2[aby]\$' THEN
                    hashed_pass := crypt(cur_pass, gen_salt('bf'));
                    t_elem := jsonb_set(t_elem, '{password}', to_jsonb(hashed_pass));
                END IF;
                
                new_teachers := new_teachers || jsonb_build_array(t_elem);
            END LOOP;
        ELSE
            new_teachers := rec.data->'teachers';
        END IF;

        IF rec.data ? 'students' AND jsonb_typeof(rec.data->'students') = 'array' THEN
            students_arr := rec.data->'students';
            FOR j IN 0 .. jsonb_array_length(students_arr) - 1 LOOP
                s_elem := students_arr->j;
                cur_pass := s_elem->>'password';
                
                IF cur_pass IS NOT NULL AND cur_pass !~ '^\$2[aby]\$' THEN
                    hashed_pass := crypt(cur_pass, gen_salt('bf'));
                    s_elem := jsonb_set(s_elem, '{password}', to_jsonb(hashed_pass));
                END IF;
                
                new_students := new_students || jsonb_build_array(s_elem);
            END LOOP;
        ELSE
            new_students := rec.data->'students';
        END IF;

        UPDATE public.soru_takip
        SET data = jsonb_set(
            jsonb_set(rec.data, '{teachers}', COALESCE(new_teachers, '[]'::jsonb)),
            '{students}', COALESCE(new_students, '[]'::jsonb)
        )
        WHERE id = rec.id;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Token Doğrulama & Login RPC Fonksiyonları
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_session_token(
    p_token UUID,
    p_expected_user_type TEXT
)
RETURNS TABLE(valid BOOLEAN, user_id TEXT) AS $$
DECLARE
    v_user_id TEXT;
BEGIN
    SELECT st.user_id INTO v_user_id
    FROM public.session_tokens st
    WHERE st.token = p_token
      AND st.user_type = p_expected_user_type
      AND st.expires_at > NOW();

    IF v_user_id IS NOT NULL THEN
        RETURN QUERY SELECT TRUE, v_user_id;
    ELSE
        RETURN QUERY SELECT FALSE, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.teacher_login(
    p_username TEXT,
    p_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    rec RECORD;
    t_elem JSONB;
    teachers_arr JSONB;
    t_id TEXT;
    t_name TEXT;
    t_pass TEXT;
    i INT;
    is_valid BOOLEAN := FALSE;
    new_token UUID;
BEGIN
    FOR rec IN SELECT id, data FROM public.soru_takip LOOP
        IF rec.data ? 'teachers' AND jsonb_typeof(rec.data->'teachers') = 'array' THEN
            teachers_arr := rec.data->'teachers';
            FOR i IN 0 .. jsonb_array_length(teachers_arr) - 1 LOOP
                t_elem := teachers_arr->i;
                IF LOWER(t_elem->>'username') = LOWER(TRIM(p_username)) THEN
                    t_id := t_elem->>'id';
                    t_name := t_elem->>'name';
                    t_pass := t_elem->>'password';
                    
                    IF t_pass ~ '^\$2[aby]\$' THEN
                        IF crypt(p_password, t_pass) = t_pass THEN
                            is_valid := TRUE;
                        END IF;
                    ELSE
                        IF t_pass = p_password THEN
                            is_valid := TRUE;
                            t_elem := jsonb_set(t_elem, '{password}', to_jsonb(crypt(p_password, gen_salt('bf'))));
                            teachers_arr := jsonb_set(teachers_arr, ARRAY[i::text], t_elem);
                            UPDATE public.soru_takip SET data = jsonb_set(data, '{teachers}', teachers_arr) WHERE id = rec.id;
                        END IF;
                    END IF;
                    
                    IF is_valid THEN
                        INSERT INTO public.session_tokens (user_id, user_type)
                        VALUES (t_id, 'teacher')
                        RETURNING token INTO new_token;

                        RETURN jsonb_build_object(
                            'id', t_id,
                            'name', COALESCE(t_name, p_username),
                            'username', t_elem->>'username',
                            'session_token', new_token
                        );
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('error', 'Kullanıcı adı veya şifre hatalı');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.student_login(
    p_username TEXT,
    p_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    rec RECORD;
    s_elem JSONB;
    students_arr JSONB;
    s_id TEXT;
    s_name TEXT;
    s_pass TEXT;
    j INT;
    is_valid BOOLEAN := FALSE;
    new_token UUID;
BEGIN
    FOR rec IN SELECT id, data FROM public.soru_takip LOOP
        IF rec.data ? 'students' AND jsonb_typeof(rec.data->'students') = 'array' THEN
            students_arr := rec.data->'students';
            FOR j IN 0 .. jsonb_array_length(students_arr) - 1 LOOP
                s_elem := students_arr->j;
                IF LOWER(s_elem->>'username') = LOWER(TRIM(p_username)) THEN
                    s_id := s_elem->>'id';
                    s_name := s_elem->>'name';
                    s_pass := s_elem->>'password';
                    
                    IF s_pass ~ '^\$2[aby]\$' THEN
                        IF crypt(p_password, s_pass) = s_pass THEN
                            is_valid := TRUE;
                        END IF;
                    ELSE
                        IF s_pass = p_password THEN
                            is_valid := TRUE;
                            s_elem := jsonb_set(s_elem, '{password}', to_jsonb(crypt(p_password, gen_salt('bf'))));
                            students_arr := jsonb_set(students_arr, ARRAY[j::text], s_elem);
                            UPDATE public.soru_takip SET data = jsonb_set(data, '{students}', students_arr) WHERE id = rec.id;
                        END IF;
                    END IF;
                    
                    IF is_valid THEN
                        INSERT INTO public.session_tokens (user_id, user_type)
                        VALUES (s_id, 'student')
                        RETURNING token INTO new_token;

                        RETURN jsonb_build_object(
                            'id', s_id,
                            'name', COALESCE(s_name, p_username),
                            'username', s_elem->>'username',
                            'session_token', new_token
                        );
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('error', 'Kullanıcı adı veya şifre hatalı');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. Veri Döndüren RPC Fonksiyonlarında Şifre Gizleme
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_teachers(p_pin TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    rec RECORD;
    t_elem JSONB;
    teachers_arr JSONB;
    sanitized_teachers JSONB := '[]'::jsonb;
    i INT;
BEGIN
    FOR rec IN SELECT data FROM public.soru_takip LOOP
        IF rec.data ? 'teachers' AND jsonb_typeof(rec.data->'teachers') = 'array' THEN
            teachers_arr := rec.data->'teachers';
            FOR i IN 0 .. jsonb_array_length(teachers_arr) - 1 LOOP
                t_elem := teachers_arr->i;
                t_elem := t_elem - 'password';
                sanitized_teachers := sanitized_teachers || jsonb_build_array(t_elem);
            END LOOP;
        END IF;
    END LOOP;

    RETURN sanitized_teachers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 5. Kullanıcıların auth.users ve public.admins Tablosuna Aktarılması
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    rec RECORD;
    t_elem JSONB;
    s_elem JSONB;
    teachers_arr JSONB;
    students_arr JSONB;
    i INT;
    j INT;
    
    u_username TEXT;
    u_password TEXT;
    u_name TEXT;
    t_id TEXT;
    v_email TEXT;
    encrypted_pass TEXT;
BEGIN
    FOR rec IN SELECT id, data FROM public.soru_takip LOOP
        IF rec.data ? 'teachers' AND jsonb_typeof(rec.data->'teachers') = 'array' THEN
            teachers_arr := rec.data->'teachers';
            FOR i IN 0 .. jsonb_array_length(teachers_arr) - 1 LOOP
                t_elem := teachers_arr->i;
                u_username := TRIM(LOWER(t_elem->>'username'));
                u_password := t_elem->>'password';
                u_name := COALESCE(t_elem->>'name', u_username);
                v_email := u_username || '@lgs.internal';

                IF u_username IS NOT NULL AND u_username != '' THEN
                    IF u_password ~ '^\$2[aby]\$' THEN
                        encrypted_pass := u_password;
                    ELSE
                        encrypted_pass := crypt(u_password, gen_salt('bf'));
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
                        INSERT INTO auth.users (
                            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
                        ) VALUES (
                            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email, encrypted_pass, NOW(),
                            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'teacher', 'original_id', t_elem->>'id'),
                            jsonb_build_object('name', u_name, 'username', u_username), NOW(), NOW()
                        );
                    END IF;
                END IF;
            END LOOP;
        END IF;

        IF rec.data ? 'students' AND jsonb_typeof(rec.data->'students') = 'array' THEN
            students_arr := rec.data->'students';
            FOR j IN 0 .. jsonb_array_length(students_arr) - 1 LOOP
                s_elem := students_arr->j;
                u_username := TRIM(LOWER(s_elem->>'username'));
                u_password := s_elem->>'password';
                u_name := COALESCE(s_elem->>'name', u_username);
                t_id := s_elem->>'teacherId';
                v_email := u_username || '@lgs.internal';

                IF u_username IS NOT NULL AND u_username != '' THEN
                    IF u_password ~ '^\$2[aby]\$' THEN
                        encrypted_pass := u_password;
                    ELSE
                        encrypted_pass := crypt(u_password, gen_salt('bf'));
                    END IF;

                    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
                        INSERT INTO auth.users (
                            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
                        ) VALUES (
                            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email, encrypted_pass, NOW(),
                            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'student', 'original_id', s_elem->>'id', 'teacher_id', t_id),
                            jsonb_build_object('name', u_name, 'username', u_username), NOW(), NOW()
                        );
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Rate Limiting & Audit Logging Tabloları
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
        RETURN jsonb_build_object('allowed', FALSE, 'reason', 'locked', 'attempts', v_attempts, 'message', 'Çok fazla hatalı giriş yapıldı. Lütfen 15 dakika bekleyin.');
    ELSE
        RETURN jsonb_build_object('allowed', TRUE, 'attempts', v_attempts, 'remaining', 5 - v_attempts);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_failed_attempt(p_identifier TEXT)
RETURNS void AS $$
BEGIN
    INSERT INTO public.login_attempts (identifier) VALUES (TRIM(LOWER(p_identifier)));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_successful_login(p_identifier TEXT)
RETURNS void AS $$
BEGIN
    DELETE FROM public.login_attempts WHERE LOWER(identifier) = TRIM(LOWER(p_identifier));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Hesabı (auth.users & public.admins)
DO $$
DECLARE
    admin_email TEXT := 'admin@lgs.internal';
    admin_pass TEXT := crypt('Admin.Lgs2026!', gen_salt('bf'));
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', admin_email, admin_pass, NOW(),
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'admin'),
            jsonb_build_object('name', 'Sistem Yöneticisi', 'username', 'admin'), NOW(), NOW()
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    pin TEXT DEFAULT '1234',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.admins WHERE LOWER(username) = 'admin') THEN
        UPDATE public.admins
        SET password = crypt('Admin.Lgs2026!', gen_salt('bf')),
            pin = '1234'
        WHERE LOWER(username) = 'admin';
    ELSE
        INSERT INTO public.admins (username, password, pin)
        VALUES ('admin', crypt('Admin.Lgs2026!', gen_salt('bf')), '1234');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. RLS Aktifleştirme
-- ----------------------------------------------------------------------------
ALTER TABLE public.soru_takip ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Full Access Policy" ON public.soru_takip;
DROP POLICY IF EXISTS "Authenticated Users Read Policy" ON public.soru_takip;
DROP POLICY IF EXISTS "Authenticated Users Update Policy" ON public.soru_takip;
DROP POLICY IF EXISTS "Session Tokens Policy" ON public.session_tokens;
DROP POLICY IF EXISTS "Session Tokens Self Access Policy" ON public.session_tokens;

CREATE POLICY "Session Tokens Self Access Policy" ON public.session_tokens FOR ALL TO authenticated USING (user_id = (auth.jwt() -> 'app_metadata' ->> 'original_id') OR user_id = (auth.jwt() ->> 'sub')) WITH CHECK (user_id = (auth.jwt() -> 'app_metadata' ->> 'original_id') OR user_id = (auth.jwt() ->> 'sub'));

-- ----------------------------------------------------------------------------
-- 8. Veritabanı Çekirdeğinde Rate Limiting ve Güvenlik Sertleştirmeleri
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_teachers(TEXT);
DROP FUNCTION IF EXISTS public.admin_list_teachers(UUID);
DROP FUNCTION IF EXISTS public.admin_list_teachers();
DROP FUNCTION IF EXISTS public.admin_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.teacher_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.student_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_transfer_student(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_add_teacher(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_teacher(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_delete_teacher(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_get_all_students_data(TEXT);
DROP FUNCTION IF EXISTS public.admin_get_teacher_activity(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_list_teachers() RETURNS JSONB AS $$
DECLARE rec RECORD; t_elem JSONB; teachers_arr JSONB; students_arr JSONB; sanitized_teachers JSONB := '[]'::jsonb; s_count INT; t_id TEXT; i INT; j INT;
BEGIN
    FOR rec IN SELECT data FROM public.soru_takip LOOP
        IF rec.data ? 'teachers' AND jsonb_typeof(rec.data->'teachers') = 'array' THEN
            teachers_arr := rec.data->'teachers'; students_arr := COALESCE(rec.data->'students', '[]'::jsonb);
            FOR i IN 0 .. jsonb_array_length(teachers_arr) - 1 LOOP
                t_elem := teachers_arr->i; t_id := t_elem->>'id'; s_count := 0;
                IF jsonb_typeof(students_arr) = 'array' THEN
                    FOR j IN 0 .. jsonb_array_length(students_arr) - 1 LOOP
                        IF (students_arr->j->>'teacherId' = t_id) OR (students_arr->j->>'teacher_id' = t_id) THEN s_count := s_count + 1; END IF;
                    END LOOP;
                END IF;
                t_elem := ((t_elem - 'password') - 'pin') - 'secret';
                t_elem := jsonb_set(t_elem, '{student_count}', to_jsonb(s_count));
                sanitized_teachers := sanitized_teachers || jsonb_build_array(t_elem);
            END LOOP;
        END IF;
    END LOOP;
    RETURN sanitized_teachers;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';

RAISE NOTICE 'Supabase veritabanı tüm faz güncellemeleri ve güvenlik yamaları (008) ile %100 başarıyla güncellenmiştir.';



