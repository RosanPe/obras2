import { create } from 'zustand';
import { carregarMedicao, salvarMedicao, type MedicaoLocal } from '../../infraestrutura/local/indexedDb';
import type { PontoMedicao, ResultadoMedicao } from '../../dominio/tipos';
const vazio: MedicaoLocal = { pranchas: [], pranchaAtivaId: null, paginaAtiva: 1, pontos: [], resultado: null };
let fila = Promise.resolve();
interface Estado extends MedicaoLocal {
  pronto: boolean; erroPersistencia: string | null; avisoAtualizacao: string | null;
  restaurar: () => Promise<void>; iniciarNovaMedicao: () => Promise<void>;
  adicionarPdfs: (arquivos: { pdf: Blob; nome: string }[]) => Promise<void>;
  selecionarPrancha: (id: string) => Promise<void>; selecionarPagina: (pagina: number) => Promise<void>;
  removerPrancha: (id: string) => Promise<void>;
  salvarPonto: (ponto: PontoMedicao) => Promise<void>; excluirPonto: (id: string) => Promise<void>;
  guardarResultado: (resultado: ResultadoMedicao) => Promise<void>;
}
export const useMedicaoStore = create<Estado>((set, get) => {
  const persistir = (alterar: (estado: Estado) => Partial<MedicaoLocal>, manterEmMemoria = true) => {
    // Serializa também a leitura do estado para não perder alterações concorrentes.
    const tarefa = fila.catch(() => {}).then(async () => {
      const atual = get(); const alteracao = alterar(atual);
      const { pranchas, pranchaAtivaId, paginaAtiva, pontos, resultado } = { ...atual, ...alteracao };
      try {
        await salvarMedicao({ pranchas, pranchaAtivaId, paginaAtiva, pontos, resultado });
        set({ ...alteracao, erroPersistencia: null });
      } catch (erro) {
        if (manterEmMemoria) set(alteracao);
        set({ erroPersistencia: 'Falha ao salvar no navegador. Mantenha a página aberta e exporte o Excel.' });
        throw erro;
      }
    });
    fila = tarefa;
    return tarefa;
  };
  return { ...vazio, pronto: false, erroPersistencia: null, avisoAtualizacao: null,
    restaurar: async () => {
      try { const dados = await carregarMedicao(); set({ ...(dados ?? vazio), avisoAtualizacao: dados?.avisoAtualizacao ?? null, pronto: true }); }
      catch { set({ pronto: true, erroPersistencia: 'Não foi possível restaurar os dados locais.' }); }
    },
    iniciarNovaMedicao: async () => { await persistir(() => ({ ...vazio }), false); set({ avisoAtualizacao: null }); },
    adicionarPdfs: arquivos => persistir(estado => {
      if (!arquivos.length) return {};
      const novos = arquivos.map(arquivo => ({ ...arquivo, id: globalThis.crypto?.randomUUID?.() ?? `pdf-${Date.now()}-${Math.random().toString(36).slice(2)}` }));
      return { pranchas: [...estado.pranchas, ...novos], pranchaAtivaId: novos[0].id, paginaAtiva: 1, resultado: null };
    }, false),
    selecionarPrancha: id => persistir(estado => {
      if (!estado.pranchas.some(p => p.id === id)) throw new Error('Prancha não encontrada.');
      return { pranchaAtivaId: id, paginaAtiva: 1 };
    }, false),
    selecionarPagina: pagina => persistir(() => {
      if (!Number.isInteger(pagina) || pagina < 1) throw new Error('Página inválida.');
      return { paginaAtiva: pagina };
    }, false),
    removerPrancha: id => persistir(estado => {
      const pranchas = estado.pranchas.filter(p => p.id !== id);
      return { pranchas, pontos: estado.pontos.filter(p => p.prancha_id !== id), resultado: null,
        ...(estado.pranchaAtivaId === id ? { pranchaAtivaId: pranchas[0]?.id ?? null, paginaAtiva: 1 } : {}) };
    }, false),
    salvarPonto: ponto => persistir(estado => {
      const id = ponto.prancha_id ?? estado.pranchaAtivaId;
      if (!id || !estado.pranchas.some(p => p.id === id)) throw new Error('A prancha deste ponto não existe.');
      return { pontos: [...estado.pontos.filter(p => p.id !== ponto.id), { ...ponto, prancha_id: id, materiais_adicionais: ponto.materiais_adicionais ?? [] }], resultado: null };
    }),
    excluirPonto: id => persistir(estado => ({ pontos: estado.pontos.filter(p => p.id !== id), resultado: null })),
    guardarResultado: resultado => persistir(() => ({ resultado })),
  };
});
