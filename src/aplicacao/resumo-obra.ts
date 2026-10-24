import type { LinhaResultado, ResultadoMedicao } from '../dominio/tipos';

type EntradaMaoObra = Pick<ResultadoMedicao, 'maoObraInstalacao' | 'maoObraDesativacao' | 'maoObraReinstalacao'>;

export function compararDescricao(a: LinhaResultado, b: LinhaResultado) {
  return a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base', numeric: true })
    || a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })
    || a.unidade.localeCompare(b.unidade, 'pt-BR');
}

/** Consolida as operações para apresentação; o detalhamento por ponto mantém a operação original. */
export function consolidarMaoObra(resultado: EntradaMaoObra): LinhaResultado[] {
  const grupos = new Map<string, LinhaResultado>();
  for (const linha of [...resultado.maoObraInstalacao, ...resultado.maoObraDesativacao, ...resultado.maoObraReinstalacao]) {
    const chave = JSON.stringify([linha.codigo, linha.descricao, linha.unidade]);
    const anterior = grupos.get(chave);
    grupos.set(chave, { ...linha, quantidade: Math.round(((anterior?.quantidade ?? 0) + linha.quantidade + Number.EPSILON) * 1e8) / 1e8 });
  }
  return [...grupos.values()].sort(compararDescricao);
}

export function obterResumoObra(resultado: ResultadoMedicao) {
  return {
    materiaisInstalacao: [...resultado.materiaisInstalacao].sort(compararDescricao),
    materiaisDesativacao: [...resultado.materiaisDesativacao].sort(compararDescricao),
    maoObra: consolidarMaoObra(resultado),
  };
}
