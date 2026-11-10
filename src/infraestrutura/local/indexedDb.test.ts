import { expect, it } from 'vitest';
import { atualizarMedicao } from './indexedDb';
import type { PontoMedicao } from '../../dominio/tipos';
const ponto: PontoMedicao = { id: 'p1', numero: 'P01', pagina: 2, x_percent: .2, y_percent: .7, status: 'validado', operacao: 'I', estrutura_id: null, estruturas_secundarias: [], poste_id: null, cabos_ids: [], metragem_linear: 0, mao_obra_adicional: [] };
it('migra o PDF único e vincula seus pontos sem alterar página, posição e itens', () => {
  const pdf = new Blob(['pdf']);
  const dados = atualizarMedicao({ pdf, nomePdf: 'antigo.pdf', pontos: [ponto], resultado: null, versaoPontos: 4 });
  expect(dados.pranchas).toEqual([{ id: 'prancha-original', nome: 'antigo.pdf', pdf }]);
  expect(dados.pontos[0]).toEqual({ ...ponto, prancha_id: 'prancha-original', materiais_adicionais: [] });
  expect(dados.pranchaAtivaId).toBe('prancha-original');
});
it('restaura múltiplos PDFs com página ativa e quantidades avulsas', () => {
  const pranchas = ['a', 'b'].map(id => ({ id, nome: `${id}.pdf`, pdf: new Blob([id]) }));
  const pontos = [{ ...ponto, prancha_id: 'b', materiais_adicionais: [{ material_id: 'm1', quantidade: 4 }] }];
  const dados = atualizarMedicao({ pranchas, pranchaAtivaId: 'b', paginaAtiva: 2, pontos, resultado: null, versaoPontos: 5 });
  expect(dados).toMatchObject({ pranchas, pranchaAtivaId: 'b', paginaAtiva: 2, pontos });
});
it('recupera uma seleção inexistente sem perder os PDFs e normaliza página inválida', () => {
  const pranchas = [{ id: 'a', nome: 'a.pdf', pdf: new Blob() }];
  expect(atualizarMedicao({ pranchas, pranchaAtivaId: 'removida', paginaAtiva: -1, pontos: [], resultado: null })).toMatchObject({ pranchas, pranchaAtivaId: 'a', paginaAtiva: 1 });
});
it('restaura as três operações e as listas finais sem recriar itens apagados', async () => {
  const { composicaoVazia } = await import('../../aplicacao/composicao-ponto');
  const c = { ...composicaoVazia(), estruturas: [{ estrutura_id: 'N1', quantidade: 2 }], base: { materiais: [{ material_id: 'm', quantidade: 6 }], mao_obra: [] }, materiais: [{ material_id: 'm', quantidade: 9 }] };
  const pranchas = [{ id: 'a', nome: 'a.pdf', pdf: new Blob() }];
  const novo = { ...ponto, prancha_id: 'a', operacoes: { I: c, D: composicaoVazia(), R: composicaoVazia() } };
  const restaurado = atualizarMedicao({ pranchas, pontos: [novo], resultado: null, versaoPontos: 6 });
  expect(restaurado.pontos[0].operacoes).toEqual(novo.operacoes);
  expect(restaurado.pontos[0].operacoes?.I?.materiais[0].quantidade).toBe(9);
});
