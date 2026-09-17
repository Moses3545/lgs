-- ============================================================================
-- SQL Migration 002: Mevcut Düz Metin Şifrelerin Bcrypt ile Hash'lenmesi
-- ============================================================================
-- Bu betik Supabase SQL Editor üzerinden çalıştırılmalıdır.
-- Veritabanındaki tüm düz metin (plain-text) öğretmen ve öğrenci şifrelerini
-- pgcrypto crypt() fonksiyonu ile bcrypt hash'ine dönüştürür.
-- IDEMPOTENT: $2a$, $2b$ veya $2y$ ile başlayan önceden hash'lenmiş şifreler ATLANIR.
-- ============================================================================

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
    -- soru_takip tablosundaki tüm satırları tara
    FOR rec IN SELECT id, data FROM public.soru_takip LOOP
        new_teachers := '[]'::jsonb;
        new_students := '[]'::jsonb;
        
        -- 1. Öğretmenler dizisini kontrol et ve şifreleri hash'le
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

        -- 2. Öğrenciler dizisini kontrol et ve şifreleri hash'le
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

        -- Güncellenmiş JSONB verisini veritabanına yaz
        UPDATE public.soru_takip
        SET data = jsonb_set(
            jsonb_set(rec.data, '{teachers}', COALESCE(new_teachers, '[]'::jsonb)),
            '{students}', COALESCE(new_students, '[]'::jsonb)
        )
        WHERE id = rec.id;
    END LOOP;
    
    RAISE NOTICE 'Tüm düz metin şifreler başarıyla Bcrypt ile hash'lenmiştir.';
END $$;
