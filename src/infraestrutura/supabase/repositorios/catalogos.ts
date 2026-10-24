import { z } from 'zod';
import { supabase } from '../cliente';
import { materialSchema, maoObraSchema, estruturaSchema, regraSchema, materialFormularioSchema, maoObraFormularioSchema, estruturaFormularioSchema, regraFormularioSchema } from '../../../dominio/catalogos-schema';
import type { Estrutura, MaoObra, Material, Regra } from '../../../dominio/tipos';
import { podeEditarCatalogos } from './permissoes';
async function listar(tabela: string, campos = '*') {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.from(tabela).select(campos);
  if (error) throw error;
  return data;
}
export async function carregarCatalogos() {
  const [materiais, maoObra, estruturas, regras] = await Promise.all([
    listar('materiais'), listar('mao_obra'), listar('estruturas', '*,itens:estrutura_itens(material_id,quantidade)'), listar('regras_mao_obra', '*,saidas:regra_saidas(mao_obra_id,quantidade),alvos:regra_alvos(material_id,estrutura_id)'),
  ]);
  const regraComAlvos = regraSchema.safeExtend({ alvos: z.array(z.object({ material_id: z.string().uuid().nullable(), estrutura_id: z.string().uuid().nullable() })) }).transform(({ alvos, ...regra }) => ({ ...regra, material_ids: [...new Set([regra.material_id, ...alvos.map(a => a.material_id)].filter((id): id is string => !!id))], estrutura_ids: [...new Set([regra.estrutura_id, ...alvos.map(a => a.estrutura_id)].filter((id): id is string => !!id))] }));
  return { materiais: z.array(materialSchema).parse(materiais), maoObra: z.array(maoObraSchema).parse(maoObra), estruturas: z.array(estruturaSchema).parse(estruturas), regras: z.array(regraComAlvos).parse(regras) };
}

async function clienteAutenticado() {
  if (!supabase) throw new Error('Configure o Supabase para salvar os catálogos.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Entre na sua conta para alterar os catálogos.');
  if (!await podeEditarCatalogos()) throw new Error('Sua conta possui acesso de consulta. Somente usuários autorizados podem alterar os catálogos.');
  return supabase;
}
export async function salvarMaterial(entrada: Omit<Material, 'id'>, id?: string) {
  const dados = materialFormularioSchema.parse(entrada); const cliente = await clienteAutenticado();
  const consulta = id ? cliente.from('materiais').update(dados).eq('id', id) : cliente.from('materiais').insert(dados);
  const { data, error } = await consulta.select('*').single();
  if (error) throw error; return materialSchema.parse(data);
}
export async function salvarMaoObra(entrada: Omit<MaoObra, 'id'>, id?: string) {
  const dados = maoObraFormularioSchema.parse(entrada); const cliente = await clienteAutenticado();
  const consulta = id ? cliente.from('mao_obra').update(dados).eq('id', id) : cliente.from('mao_obra').insert(dados);
  const { data, error } = await consulta.select('*').single();
  if (error) throw error; return maoObraSchema.parse(data);
}
export async function salvarEstrutura(entrada: Omit<Estrutura, 'id'>, id?: string) {
  const dados = estruturaFormularioSchema.parse(entrada); const cliente = await clienteAutenticado();
  const { data, error } = await cliente.rpc('salvar_estrutura', { p_id: id ?? null, p_nome: dados.nome, p_itens: dados.itens });
  if (error) throw error; return z.string().uuid().parse(data);
}
export async function salvarRegra(entrada: Omit<Regra, 'id'>, id?: string) {
  const dados = regraFormularioSchema.parse(entrada); const cliente = await clienteAutenticado();
  const { data, error } = await cliente.rpc('salvar_regra', { p_id: id ?? null, p_regra: dados });
  if (error) throw error; return z.string().uuid().parse(data);
}
export type TipoCatalogo = 'materiais' | 'maoObra' | 'estruturas' | 'regras';
const tabelas = { materiais: 'materiais', maoObra: 'mao_obra', estruturas: 'estruturas', regras: 'regras_mao_obra' } as const;
export async function excluirRegistro(tipo: TipoCatalogo, id: string) {
  const cliente = await clienteAutenticado();
  const { error } = await cliente.from(tabelas[tipo]).delete().eq('id', id).select('id').single();
  if (error) throw error;
}
