import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { materialSchema, maoObraSchema, estruturaSchema, regraSchema } from '../dominio/catalogos-schema';
import { calcularMedicao } from './motor-regras';
import type { Catalogos, PontoMedicao } from '../dominio/tipos';

// Verificação adicional da carga real, disponível somente no computador que a importou.
// O CI não precisa publicar backups para testar o motor e o conversor.
const arquivoBase = new URL('../../base-exemplo/convertida/catalogos-supabase.json', import.meta.url);
const baseDisponivel = existsSync(arquivoBase);
const tabelas = (baseDisponivel ? JSON.parse(readFileSync(arquivoBase, 'utf8')) : {
  materiais: [], mao_obra: [], estruturas: [], estrutura_itens: [], regras_mao_obra: [], regra_alvos: [], regra_saidas: [],
}) as Record<string, Record<string, unknown>[]>;
const catalogos: Catalogos = {
  materiais: tabelas.materiais.map(m => materialSchema.parse(m)),
  maoObra: tabelas.mao_obra.map(m => maoObraSchema.parse(m)),
  estruturas: tabelas.estruturas.map(e => estruturaSchema.parse({ ...e, itens: tabelas.estrutura_itens.filter(i => i.estrutura_id === e.id) })),
  regras: tabelas.regras_mao_obra.map(r => regraSchema.parse({ ...r, material_ids: tabelas.regra_alvos.filter(a => a.regra_id === r.id && a.material_id).map(a => a.material_id), estrutura_ids: tabelas.regra_alvos.filter(a => a.regra_id === r.id && a.estrutura_id).map(a => a.estrutura_id), saidas: tabelas.regra_saidas.filter(s => s.regra_id === r.id) })),
};
describe.skipIf(!baseDisponivel)('base legada convertida para o site', () => {
  it('passa na validação real dos catálogos e usa UUIDs v4 únicos', () => {
    expect([catalogos.materiais.length, catalogos.maoObra.length, catalogos.estruturas.length, catalogos.regras.length]).toEqual([633, 483, 59, 65]);
    const ids = Object.values(tabelas).flatMap(rows => rows.map(r => String(r.id)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))).toBe(true);
  });
  it('todos os vínculos apontam para os novos registros', () => {
    const materiais = new Set(catalogos.materiais.map(m => m.id));
    const estruturas = new Set(catalogos.estruturas.map(e => e.id));
    const servicos = new Set(catalogos.maoObra.map(m => m.id));
    expect(catalogos.estruturas.every(e => e.itens.every(i => materiais.has(i.material_id)))).toBe(true);
    expect(catalogos.regras.every(r => (r.material_ids ?? []).every(id => materiais.has(id)) && (r.estrutura_ids ?? []).every(id => estruturas.has(id)) && r.saidas.every(s => servicos.has(s.mao_obra_id)))).toBe(true);
  });
  it('mede as 59 estruturas sem referências quebradas', () => {
    const pontos: PontoMedicao[] = catalogos.estruturas.map((e, i) => ({ id: String(i), numero: `P${i}`, pagina: 1, x_percent: .5, y_percent: .5, operacao: 'I', status: 'validado', estrutura_id: e.id, estruturas_secundarias: [], poste_id: null, cabos_ids: [], metragem_linear: 0, mao_obra_adicional: [] }));
    const resultado = calcularMedicao({ ...catalogos, pontos });
    expect(resultado.porPonto).toHaveLength(59);
    expect(resultado.materiaisInstalacao.every(m => Number.isFinite(m.quantidade) && m.quantidade > 0)).toBe(true);
  });
});
