import { create } from 'zustand';
import { carregarMedicao, salvarMedicao, type MedicaoLocal } from '../../infraestrutura/local/indexedDb';
import type { PontoMedicao, ResultadoMedicao } from '../../dominio/tipos';
const vazio: MedicaoLocal = { pdf: null, nomePdf: '', pontos: [], resultado: null };
let fila = Promise.resolve();
interface Estado extends MedicaoLocal {
  pronto: boolean; erroPersistencia: string | null; avisoAtualizacao: string | null;
  restaurar: () => Promise<void>; carregarPdf: (pdf: Blob, nome: string) => Promise<void>;
  salvarPonto: (ponto: PontoMedicao) => Promise<void>; excluirPonto: (id: string) => Promise<void>;
  guardarResultado: (resultado: ResultadoMedicao) => Promise<void>;
}
export const useMedicaoStore = create<Estado>((set, get) => {
  const persistir = (alteracao: Partial<MedicaoLocal>) => {
    const anterior = get();
    set(alteracao);
    const { pdf, nomePdf, pontos, resultado } = get();
    const tarefa = fila.catch(() => {}).then(() => salvarMedicao({ pdf, nomePdf, pontos, resultado }));
    fila = tarefa;
    return tarefa.then(() => set({ erroPersistencia: null })).catch((erro: unknown) => {
      // O estado em memória permanece disponível para exportação mesmo sem espaço no navegador.
      set({ erroPersistencia: 'Falha ao salvar no navegador. Mantenha a página aberta e exporte o Excel.' });
      if (alteracao.pdf && anterior.pdf !== alteracao.pdf) set({ pdf: anterior.pdf, nomePdf: anterior.nomePdf, pontos: anterior.pontos, resultado: anterior.resultado });
      throw erro;
    });
  };
  return { ...vazio, pronto: false, erroPersistencia: null, avisoAtualizacao: null,
    restaurar: async () => {
      try { const dados = await carregarMedicao(); set({ ...(dados ?? vazio), avisoAtualizacao: dados?.avisoAtualizacao ?? null, pronto: true }); }
      catch { set({ pronto: true, erroPersistencia: 'Não foi possível restaurar os dados locais.' }); }
    },
    carregarPdf: (pdf, nomePdf) => { set({ avisoAtualizacao: null }); return persistir({ pdf, nomePdf, pontos: [], resultado: null }); },
    salvarPonto: ponto => persistir({ pontos: [...get().pontos.filter(p => p.id !== ponto.id), ponto], resultado: null }),
    excluirPonto: id => persistir({ pontos: get().pontos.filter(p => p.id !== id), resultado: null }),
    guardarResultado: resultado => persistir({ resultado }),
  };
});
