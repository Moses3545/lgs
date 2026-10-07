-- ============================================================================
-- SQL Migration 009: Rehberlik Uzmanı (Counselor) Rolü & Yönetimi
-- ============================================================================
-- 1. session_tokens tablosunda 'counselor' rolüne izin verilmesi
-- 2. public.counselors tablosunun oluşturulması
-- 3. public.guidance_notes tablosunun esnetilmesi (teacher_id DROP NOT NULL)
-- 4. Admin rehberlik uzmanı yönetimi RPC'leri (add, list, update, delete)
-- 5. Rehberlik uzmanı giriş ve veri çekme RPC'leri (login, get_data)
-- 6. Rehberlik uzmanı rehberlik notu kaydetme RPC'si (counselor_save_guidance_note)
-- ============================================================================

-- 1. session_tokens CHECK kısıtlamasını güncelle
ALTER TABLE public.session_tokens DROP CONSTRAINT IF EXISTS session_tokens_user_type_check;
ALTER TABLE public.session_tokens ADD CONSTRAINT session_tokens_user_type_check 
    CHECK (user_type IN ('teacher', 'student', 'admin', 'counselor'));

-- 2. public.counselors Tablosu
CREATE TABLE IF NOT EXISTS public.counselors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_by_admin_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.counselors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Counselors Self Access" ON public.counselors;
CREATE POLICY "Counselors Self Access" ON public.counselors FOR ALL TO authenticated USING (true);

-- 3. guidance_notes tablosu teacher_id zorunluluğunu kaldır (rehberlik uzmanları için)
ALTER TABLE public.guidance_notes ALTER COLUMN teacher_id DROP NOT NULL;

-- 4. Rehberlik Uzmanı Doğrulama Yardımcı Fonksiyonu
CREATE OR REPLACE FUNCTION public.is_counselor_authorized(
    p_counselor_id TEXT,
    p_session_token TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_token UUID;
BEGIN
    IF p_session_token IS NOT NULL AND p_session_token != '' THEN
        BEGIN
            v_token := p_session_token::uuid;
            IF EXISTS (
                SELECT 1 FROM public.session_tokens 
                WHERE token = v_token AND user_id = p_counselor_id AND user_type = 'counselor' AND expires_at > NOW()
            ) THEN
                RETURN TRUE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RETURN FALSE;
        END;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Admin - Rehberlik Uzmanı Listeleme
CREATE OR REPLACE FUNCTION public.admin_list_counselors(p_admin_id TEXT DEFAULT NULL)
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object('counselors', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id', c.id::text,
            'name', c.name,
            'username', c.username,
            'created_at', c.created_at
        ) ORDER BY c.created_at DESC)
        FROM public.counselors c
    ), '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Admin - Rehberlik Uzmanı Ekleme
