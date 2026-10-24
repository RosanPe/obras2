import { expect, it } from 'vitest';
import { atualizarPonto, type PontoLegado, type PontoComMetragensSeparadas, type PontoComCabosSeparados } from './migracao-pontos';
const legado: PontoLegado = { id: 'p', numero: 'P01', pagina: 2, x_percent: .3, y_percent: .4, status: 'validado', operacao: 'I', estrutura_id: 'N1', estruturas_secundarias: ['N2'], poste_id: null, cabo_bt_id: 'bt', cabo_mt_id: 'mt', quantidade_cabo: 25.5, quantidade_pontos: 1, observacoes: 'antiga' };
it('preserva pontos locais e restaura a metragem linear compartilhada', () => {
  const novo = atualizarPonto(legado);
  expect(novo).toMatchObject({ pagina: 2, x_percent: .3, y_percent: .4, estrutura_id: 'N1', estruturas_secundarias: ['N2'], metragem_linear: 25.5, mao_obra_adicional: [], cabos_ids: ['bt', 'mt'], status: 'validado' });
  expect(novo).not.toHaveProperty('quantidade_pontos');
  expect(novo).not.toHaveProperty('observacoes');
  expect(novo).not.toHaveProperty('quantidade_cabo');
});
it('devolve a rascunho o ponto que usava o multiplicador retirado', () => expect(atualizarPonto({ ...legado, quantidade_pontos: 3 }).status).toBe('pendente'));
it('não altera metragens nem mão de obra ao restaurar pontos novos', () => {
  const novo = { ...atualizarPonto(legado), metragem_linear: 31, mao_obra_adicional: [{ mao_obra_id: 'mo', quantidade: 2 }] };
  expect(atualizarPonto(novo)).toEqual(novo);
});

it('unifica comprimentos iguais e exige revisão quando BT e MT eram diferentes', () => {
  const { quantidade_cabo: _q, quantidade_pontos: _p, observacoes: _o, ...comuns } = legado;
  const anterior: PontoComMetragensSeparadas = { ...comuns, metragem_cabo_bt: 30, metragem_cabo_mt: 30, mao_obra_adicional: [{ mao_obra_id: 'mo', quantidade: 2 }] };
  expect(atualizarPonto(anterior)).toMatchObject({ metragem_linear: 30, status: 'validado', mao_obra_adicional: anterior.mao_obra_adicional });
  expect(atualizarPonto({ ...anterior, metragem_cabo_mt: 45 })).toMatchObject({ metragem_linear: 0, status: 'pendente' });
});

it('preserva cabos e medidas do modelo anterior com metragem única', () => {
  const { quantidade_cabo: _q, quantidade_pontos: _p, observacoes: _o, ...dados } = legado;
  const anterior: PontoComCabosSeparados = { ...dados, metragem_linear: 40, mao_obra_adicional: [{ mao_obra_id: 'mo', quantidade: 2 }] };
  const atualizado = atualizarPonto(anterior);
  expect(atualizado).toMatchObject({ cabos_ids: ['bt', 'mt'], metragem_linear: 40, status: 'validado', mao_obra_adicional: anterior.mao_obra_adicional });
  expect(atualizado).not.toHaveProperty('cabo_bt_id');
  expect(atualizado).not.toHaveProperty('cabo_mt_id');
});
it('normaliza seleções repetidas sem duplicar o mesmo cabo', () => {
  expect(atualizarPonto({ ...atualizarPonto(legado), cabos_ids: ['bt', 'mt', 'bt'] }).cabos_ids).toEqual(['bt', 'mt']);
});
