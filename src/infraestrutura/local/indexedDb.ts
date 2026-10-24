import { get, set } from 'idb-keyval';
import type { PontoMedicao, ResultadoMedicao } from '../../dominio/tipos';
import { atualizarPonto, type PontoArmazenado } from './migracao-pontos';
export interface MedicaoLocal { pdf: Blob | null; nomePdf: string; pontos: PontoMedicao[]; resultado: ResultadoMedicao | null }
// Uma única chave garante que PDF e coordenadas sejam substituídos juntos.
export async function carregarMedicao(): Promise<(MedicaoLocal & { avisoAtualizacao?: string }) | undefined> {
  const dados = await get<Omit<MedicaoLocal, 'pontos'> & { pontos: PontoArmazenado[]; versaoPontos?: number }>('obras:medicao:v1');
  if (!dados) return;
  const mudou = ![3, 4].includes(dados.versaoPontos ?? 0) || dados.pontos.some(p => 'cabo_bt_id' in p && !!p.cabo_bt_id && p.cabo_bt_id === p.cabo_mt_id);
  return { pdf: dados.pdf, nomePdf: dados.nomePdf, pontos: dados.pontos.map(atualizarPonto), resultado: mudou ? null : dados.resultado,
    avisoAtualizacao: mudou && dados.pontos.length ? 'Os cabos agora ficam em uma lista com metragem compartilhada. Posições e itens preservados; gere o resumo novamente. Revise os pontos que voltaram a rascunho por medidas anteriores incompatíveis.' : undefined };
}
export const salvarMedicao = (medicao: MedicaoLocal) => set('obras:medicao:v1', { ...medicao, versaoPontos: 4 });