CREATE OR REPLACE FUNCTION public.admin_add_counselor(
    p_admin_id TEXT,
    p_name TEXT,
    p_username TEXT,
    p_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    u_clean TEXT := TRIM(LOWER(p_username));
    new_c RECORD;
    hashed_pass TEXT;
    v_admin_uuid UUID := NULL;
BEGIN
    IF EXISTS (SELECT 1 FROM public.counselors WHERE LOWER(username) = u_clean) THEN
        RETURN jsonb_build_object('error', 'username_taken');
    END IF;

    BEGIN
        v_admin_uuid := p_admin_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_admin_uuid := NULL;
    END;

    hashed_pass := crypt(p_password, gen_salt('bf'));

    INSERT INTO public.counselors (name, username, password, created_by_admin_id)
    VALUES (p_name, u_clean, hashed_pass, v_admin_uuid)
    RETURNING id, name, username, created_at INTO new_c;

    BEGIN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            u_clean || '@lgs.internal', hashed_pass, NOW(),
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'counselor', 'original_id', new_c.id::text),
            jsonb_build_object('name', p_name, 'username', u_clean), NOW(), NOW()
        ) ON CONFLICT (email) DO UPDATE
        SET encrypted_password = hashed_pass,
            raw_user_meta_data = jsonb_build_object('name', p_name, 'username', u_clean),
            updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN
    END;

    PERFORM public.log_audit_event(p_admin_id, 'admin', 'add_counselor', jsonb_build_object('username', u_clean, 'name', p_name));

    RETURN jsonb_build_object(
        'success', true,
        'id', new_c.id::text,
        'name', new_c.name,
        'username', new_c.username
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Admin - Rehberlik Uzmanı Güncelleme
CREATE OR REPLACE FUNCTION public.admin_update_counselor(
    p_admin_id TEXT,
    p_counselor_id TEXT,
    p_name TEXT,
    p_new_username TEXT,
    p_new_password TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    u_clean TEXT := TRIM(LOWER(p_new_username));
    c_uuid UUID;
BEGIN
    BEGIN
        c_uuid := p_counselor_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('error', 'invalid_counselor_id');
    END;

    IF EXISTS (SELECT 1 FROM public.counselors WHERE LOWER(username) = u_clean AND id != c_uuid) THEN
        RETURN jsonb_build_object('error', 'username_taken');
    END IF;

    IF p_new_password IS NOT NULL AND p_new_password != '' THEN
        UPDATE public.counselors
        SET name = p_name,
            username = u_clean,
            password = crypt(p_new_password, gen_salt('bf'))
        WHERE id = c_uuid;
    ELSE
        UPDATE public.counselors
        SET name = p_name,
            username = u_clean
        WHERE id = c_uuid;
    END IF;

    PERFORM public.log_audit_event(p_admin_id, 'admin', 'update_counselor', jsonb_build_object('counselor_id', p_counselor_id, 'new_username', u_clean));

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Admin - Rehberlik Uzmanı Silme
CREATE OR REPLACE FUNCTION public.admin_delete_counselor(
    p_admin_id TEXT,
    p_counselor_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    c_uuid UUID;
BEGIN
    BEGIN
        c_uuid := p_counselor_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('error', 'invalid_counselor_id');
    END;

    DELETE FROM public.session_tokens WHERE user_id = p_counselor_id;
    DELETE FROM public.counselors WHERE id = c_uuid;

    PERFORM public.log_audit_event(p_admin_id, 'admin', 'delete_counselor', jsonb_build_object('counselor_id', p_counselor_id));

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Rehberlik Uzmanı Girişi (counselor_login)
CREATE OR REPLACE FUNCTION public.counselor_login(
    p_username TEXT,
    p_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_counselor RECORD;
    v_clean_user TEXT := TRIM(LOWER(p_username));
    v_rl JSONB;
    is_valid BOOLEAN := FALSE;
    new_token UUID;
BEGIN
    v_rl := public.check_login_rate_limit(v_clean_user);
    IF (v_rl->>'allowed')::boolean = FALSE THEN
        RETURN jsonb_build_object(
            'error', COALESCE(v_rl->>'message', 'Çok fazla hatalı giriş yapıldı. Lütfen 15 dakika bekleyin.'),
            'locked', true
        );
    END IF;

    SELECT id, name, username, password INTO v_counselor
    FROM public.counselors
    WHERE LOWER(username) = v_clean_user
    LIMIT 1;

    IF v_counselor.id IS NOT NULL THEN
        IF v_counselor.password ~ '^\$2[aby]\$' THEN
            IF crypt(p_password, v_counselor.password) = v_counselor.password THEN
                is_valid := TRUE;
            END IF;
        ELSE
            IF v_counselor.password = p_password THEN
                is_valid := TRUE;
                UPDATE public.counselors
                SET password = crypt(p_password, gen_salt('bf'))
                WHERE id = v_counselor.id;
            END IF;
        END IF;
    END IF;

    IF is_valid THEN
        PERFORM public.record_successful_login(v_clean_user);

        INSERT INTO public.session_tokens (user_id, user_type)
        VALUES (v_counselor.id::text, 'counselor')
        RETURNING token INTO new_token;

        PERFORM public.log_audit_event(v_counselor.id::text, 'counselor', 'login_success', jsonb_build_object('username', v_clean_user));

        RETURN jsonb_build_object(
            'id', v_counselor.id::text,
            'name', v_counselor.name,
            'username', v_counselor.username,
            'session_token', new_token
        );
    END IF;

    PERFORM public.record_failed_attempt(v_clean_user);
    RETURN jsonb_build_object('error', 'Kullanıcı adı veya şifre hatalı');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Rehberlik Uzmanı Verilerini Getirme (counselor_get_data)
CREATE OR REPLACE FUNCTION public.counselor_get_data(
    p_counselor_id TEXT,
    p_session_token TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_counselor RECORD;
BEGIN
    IF NOT public.is_counselor_authorized(p_counselor_id, p_session_token) THEN
        RETURN jsonb_build_object('error', 'invalid');
    END IF;

    SELECT id, name, username INTO v_counselor
    FROM public.counselors
    WHERE id = p_counselor_id::uuid;

    IF v_counselor.id IS NULL THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    RETURN jsonb_build_object(
        'counselor', jsonb_build_object(
            'id', v_counselor.id::text,
            'name', v_counselor.name,
            'username', v_counselor.username
        ),
        'teachers', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', t.id::text,
                'name', t.name,
                'username', t.username,
                'student_count', (SELECT COUNT(*) FROM public.students s WHERE s.teacher_id = t.id)
            ) ORDER BY t.name)
            FROM public.teachers t
        ), '[]'::jsonb),
        'students', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id::text,
                'name', s.name,
                'username', s.username,
                'teacher_name', t.name,
                'teacher_id', t.id::text,
                'daily_target', s.daily_target,
                'created_at', s.created_at,
                'last_entry_date', (SELECT MAX(e.date) FROM public.entries e WHERE e.student_id = s.id),
                'last_saved_at', (SELECT MAX(e.saved_at) FROM public.entries e WHERE e.student_id = s.id),
                'logins', COALESCE((
                    SELECT jsonb_agg(x.logged_in_at)
                    FROM (SELECT logged_in_at FROM public.student_logins WHERE student_id = s.id ORDER BY logged_in_at DESC LIMIT 50) x
                ), '[]'::jsonb),
                'entries', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object('date', e.date, 'subjects', e.subjects, 'saved_at', e.saved_at) ORDER BY e.date)
                    FROM public.entries e WHERE e.student_id = s.id
                ), '[]'::jsonb),
                'denemeler', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'date', d.date, 'score', d.score) ORDER BY d.date)
                    FROM public.denemeler d WHERE d.student_id = s.id
                ), '[]'::jsonb),
                'weekly_plan', (SELECT content FROM public.weekly_plans wp WHERE wp.student_id = s.id),
                'guidance_note', (SELECT content FROM public.guidance_notes gn WHERE gn.student_id = s.id)
            ) ORDER BY t.name, s.name)
            FROM public.students s
            JOIN public.teachers t ON t.id = s.teacher_id
        ), '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Rehberlik Uzmanı - Rehberlik Notu Kaydetme (counselor_save_guidance_note)
