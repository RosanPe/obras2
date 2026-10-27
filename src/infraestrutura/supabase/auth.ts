import type { AuthChangeEvent } from '@supabase/supabase-js';
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
// Captura somente o tipo do retorno, antes de o SDK remover o fragmento da URL.
export const retornoDeRecuperacao = typeof window !== 'undefined' && new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
export const erroNoLinkDeAcesso = typeof window !== 'undefined' && new URLSearchParams(window.location.hash.slice(1)).has('error');
export const observarSessao = (callback: (email: string | null, id: string | null, evento?: AuthChangeEvent) => void) => {
  if (!supabase) { callback(null, null); return () => {}; }
  const { data } = supabase.auth.onAuthStateChange((evento, sessao) => callback(sessao?.user.email ?? null, sessao?.user.id ?? null, evento));
  return () => data.subscription.unsubscribe();
};

/** Só envia o link; não altera a senha nem a sessão de quem solicitou. */
export async function solicitarRedefinicaoSenha(email: string) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}
export async function atualizarSenha(password: string) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
