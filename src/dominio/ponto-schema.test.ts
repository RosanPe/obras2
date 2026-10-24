import { describe, expect, it } from 'vitest';
import { pontoFormularioSchema, pontoValidadoSchema } from './ponto-schema';
const vazio = { numero: 'P01', operacao: 'I', estruturas: [], poste_id: null, cabos_ids: [], metragem_linear: 0, mao_obra_adicional: [] };
describe('formulário do ponto', () => {
  it('permite salvar rascunho sem itens, mas exige conteúdo para validar', () => {
    expect(pontoFormularioSchema.safeParse(vazio).success).toBe(true);
    expect(pontoValidadoSchema.safeParse(vazio).success).toBe(false);
  });
  it('exige metragem positiva apenas para cabos selecionados', () => {
    expect(pontoValidadoSchema.safeParse({ ...vazio, cabos_ids: ['bt'] }).success).toBe(false);
    expect(pontoValidadoSchema.safeParse({ ...vazio, cabos_ids: ['bt'], metragem_linear: 12.5 }).success).toBe(true);
    expect(pontoValidadoSchema.safeParse({ ...vazio, cabos_ids: ['bt', 'mt'], metragem_linear: 20 }).success).toBe(true);
  });
  it('permite vários serviços manuais e estruturas no mesmo ponto', () => {
    expect(pontoValidadoSchema.safeParse({ ...vazio, estruturas: ['N1', 'N4'], mao_obra_adicional: [{ mao_obra_id: 'mo1', quantidade: 1 }, { mao_obra_id: 'mo2', quantidade: 3 }] }).success).toBe(true);
    expect(pontoValidadoSchema.safeParse({ ...vazio, mao_obra_adicional: [{ mao_obra_id: 'mo1', quantidade: .5 }] }).success).toBe(true);
  });
  it('rejeita negativos, NaN e quantidade zero de serviço', () => {
    expect(pontoFormularioSchema.safeParse({ ...vazio, metragem_linear: -1 }).success).toBe(false);
    expect(pontoFormularioSchema.safeParse({ ...vazio, metragem_linear: NaN }).success).toBe(false);
    expect(pontoFormularioSchema.safeParse({ ...vazio, mao_obra_adicional: [{ mao_obra_id: 'mo1', quantidade: 0 }] }).success).toBe(false);
  });
});
