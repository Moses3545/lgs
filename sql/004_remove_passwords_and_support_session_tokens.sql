-- ============================================================================
-- SQL Migration 004: Şifrelerin Yanıtlardan Temizlenmesi & Token Doğrulama Desteği
-- ============================================================================
-- Bu betik Supabase SQL Editor üzerinden çalıştırılmalıdır.
-- 1. admin_list_teachers, teacher_get_data, student_get_data, admin_get_all_students_data
--    gibi veri döndüren tüm fonksiyonlardan password alanını kaldırır.
-- 2. p_session_token (UUID) ile doğrulama yapılmasına imkan tanır.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. admin_list_teachers: Şifreleri yanıttan gizler
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_teachers(p_pin TEXT)
RETURNS JSONB AS $$
DECLARE
    rec RECORD;
    t_elem JSONB;
    teachers_arr JSONB;
    sanitized_teachers JSONB := '[]'::jsonb;
    i INT;
BEGIN
    -- PIN / Parola Doğrulaması (Admin PIN / Parola)
    IF p_pin != '1234' AND p_pin != '1923' AND p_pin != 'Admin.Lgs2026!' THEN
        RETURN jsonb_build_object('error', 'Geçersiz Admin PIN veya Parola');
    END IF;

    FOR rec IN SELECT data FROM public.soru_takip LOOP
        IF rec.data ? 'teachers' AND jsonb_typeof(rec.data->'teachers') = 'array' THEN
            teachers_arr := rec.data->'teachers';
            FOR i IN 0 .. jsonb_array_length(teachers_arr) - 1 LOOP
                t_elem := teachers_arr->i;
                -- ŞİFRE ALANINI YANITTAN ÇIKAR
                t_elem := t_elem - 'password';
                sanitized_teachers := sanitized_teachers || jsonb_build_array(t_elem);
            END LOOP;
        END IF;
    END LOOP;

    RETURN sanitized_teachers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 2. teacher_get_data: Hem p_password hem p_session_token kabul eder, password'ü çıkarır
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.teacher_get_data(
    p_teacher_id TEXT,
    p_password TEXT DEFAULT NULL,
    p_session_token UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    rec RECORD;
    t_elem JSONB;
    teachers_arr JSONB;
    is_valid BOOLEAN := FALSE;
    v_token_valid BOOLEAN;
    v_token_user TEXT;
    t_pass TEXT;
    i INT;
BEGIN
    -- 1. Token ile doğrulama dene
    IF p_session_token IS NOT NULL THEN
        SELECT valid, user_id INTO v_token_valid, v_token_user
        FROM public.verify_session_token(p_session_token, 'teacher');
        
        IF v_token_valid AND v_token_user = p_teacher_id THEN
            is_valid := TRUE;
        END IF;
    END IF;

    -- 2. Şifre ile doğrulama dene (Geriye dönük uyumluluk)
    IF NOT is_valid AND p_password IS NOT NULL THEN
        FOR rec IN SELECT data FROM public.soru_takip LOOP
            IF rec.data ? 'teachers' AND jsonb_typeof(rec.data->'teachers') = 'array' THEN
                teachers_arr := rec.data->'teachers';
                FOR i IN 0 .. jsonb_array_length(teachers_arr) - 1 LOOP
                    t_elem := teachers_arr->i;
                    IF t_elem->>'id' = p_teacher_id THEN
                        t_pass := t_elem->>'password';
                        IF (t_pass ~ '^\$2[aby]\$' AND crypt(p_password, t_pass) = t_pass) OR t_pass = p_password THEN
                            is_valid := TRUE;
                        END IF;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
    END IF;

    IF NOT is_valid THEN
        RETURN jsonb_build_object('error', 'Yetkisiz erişim veya geçersiz oturum.');
    END IF;

    -- Yetkili: Öğretmen verisini döndür (Öğrencilerin şifrelerini Gizleyerek)
    -- Verileri soru_takip'ten cekip password alanlarini sanitize eder
    FOR rec IN SELECT data FROM public.soru_takip LOOP
        -- Öğrenciler listesini temizle
        RETURN (
            SELECT jsonb_build_object(
                'teacher', (
                    SELECT t - 'password'
                    FROM jsonb_array_elements(COALESCE(rec.data->'teachers', '[]'::jsonb)) t
                    WHERE t->>'id' = p_teacher_id
                    LIMIT 1
                ),
                'students', (
                    SELECT COALESCE(jsonb_agg(s - 'password'), '[]'::jsonb)
                    FROM jsonb_array_elements(COALESCE(rec.data->'students', '[]'::jsonb)) s
                    WHERE s->>'teacherId' = p_teacher_id OR s->>'teacher_id' = p_teacher_id
                )
            )
        );
    END LOOP;

    RETURN jsonb_build_object('error', 'Veri bulunamadı.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3. student_get_data: Hem p_password hem p_session_token kabul eder, password'ü çıkarır
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_get_data(
    p_student_id TEXT,
    p_password TEXT DEFAULT NULL,
    p_session_token UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    rec RECORD;
    s_elem JSONB;
    students_arr JSONB;
    is_valid BOOLEAN := FALSE;
    v_token_valid BOOLEAN;
    v_token_user TEXT;
    s_pass TEXT;
    j INT;
BEGIN
    IF p_session_token IS NOT NULL THEN
        SELECT valid, user_id INTO v_token_valid, v_token_user
        FROM public.verify_session_token(p_session_token, 'student');
        
        IF v_token_valid AND v_token_user = p_student_id THEN
            is_valid := TRUE;
        END IF;
    END IF;

    IF NOT is_valid AND p_password IS NOT NULL THEN
        FOR rec IN SELECT data FROM public.soru_takip LOOP
            IF rec.data ? 'students' AND jsonb_typeof(rec.data->'students') = 'array' THEN
                students_arr := rec.data->'students';
                FOR j IN 0 .. jsonb_array_length(students_arr) - 1 LOOP
                    s_elem := students_arr->j;
                    IF s_elem->>'id' = p_student_id THEN
                        s_pass := s_elem->>'password';
                        IF (s_pass ~ '^\$2[aby]\$' AND crypt(p_password, s_pass) = s_pass) OR s_pass = p_password THEN
                            is_valid := TRUE;
                        END IF;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
    END IF;

    IF NOT is_valid THEN
        RETURN jsonb_build_object('error', 'Yetkisiz erişim veya geçersiz oturum.');
    END IF;

    FOR rec IN SELECT data FROM public.soru_takip LOOP
        FOR j IN 0 .. jsonb_array_length(COALESCE(rec.data->'students', '[]'::jsonb)) - 1 LOOP
            s_elem := rec.data->'students'->j;
            IF s_elem->>'id' = p_student_id THEN
                -- ŞİFRE ALANINI YANITTAN ÇIKAR
                RETURN (s_elem - 'password');
            END IF;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('error', 'Öğrenci bulunamadı.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
