import { describe, expect, it } from 'vitest';
import { estruturaFormularioSchema, materialFormularioSchema, regraFormularioSchema, regraSchema } from './catalogos-schema';
const id = '11111111-1111-4111-8111-111111111111';
describe('validação de catálogos', () => {
  it('cadastra cabos somente pela categoria e ignora o subtipo legado', () => {
    const material = { codigo: '001', descricao: 'Cabo', categoria: 'cabo' };
    expect(materialFormularioSchema.safeParse(material).success).toBe(true);
    expect(materialFormularioSchema.parse({ ...material, tipo_cabo: 'BT' })).toEqual(material);
    expect(materialFormularioSchema.safeParse({ ...material, categoria: 'inexistente' }).success).toBe(false);
  });
  it('não salva estruturas sem itens ou com quantidades inválidas', () => {
    expect(estruturaFormularioSchema.safeParse({ nome: 'N1', itens: [] }).success).toBe(false);
    expect(estruturaFormularioSchema.safeParse({ nome: 'N1', itens: [{ material_id: id, quantidade: -1 }] }).success).toBe(false);
  });
  it('exige vínculo, operação e saída para uma regra', () => {
    const regra = { nome: 'Postes', tipo_gatilho: 'contexto', material_id: null, estrutura_id: null, categorias: ['poste'], operacoes: ['I'], saidas: [{ mao_obra_id: id, quantidade: 2 }] };
    expect(regraFormularioSchema.safeParse(regra).success).toBe(true);
    expect(regraFormularioSchema.safeParse({ ...regra, categorias: [] }).success).toBe(false);
    expect(regraFormularioSchema.safeParse({ ...regra, operacoes: [] }).success).toBe(false);
    expect(regraFormularioSchema.safeParse({ ...regra, saidas: [] }).success).toBe(false);
    expect(regraSchema.safeParse({ ...regra, id }).success).toBe(true);
  });
});