CREATE OR REPLACE FUNCTION public.counselor_save_guidance_note(
    p_counselor_id TEXT,
    p_session_token TEXT,
    p_student_id TEXT,
    p_content TEXT
)
RETURNS JSONB AS $$
DECLARE
    s_uuid UUID;
    t_uuid UUID;
BEGIN
    IF NOT public.is_counselor_authorized(p_counselor_id, p_session_token) THEN
        RETURN jsonb_build_object('error', 'invalid');
    END IF;

    BEGIN
        s_uuid := p_student_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('error', 'invalid_student_id');
    END;

    SELECT teacher_id INTO t_uuid FROM public.students WHERE id = s_uuid;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    INSERT INTO public.guidance_notes (student_id, teacher_id, content, updated_at)
    VALUES (s_uuid, t_uuid, p_content, NOW())
    ON CONFLICT (student_id)
    DO UPDATE SET 
        content = EXCLUDED.content,
        updated_at = NOW();

    PERFORM public.log_audit_event(
        p_counselor_id,
        'counselor',
        'save_guidance_note',
        jsonb_build_object('student_id', p_student_id)
    );

    RETURN jsonb_build_object('success', true, 'guidance_note', p_content);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Varsayılan Rehberlik Uzmanı Hesabı (Örnek)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.counselors WHERE LOWER(username) = 'rehberlik') THEN
        INSERT INTO public.counselors (name, username, password)
        VALUES ('Rehberlik Servisi', 'rehberlik', crypt('Rehberlik2026!', gen_salt('bf')));
    END IF;
END $$;

-- Yetkilendirmeleri yenile
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
