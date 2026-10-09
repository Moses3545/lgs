import React, { useState, useEffect } from 'react';
import { Session, Role } from './types';
import { sb } from './lib/supabase';
import { LS_TEACHER, LS_STUDENT, LS_COUNSELOR } from './lib/utils';
import { RoleSelection } from './components/auth/RoleSelection';
import { AdminLogin } from './components/auth/AdminLogin';
import { TeacherLogin } from './components/auth/TeacherLogin';
import { StudentLogin } from './components/auth/StudentLogin';
import { CounselorLogin } from './components/auth/CounselorLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TeacherActivityView } from './components/admin/TeacherActivityView';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';
import { CounselorDashboard } from './components/counselor/CounselorDashboard';

type AuthScreen = 'role' | 'admin-login' | 'teacher-login' | 'student-login' | 'counselor-login';

export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('role');
  const [initialLoading, setInitialLoading] = useState(true);

  // Admin subview state
  const [activeTeacherActivityId, setActiveTeacherActivityId] = useState<string | null>(null);

  // Automatic login check from localStorage
  useEffect(() => {
    let isMounted = true;

    const autoLogin = async () => {
      // 1. Try Counselor remember
      const savedCounselor = localStorage.getItem(LS_COUNSELOR);
      if (savedCounselor) {
        try {
          const parsed = JSON.parse(savedCounselor);
          const { id, username, sessionToken } = parsed;

          if (sessionToken) {
            const { data } = await sb.rpc('counselor_get_data', {
              p_counselor_id: id,
              p_session_token: sessionToken,
            });
            if (data && !data.error && data.counselor) {
              if (isMounted) {
                setSession({
                  role: 'counselor',
                  id,
                  sessionToken,
                  name: data.counselor.name || username,
                });
                setInitialLoading(false);
              }
              return;
            } else {
              localStorage.removeItem(LS_COUNSELOR);
            }
          } else {
            localStorage.removeItem(LS_COUNSELOR);
          }
        } catch {
          localStorage.removeItem(LS_COUNSELOR);
        }
      }

      // 2. Try Teacher remember
      const savedTeacher = localStorage.getItem(LS_TEACHER);
      if (savedTeacher) {
        try {
          const parsed = JSON.parse(savedTeacher);
          const { id, username, sessionToken, secret } = parsed;

          if (sessionToken) {
            const { data } = await sb.rpc('teacher_get_data', {
              p_teacher_id: id,
              p_session_token: sessionToken,
            });
            if (data && !data.error && data.teacher) {
              if (isMounted) {
                setSession({
                  role: 'teacher',
                  id,
                  sessionToken,
                  name: data.teacher.name || username,
                });
                setInitialLoading(false);
              }
              return;
            } else {
              localStorage.removeItem(LS_TEACHER);
            }
          } else if (username && secret) {
            // Legacy migration: authenticate with plaintext password once, upgrade to token
            const { data } = await sb.rpc('teacher_login', {
              p_username: username,
              p_password: secret,
            });
            if (data && !data.error && data.id === id && data.session_token) {
              localStorage.setItem(
                LS_TEACHER,
                JSON.stringify({
                  id: data.id,
                  username,
                  sessionToken: data.session_token,
                  name: data.name || username,
                })
              );
              if (isMounted) {
                setSession({
                  role: 'teacher',
                  id: data.id,
                  sessionToken: data.session_token,
                  name: data.name || username,
                });
                setInitialLoading(false);
              }
              return;
            } else {
              localStorage.removeItem(LS_TEACHER);
            }
          } else {
            localStorage.removeItem(LS_TEACHER);
          }
        } catch {
          localStorage.removeItem(LS_TEACHER);
        }
      }

      // 3. Try Student remember
      const savedStudent = localStorage.getItem(LS_STUDENT);
      if (savedStudent) {
        try {
          const parsed = JSON.parse(savedStudent);
          const { id, sessionToken, secret } = parsed;

          if (sessionToken) {
            const { data } = await sb.rpc('student_get_data', {
              p_student_id: id,
              p_session_token: sessionToken,
            });
            if (data && !data.error && data.id) {
              if (isMounted) {
                setSession({
                  role: 'student',
                  id,
                  sessionToken,
                  name: data.name,
                });
                setInitialLoading(false);
              }
              return;
            } else {
              localStorage.removeItem(LS_STUDENT);
            }
          } else if (id && secret) {
            // Legacy fallback
            const { data } = await sb.rpc('student_get_data', {
              p_student_id: id,
              p_password: secret,
            });
            if (data && !data.error && data.id) {
              if (isMounted) {
                setSession({
                  role: 'student',
                  id,
                  secret,
                  name: data.name,
                });
                setInitialLoading(false);
              }
              return;
            } else {
              localStorage.removeItem(LS_STUDENT);
            }
          } else {
            localStorage.removeItem(LS_STUDENT);
          }
        } catch {
          localStorage.removeItem(LS_STUDENT);
        }
      }

      if (isMounted) {
        setInitialLoading(false);
      }
    };

    // Safety timeout: never block on initialLoading for more than 4 seconds
    const timeout = setTimeout(() => {
      if (isMounted) {
        setInitialLoading(false);
      }
    }, 4000);

    autoLogin().finally(() => {
      clearTimeout(timeout);
    });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, []);

  const handleLogout = async () => {
    if (session?.role === 'student') {
      if (!window.confirm('Çıkış yapmak istediğinize emin misiniz?')) return;
      localStorage.removeItem(LS_STUDENT);
    } else if (session?.role === 'teacher') {
      localStorage.removeItem(LS_TEACHER);
    } else if (session?.role === 'counselor') {
      localStorage.removeItem(LS_COUNSELOR);
    }
    try {
      await sb.auth.signOut();
    } catch {
      // Ignore auth signout error if session was RPC based
    }
    setSession(null);
    setAuthScreen('role');
    setActiveTeacherActivityId(null);
  };

  if (initialLoading) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="font-mono text-xs uppercase tracking-widest text-muted">
          Oturum kontrol ediliyor…
        </div>
        <button
          type="button"
          onClick={() => {
            try { localStorage.clear(); } catch {}
            setInitialLoading(false);
          }}
          className="mt-6 text-xs text-blue-600 hover:underline font-semibold"
        >
          Beklemek istemiyor musunuz? Giriş ekranına geç
        </button>
      </main>
    );
  }

  const containerClass = !session
    ? 'max-w-md mx-auto px-4 py-8 sm:py-10 min-h-screen'
    : session.role === 'teacher' || session.role === 'admin' || session.role === 'counselor'
    ? 'max-w-md sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 py-6 sm:py-10 min-h-screen transition-all'
    : 'max-w-md sm:max-w-xl md:max-w-2xl mx-auto px-4 py-6 sm:py-10 min-h-screen transition-all';

  return (
    <main className={containerClass}>
      {!session && (
        <>
          {authScreen === 'role' && (
            <RoleSelection
              onSelectRole={(role: Role) => {
                if (role === 'admin') setAuthScreen('admin-login');
                else if (role === 'teacher') setAuthScreen('teacher-login');
                else if (role === 'student') setAuthScreen('student-login');
                else if (role === 'counselor') setAuthScreen('counselor-login');
              }}
            />
          )}

          {authScreen === 'admin-login' && (
            <AdminLogin
              onSuccess={(sess) => setSession(sess)}
              onBack={() => setAuthScreen('role')}
            />
          )}

          {authScreen === 'teacher-login' && (
            <TeacherLogin
              onSuccess={(sess) => setSession(sess)}
              onBack={() => setAuthScreen('role')}
            />
          )}

          {authScreen === 'student-login' && (
            <StudentLogin
              onSuccess={(sess) => setSession(sess)}
              onBack={() => setAuthScreen('role')}
            />
          )}

          {authScreen === 'counselor-login' && (
            <CounselorLogin
              onSuccess={(sess) => setSession(sess)}
              onBack={() => setAuthScreen('role')}
            />
          )}
        </>
      )}

      {session && session.role === 'admin' && (
        activeTeacherActivityId ? (
          <TeacherActivityView
            session={session}
            teacherId={activeTeacherActivityId}
            onBack={() => setActiveTeacherActivityId(null)}
          />
        ) : (
          <AdminDashboard
            session={session}
            onLogout={handleLogout}
            onViewTeacherActivity={(teacherId) => setActiveTeacherActivityId(teacherId)}
          />
        )
      )}

      {session && session.role === 'teacher' && (
        <TeacherDashboard session={session} onLogout={handleLogout} />
      )}

      {session && session.role === 'student' && (
        <StudentDashboard session={session} onLogout={handleLogout} />
      )}

      {session && session.role === 'counselor' && (
        <CounselorDashboard session={session} onLogout={handleLogout} />
      )}
    </main>
  );
};

export default App;
