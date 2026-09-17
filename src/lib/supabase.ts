import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://uogcawdqegzuiecrjesn.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Uf1npAPsugEXg594AFybQQ_K4gyZz1X';

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('VITE_SUPABASE_URL ortam değişkeni tanımlı değil. Varsayılan adres kullanılıyor.');
}

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Kullanıcı adını Supabase Auth ile uyumlu sanal e-posta adresine dönüştürür.
 */
export const toVirtualEmail = (username: string): string => {
  const clean = username.trim().toLowerCase();
  return clean.includes('@') ? clean : `${clean}@lgs.internal`;
};

/**
 * Sanal e-postadan kullanıcı adını ayıklar.
 */
export const fromVirtualEmail = (email: string): string => {
  return email.replace('@lgs.internal', '');
};
