import { z } from 'zod';
const texto = z.string().trim().min(1, 'Preencha este campo.');
export const materialFormularioSchema = z.object({ codigo: texto, descricao: texto, categoria: z.enum(['cabo', 'poste', 'geral']) });
export const maoObraFormularioSchema = z.object({ codigo: texto, descricao: texto });
export const estruturaFormularioSchema = z.object({ nome: texto, itens: z.array(z.object({ material_id: z.string().uuid(), quantidade: z.number().finite().positive() })).min(1, 'Adicione ao menos um material.') });
export const regraFormularioSchema = z.object({ nome: texto, tipo_gatilho: z.enum(['material', 'estrutura', 'contexto']), material_id: z.string().uuid().nullable(), estrutura_id: z.string().uuid().nullable(), material_ids: z.array(z.string().uuid()).optional(), estrutura_ids: z.array(z.string().uuid()).optional(), categorias: z.array(z.enum(['cabo', 'poste', 'geral'])), operacoes: z.array(z.enum(['I', 'D', 'R'])).min(1, 'Selecione uma operação.'), saidas: z.array(z.object({ mao_obra_id: z.string().uuid(), quantidade: z.number().finite().positive() })).min(1, 'Adicione uma saída de mão de obra.') }).superRefine((v, ctx) => {
  if (v.tipo_gatilho === 'material' && !v.material_id) ctx.addIssue({ code: 'custom', path: ['material_id'], message: 'Selecione o material gatilho.' });
  if (v.tipo_gatilho === 'estrutura' && !v.estrutura_id) ctx.addIssue({ code: 'custom', path: ['estrutura_id'], message: 'Selecione a estrutura gatilho.' });
  if (v.tipo_gatilho === 'contexto' && !v.categorias.length) ctx.addIssue({ code: 'custom', path: ['categorias'], message: 'Selecione ao menos uma categoria.' });
});
export const materialSchema = materialFormularioSchema.safeExtend({ id: z.string().uuid() });
export const maoObraSchema = maoObraFormularioSchema.extend({ id: z.string().uuid() });
export const estruturaSchema = estruturaFormularioSchema.extend({ id: z.string().uuid() });
export const regraSchema = regraFormularioSchema.safeExtend({ id: z.string().uuid() });
