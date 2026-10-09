-- 011_prevent_accidental_mass_deletion.sql
-- Öğretmen silme işlemlerinde veri kaybını (öğrenciler ve soru kayıtları) engelleme

CREATE OR REPLACE FUNCTION public.admin_delete_teacher(p_admin_id text, p_teacher_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    t_uuid UUID;
    s_count INT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admins WHERE id::text = p_admin_id OR username = p_admin_id) THEN
        RETURN jsonb_build_object('error', 'unauthorized', 'message', 'Yalnızca yetkili yönetici bu işlemi yapabilir.');
    END IF;

    BEGIN
        t_uuid := p_teacher_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('error', 'invalid_teacher_id', 'message', 'Geçersiz öğretmen ID.');
    END;

    -- Güvenlik Kilidi: Öğrencileri olan öğretmen doğrudan silinemez, veri kaybı önlenir!
    SELECT COUNT(*) INTO s_count FROM public.students WHERE teacher_id = t_uuid;
    IF s_count > 0 THEN
        RETURN jsonb_build_object(
            'error', 'has_students',
            'message', format('Bu öğretmene bağlı %s öğrenci bulunmaktadır. Öğrencileri ve sorularını kaybetmemek için önce öğrencileri başka bir öğretmene aktarınız.', s_count)
        );
    END IF;

    DELETE FROM public.teacher_logins WHERE teacher_id = t_uuid;
    DELETE FROM public.teachers WHERE id = t_uuid;

    PERFORM public.log_audit_event(p_admin_id, 'admin', 'delete_teacher', jsonb_build_object('teacher_id', p_teacher_id));

    RETURN jsonb_build_object('success', true);
END;
$func$;

CREATE OR REPLACE FUNCTION public.admin_delete_counselor(p_admin_id text, p_counselor_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    c_uuid UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admins WHERE id::text = p_admin_id OR username = p_admin_id) THEN
        RETURN jsonb_build_object('error', 'unauthorized', 'message', 'Yalnızca yetkili yönetici bu işlemi yapabilir.');
    END IF;

    BEGIN
        c_uuid := p_counselor_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('error', 'invalid_counselor_id', 'message', 'Geçersiz rehberlik uzmanı ID.');
    END;

    DELETE FROM public.session_tokens WHERE user_id = p_counselor_id;
    DELETE FROM public.counselors WHERE id = c_uuid;

    PERFORM public.log_audit_event(p_admin_id, 'admin', 'delete_counselor', jsonb_build_object('counselor_id', p_counselor_id));

    RETURN jsonb_build_object('success', true);
END;
$func$;
