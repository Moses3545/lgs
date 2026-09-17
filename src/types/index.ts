export type Role = 'admin' | 'teacher' | 'student';

export interface Session {
  role: Role;
  id: string;
  sessionToken?: string;
  secret?: string; // pin for admin, legacy fallback for teacher/student
  name: string;
}

export interface Teacher {
  id: string;
  name: string;
  username: string;
  password?: string;
  student_count?: number;
  created_at?: string;
}

export interface StudentEntry {
  date: string;
  subjects: Record<string, number>;
}

export interface Deneme {
  id: string;
  name: string;
  score: number;
  date: string;
}

export interface Student {
  id: string;
  name: string;
  username: string;
  password?: string;
  teacher_name?: string;
  daily_target?: number | null;
  last_entry_date?: string | null;
  last_saved_at?: string | null;
  created_at?: string;
  weekly_plan?: string | null;
  guidance_note?: string | null;
  entries?: StudentEntry[];
  denemeler?: Deneme[];
  logins?: string[];
}

export interface TeacherActivityData {
  teacher_name: string;
  logins: string[];
  students: Student[];
}
