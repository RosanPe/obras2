import { supabase } from './cliente';
export async function entrar(email: string, password: string) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function cadastrar(email: string, password: string) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}
export async function sair() {
  const { error } = await supabase!.auth.signOut();
  if (error) throw error;
}
export const observarSessao = (callback: (email: string | null, id: string | null) => void) => {
  if (!supabase) { callback(null, null); return () => {}; }
  const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => callback(sessao?.user.email ?? null, sessao?.user.id ?? null));
  return () => data.subscription.unsubscribe();
};
