import { expect, it } from 'vitest';
import { pontoComposicaoSchema, pontoComposicaoValidadoSchema } from './composicao-schema';
import { composicaoVazia } from '../aplicacao/composicao-ponto';
it('permite salvar rascunhos vazios mas exige listas finais para validar', () => {
  expect(pontoComposicaoSchema.safeParse({ numero: 'P01', operacoes: { I: composicaoVazia() } }).success).toBe(true);
  expect(pontoComposicaoValidadoSchema.safeParse({ numero: 'P01', operacoes: { I: composicaoVazia() } }).success).toBe(false);
});
it('valida ponto com conteúdo somente em desativação e rejeita quantidades ruins em qualquer aba', () => {
  const composicao = { ...composicaoVazia(), materiais: [{ material_id: 'm', quantidade: 2 }] };
  expect(pontoComposicaoValidadoSchema.safeParse({ numero: 'P01', operacoes: { I: composicaoVazia(), D: composicao } }).success).toBe(true);
  for (const quantidade of [0, -1, NaN]) expect(pontoComposicaoValidadoSchema.safeParse({ numero: 'P01', operacoes: { D: { ...composicao, materiais: [{ material_id: 'm', quantidade }] } } }).success).toBe(false);
});
