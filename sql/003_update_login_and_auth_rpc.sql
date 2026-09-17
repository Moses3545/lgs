-- ============================================================================
-- SQL Migration 003: Giriş (Login) ve Oturum Doğrulama RPC Fonksiyonları
-- ============================================================================
-- Bu betik Supabase SQL Editor üzerinden çalıştırılmalıdır.
-- 1. teacher_login: bcrypt şifre doğrulaması yapar, session_token üretir, şifreyi gizler.
-- 2. student_login: bcrypt şifre doğrulaması yapar, session_token üretir, şifreyi gizler.
-- 3. session_token doğrulama ve geçersiz kılma yardımcı fonksiyonları.
-- ============================================================================

-- Oturum Token'ı Doğrulama Yardımcı Fonksiyonu
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

-- ----------------------------------------------------------------------------
-- 1. Öğretmen Girişi (teacher_login)
-- ----------------------------------------------------------------------------
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
                    
                    -- Bcrypt kontrolü (veya henüz hash'lenmemişse düz metin kontrolü + otomatik hash'leme)
                    IF t_pass ~ '^\$2[aby]\$' THEN
                        IF crypt(p_password, t_pass) = t_pass THEN
                            is_valid := TRUE;
                        END IF;
                    ELSE
                        IF t_pass = p_password THEN
                            is_valid := TRUE;
                            -- Şifreyi anında bcrypt'e dönüştür ve güncelle
                            t_elem := jsonb_set(t_elem, '{password}', to_jsonb(crypt(p_password, gen_salt('bf'))));
                            teachers_arr := jsonb_set(teachers_arr, ARRAY[i::text], t_elem);
                            UPDATE public.soru_takip SET data = jsonb_set(data, '{teachers}', teachers_arr) WHERE id = rec.id;
                        END IF;
                    END IF;
                    
                    IF is_valid THEN
                        -- Yeni session token oluştur
                        INSERT INTO public.session_tokens (user_id, user_type)
                        VALUES (t_id, 'teacher')
                        RETURNING token INTO new_token;

                        -- ŞİFRE İÇERMEYEN güvenli yanıt döndür
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

-- ----------------------------------------------------------------------------
-- 2. Öğrenci Girişi (student_login)
-- ----------------------------------------------------------------------------
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
                    
                    -- Bcrypt kontrolü (veya otomatik hash'leme)
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
-- 3. Token Temizleme (Çıkış İşlemleri İçin)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.logout_session_token(p_token UUID)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM public.session_tokens WHERE token = p_token;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
