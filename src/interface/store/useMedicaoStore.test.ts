import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../infraestrutura/local/indexedDb', () => ({ carregarMedicao: vi.fn(), salvarMedicao: vi.fn() }));
import { useMedicaoStore } from './useMedicaoStore';
import { salvarMedicao } from '../../infraestrutura/local/indexedDb';
import type { PontoMedicao } from '../../dominio/tipos';
const ponto: PontoMedicao = { id: 'p', numero: 'P01', pagina: 1, x_percent: .2, y_percent: .7, status: 'validado', operacao: 'I', estrutura_id: null, estruturas_secundarias: [], poste_id: null, cabos_ids: [], metragem_linear: 0, mao_obra_adicional: [], materiais_adicionais: [{ material_id: 'm', quantidade: 2 }] };
const store = () => useMedicaoStore.getState();
beforeEach(() => {
  vi.mocked(salvarMedicao).mockReset().mockResolvedValue(undefined);
  useMedicaoStore.setState({ pranchas: [], pranchaAtivaId: null, paginaAtiva: 1, pontos: [], resultado: null, erroPersistencia: null });
});
it('adiciona pranchas sem perder os pontos e mantém a numeração e o vínculo anteriores', async () => {
  await store().adicionarPdfs([{ nome: 'primeiro.pdf', pdf: new Blob(['1']) }]);
  const primeira = store().pranchaAtivaId!;
  await store().salvarPonto({ ...ponto, prancha_id: primeira });
  await store().adicionarPdfs([{ nome: 'segundo.pdf', pdf: new Blob(['2']) }]);
  expect(store().pranchas).toHaveLength(2);
  expect(store().pontos).toMatchObject([{ ...ponto, prancha_id: primeira }]);
  expect(store().pranchaAtivaId).not.toBe(primeira);
  await store().selecionarPagina(2);
  await store().selecionarPrancha(primeira);
  expect(store().paginaAtiva).toBe(1);
});
it('remove somente a prancha selecionada e seus pontos', async () => {
  await store().adicionarPdfs(['a', 'b'].map(nome => ({ nome, pdf: new Blob([nome]) })));
  const [a, b] = store().pranchas;
  await store().salvarPonto({ ...ponto, prancha_id: a.id });
  await store().salvarPonto({ ...ponto, id: 'p2', numero: 'P02', prancha_id: b.id });
  await store().removerPrancha(a.id);
  expect(store().pranchas.map(p => p.id)).toEqual([b.id]);
  expect(store().pontos.map(p => p.id)).toEqual(['p2']);
  expect(store().pranchaAtivaId).toBe(b.id);
});
it('falha de espaço não substitui nem perde os PDFs anteriores', async () => {
  await store().adicionarPdfs([{ nome: 'a', pdf: new Blob() }]);
  const anterior = store().pranchas;
  vi.mocked(salvarMedicao).mockRejectedValueOnce(new Error('QuotaExceededError'));
  await expect(store().adicionarPdfs([{ nome: 'b', pdf: new Blob() }])).rejects.toThrow();
  expect(store().pranchas).toBe(anterior);
  expect(store().erroPersistencia).toBeTruthy();
});
it('salvamentos simultâneos não sobrescrevem pontos e rejeita vínculo inexistente', async () => {
  await store().adicionarPdfs([{ nome: 'a', pdf: new Blob() }]);
  await Promise.all([store().salvarPonto(ponto), store().salvarPonto({ ...ponto, id: 'p2', numero: 'P02' })]);
  expect(store().pontos).toHaveLength(2);
  await expect(store().salvarPonto({ ...ponto, prancha_id: 'inexistente' })).rejects.toThrow('prancha');
  expect(store().pontos).toHaveLength(2);
});
it('nova medição limpa PDFs, pontos e resultado também no armazenamento', async () => {
  await store().adicionarPdfs(['a', 'b'].map(nome => ({ nome, pdf: new Blob([nome]) })));
  await store().salvarPonto(ponto);
  await store().selecionarPagina(2);
  useMedicaoStore.setState({ avisoAtualizacao: 'aviso anterior' });
  await store().iniciarNovaMedicao();
  const vazio = { pranchas: [], pranchaAtivaId: null, paginaAtiva: 1, pontos: [], resultado: null };
  expect(store()).toMatchObject({ ...vazio, avisoAtualizacao: null });
  expect(salvarMedicao).toHaveBeenLastCalledWith(vazio);
});
it('preserva a medição inteira se não conseguir persistir o reset', async () => {
  await store().adicionarPdfs([{ nome: 'obra atual', pdf: new Blob() }]);
  await store().salvarPonto(ponto);
  const anterior = store();
  vi.mocked(salvarMedicao).mockRejectedValueOnce(new Error('falha no IndexedDB'));
  await expect(store().iniciarNovaMedicao()).rejects.toThrow();
  expect(store().pranchas).toBe(anterior.pranchas);
  expect(store().pontos).toBe(anterior.pontos);
});
it('reset aguarda salvamentos anteriores e não restaura pontos já apagados', async () => {
  await store().adicionarPdfs([{ nome: 'a', pdf: new Blob() }]);
  await Promise.all([store().salvarPonto(ponto), store().iniciarNovaMedicao()]);
  expect(store().pontos).toEqual([]);
  expect(store().pranchas).toEqual([]);
});
