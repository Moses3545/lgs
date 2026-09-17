-- ============================================================================
-- SQL Migration 005: Kullanıcıların auth.users Tablosuna Taşınması
-- ============================================================================
-- Bu betik Supabase SQL Editor üzerinden çalıştırılmalıdır.
-- 1. soru_takip JSONB tablosundaki öğretmen ve öğrencileri Supabase Auth tablosuna (auth.users) aktarır.
-- 2. Kullanıcı adlarını sanal e-postaya ([username]@lgs.internal) dönüştürür.
-- 3. JWT rol bilgisini (app_metadata->>'role') tanımlar.
-- IDEMPOTENT: Var olan kullanıcılar güncellenir veya atlanır (ON CONFLICT / NOT EXISTS).
-- ============================================================================

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
    u_id UUID;
    t_id TEXT;
    v_email TEXT;
    encrypted_pass TEXT;
BEGIN
    FOR rec IN SELECT id, data FROM public.soru_takip LOOP
        -- 1. Öğretmenleri auth.users tablosuna aktar
        IF rec.data ? 'teachers' AND jsonb_typeof(rec.data->'teachers') = 'array' THEN
            teachers_arr := rec.data->'teachers';
            FOR i IN 0 .. jsonb_array_length(teachers_arr) - 1 LOOP
                t_elem := teachers_arr->i;
                u_username := TRIM(LOWER(t_elem->>'username'));
                u_password := t_elem->>'password';
                u_name := COALESCE(t_elem->>'name', u_username);
                v_email := u_username || '@lgs.internal';

                IF u_username IS NOT NULL AND u_username != '' THEN
                    -- Şifre bcrypt hash'li değilse hash'le
                    IF u_password ~ '^\$2[aby]\$' THEN
                        encrypted_pass := u_password;
                    ELSE
                        encrypted_pass := crypt(u_password, gen_salt('bf'));
                    END IF;

                    -- auth.users kaydı oluştur veya güncelle
                    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
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
                            v_email,
                            encrypted_pass,
                            NOW(),
                            jsonb_build_object(
                                'provider', 'email',
                                'providers', jsonb_build_array('email'),
                                'role', 'teacher',
                                'original_id', t_elem->>'id'
                            ),
                            jsonb_build_object(
                                'name', u_name,
                                'username', u_username
                            ),
                            NOW(),
                            NOW()
                        );
                    ELSE
                        UPDATE auth.users
                        SET encrypted_password = encrypted_pass,
                            raw_app_meta_data = jsonb_build_object(
                                'provider', 'email',
                                'providers', jsonb_build_array('email'),
                                'role', 'teacher',
                                'original_id', t_elem->>'id'
                            ),
                            raw_user_meta_data = jsonb_build_object(
                                'name', u_name,
                                'username', u_username
                            ),
                            updated_at = NOW()
                        WHERE email = v_email;
                    END IF;
                END IF;
            END LOOP;
        END IF;

        -- 2. Öğrencileri auth.users tablosuna aktar
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
                            v_email,
                            encrypted_pass,
                            NOW(),
                            jsonb_build_object(
                                'provider', 'email',
                                'providers', jsonb_build_array('email'),
                                'role', 'student',
                                'original_id', s_elem->>'id',
                                'teacher_id', t_id
                            ),
                            jsonb_build_object(
                                'name', u_name,
                                'username', u_username
                            ),
                            NOW(),
                            NOW()
                        );
                    ELSE
                        UPDATE auth.users
                        SET encrypted_password = encrypted_pass,
                            raw_app_meta_data = jsonb_build_object(
                                'provider', 'email',
                                'providers', jsonb_build_array('email'),
                                'role', 'student',
                                'original_id', s_elem->>'id',
                                'teacher_id', t_id
                            ),
                            raw_user_meta_data = jsonb_build_object(
                                'name', u_name,
                                'username', u_username
                            ),
                            updated_at = NOW()
                        WHERE email = v_email;
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    RAISE NOTICE 'Öğretmen ve öğrenciler başarıyla auth.users tablosuna taşınmıştır.';
END $$;
