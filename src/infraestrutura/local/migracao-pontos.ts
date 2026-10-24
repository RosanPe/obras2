import type { PontoMedicao } from '../../dominio/tipos';
type DadosComuns = Omit<PontoMedicao, 'cabos_ids' | 'metragem_linear' | 'mao_obra_adicional'>;
type CabosAnteriores = { cabo_bt_id: string | null; cabo_mt_id: string | null };
export type PontoLegado = DadosComuns & CabosAnteriores & { quantidade_cabo: number; quantidade_pontos: number; observacoes?: string };
export type PontoComMetragensSeparadas = DadosComuns & CabosAnteriores & { metragem_cabo_bt: number; metragem_cabo_mt: number; mao_obra_adicional: PontoMedicao['mao_obra_adicional'] };
export type PontoComCabosSeparados = DadosComuns & CabosAnteriores & { metragem_linear: number; mao_obra_adicional: PontoMedicao['mao_obra_adicional'] };
export type PontoArmazenado = PontoMedicao | PontoLegado | PontoComMetragensSeparadas | PontoComCabosSeparados;

export function atualizarPonto(ponto: PontoArmazenado): PontoMedicao {
  if ('cabos_ids' in ponto) return { ...ponto, cabos_ids: [...new Set(ponto.cabos_ids)], mao_obra_adicional: ponto.mao_obra_adicional ?? [] };
  const cabos = [...new Set([ponto.cabo_bt_id, ponto.cabo_mt_id].filter((id): id is string => !!id))];
  if ('metragem_linear' in ponto) {
    const { cabo_bt_id: _bt, cabo_mt_id: _mt, ...dados } = ponto;
    return { ...dados, cabos_ids: cabos, mao_obra_adicional: ponto.mao_obra_adicional ?? [] };
  }
  if ('metragem_cabo_bt' in ponto) {
    const { cabo_bt_id, cabo_mt_id, metragem_cabo_bt, metragem_cabo_mt, ...dados } = ponto;
    const conflitante = !!cabo_bt_id && !!cabo_mt_id && metragem_cabo_bt !== metragem_cabo_mt;
    return { ...dados, cabos_ids: cabos, metragem_linear: conflitante ? 0 : cabo_bt_id ? metragem_cabo_bt : cabo_mt_id ? metragem_cabo_mt : 0, status: conflitante ? 'pendente' : ponto.status };
  }
  const { cabo_bt_id: _bt, cabo_mt_id: _mt, quantidade_cabo, quantidade_pontos, observacoes: _observacoes, ...dados } = ponto;
  return { ...dados, cabos_ids: cabos, metragem_linear: cabos.length ? quantidade_cabo : 0, mao_obra_adicional: [], status: quantidade_pontos !== 1 ? 'pendente' : ponto.status };
}
