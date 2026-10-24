import { z } from 'zod';
import { supabase } from '../cliente';
export async function podeEditarCatalogos() {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('pode_editar_catalogos');
  if (error) throw error;
  return z.boolean().parse(data);
}
export async function ehSuper() {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('eh_super');
  if (error) throw error;
  return z.boolean().parse(data);
}
const usuarioSchema = z.object({ user_id: z.string().uuid(), email: z.string().nullable(), criado_em: z.string(), ultimo_acesso: z.string().nullable(), pode_editar: z.boolean(), super: z.boolean() });
export type UsuarioAdministrativo = z.infer<typeof usuarioSchema>;
export async function listarUsuarios() {
  const { data, error } = await supabase!.rpc('admin_listar_usuarios');
  if (error) throw error;
  return z.array(usuarioSchema).parse(data);
}
export async function definirPermissao(usuario: string, permitir: boolean) {
  const { error } = await supabase!.rpc('admin_definir_permissao', { p_usuario: usuario, p_permitir: permitir });
  if (error) throw error;
}
const registroSchema = z.object({ id: z.number(), ocorrido_em: z.string(), usuario_email: z.string().nullable(), tabela: z.string(), acao: z.string(), registro_id: z.string().nullable(), antes: z.unknown(), depois: z.unknown() });
export type RegistroAdministrativo = z.infer<typeof registroSchema>;
export async function listarHistorico(pagina: number, busca: string) {
  let consulta = supabase!.from('auditoria_catalogos').select('*', { count: 'exact' }).order('id', { ascending: false }).range(pagina * 50, pagina * 50 + 49);
  if (busca.trim()) consulta = consulta.ilike('tabela', `%${busca.trim()}%`);
  const { data, error, count } = await consulta;
  if (error) throw error;
  return { registros: z.array(registroSchema).parse(data), total: count ?? 0 };
}
