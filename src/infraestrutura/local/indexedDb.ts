import { get, set } from 'idb-keyval';
import type { PontoMedicao, PranchaPdf, ResultadoMedicao } from '../../dominio/tipos';
import { atualizarPonto, type PontoArmazenado } from './migracao-pontos';
export interface MedicaoLocal {
  pranchas: PranchaPdf[]; pranchaAtivaId: string | null; paginaAtiva: number;
  pontos: PontoMedicao[]; resultado: ResultadoMedicao | null;
}
export interface MedicaoArmazenada {
  pdf?: Blob | null; nomePdf?: string; pranchas?: PranchaPdf[]; pranchaAtivaId?: string | null; paginaAtiva?: number;
  pontos: PontoArmazenado[]; resultado: ResultadoMedicao | null; versaoPontos?: number;
}
export function atualizarMedicao(dados: MedicaoArmazenada): MedicaoLocal & { avisoAtualizacao?: string } {
  const pranchas = dados.pranchas ?? (dados.pdf ? [{ id: 'prancha-original', nome: dados.nomePdf || 'Croqui.pdf', pdf: dados.pdf }] : []);
  const mudou = ![3, 4, 5].includes(dados.versaoPontos ?? 0) || dados.pontos.some(p => 'cabo_bt_id' in p && !!p.cabo_bt_id && p.cabo_bt_id === p.cabo_mt_id);
  const pontos = dados.pontos.map(p => ({ ...atualizarPonto(p), prancha_id: p.prancha_id ?? pranchas[0]?.id, materiais_adicionais: p.materiais_adicionais ?? [] }));
  return {
    pranchas, pranchaAtivaId: pranchas.find(p => p.id === dados.pranchaAtivaId)?.id ?? pranchas[0]?.id ?? null,
    paginaAtiva: Number.isInteger(dados.paginaAtiva) && dados.paginaAtiva! > 0 ? dados.paginaAtiva! : 1,
    pontos, resultado: mudou ? null : dados.resultado,
    avisoAtualizacao: mudou && pontos.length ? 'Itens e posições preservados. Gere o resumo novamente e revise os pontos que voltaram a rascunho por medidas anteriores incompatíveis.' : undefined,
  };
}
// A mesma chave preserva a migração e grava PDFs e vínculos dos pontos juntos.
export async function carregarMedicao() {
  const dados = await get<MedicaoArmazenada>('obras:medicao:v1');
  return dados ? atualizarMedicao(dados) : undefined;
}
export const salvarMedicao = (medicao: MedicaoLocal) => set('obras:medicao:v1', { ...medicao, versaoPontos: 5 });
