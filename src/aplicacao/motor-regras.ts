import { UNIDADE_CABO, UNIDADE_MAO_OBRA, UNIDADE_MATERIAL } from '../dominio/constantes';
import type { Catalogos, LinhaResultado, Operacao, PontoMedicao, PranchaPdf, ResultadoMedicao, ResultadoPorPonto } from '../dominio/tipos';
import { arredondarQuantidade, obterOperacoesPonto } from './composicao-ponto';
import { compararDescricao } from './resumo-obra';
function consolidar(linhas: LinhaResultado[]): LinhaResultado[] {
  const grupos = new Map<string, LinhaResultado>();
  for (const linha of linhas) {
    const chave = JSON.stringify([linha.codigo, linha.descricao, linha.unidade]);
    grupos.set(chave, { ...linha, quantidade: arredondarQuantidade((grupos.get(chave)?.quantidade ?? 0) + linha.quantidade) });
  }
  return [...grupos.values()].sort(compararDescricao);
}
/** O resumo lê exclusivamente as listas finais salvas em cada operação do ponto. */
export function calcularMedicao({ pontos, pranchas = [], ...catalogos }: Catalogos & { pontos: PontoMedicao[]; pranchas?: Pick<PranchaPdf, 'id' | 'nome'>[] }): ResultadoMedicao {
  const resultado: ResultadoMedicao = { metragemLinearTotal: 0, materiaisInstalacao: [], materiaisDesativacao: [], materiaisReinstalacao: [], maoObraInstalacao: [], maoObraDesativacao: [], maoObraReinstalacao: [], porPonto: [] };
  const materiais = new Map(catalogos.materiais.map(m => [m.id, m]));
  const servicos = new Map(catalogos.maoObra.map(m => [m.id, m]));
  for (const ponto of pontos.filter(p => p.status === 'validado')) {
    const operacoes = obterOperacoesPonto(ponto, catalogos);
    const indice = pranchas.findIndex(p => p.id === ponto.prancha_id);
    for (const operacao of ['I', 'D', 'R'] as Operacao[]) {
      const composicao = operacoes[operacao];
      if (!composicao || (!composicao.materiais.length && !composicao.mao_obra.length)) continue;
      const itens: ResultadoPorPonto['itens'] = [];
      for (const item of composicao.materiais) {
        const material = materiais.get(item.material_id);
        if (!material) throw new Error(`Material não encontrado: ${item.material_id}`);
        if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) throw new Error('Quantidade de material deve ser positiva.');
        itens.push({ tipo: 'material', codigo: material.codigo, descricao: material.descricao, unidade: material.categoria === 'cabo' ? UNIDADE_CABO : UNIDADE_MATERIAL, quantidade: item.quantidade });
      }
      for (const item of composicao.mao_obra) {
        const servico = servicos.get(item.mao_obra_id);
        if (!servico) throw new Error(`Mão de obra não encontrada: ${item.mao_obra_id}`);
        if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) throw new Error('Quantidade de mão de obra deve ser positiva.');
        itens.push({ tipo: 'mao_obra', codigo: servico.codigo, descricao: servico.descricao, unidade: UNIDADE_MAO_OBRA, quantidade: item.quantidade });
      }
      const materialFinal = itens.filter(i => i.tipo === 'material');
      const maoObraFinal = itens.filter(i => i.tipo === 'mao_obra');
      if (operacao === 'I') { resultado.materiaisInstalacao.push(...materialFinal); resultado.maoObraInstalacao.push(...maoObraFinal); }
      if (operacao === 'D') { resultado.materiaisDesativacao.push(...materialFinal); resultado.maoObraDesativacao.push(...maoObraFinal); }
      if (operacao === 'R') { resultado.maoObraReinstalacao.push(...maoObraFinal); resultado.materiaisReinstalacao!.push(...materialFinal); }
      const metragemLinear = Math.max(0, ...composicao.materiais.filter(i => materiais.get(i.material_id)?.categoria === 'cabo').map(i => i.quantidade));
      resultado.metragemLinearTotal = arredondarQuantidade(resultado.metragemLinearTotal + metragemLinear);
      resultado.porPonto.push({ numeroPonto: ponto.numero, pagina: ponto.pagina, operacao, estrutura: composicao.estruturas.map(e => `${catalogos.estruturas.find(s => s.id === e.estrutura_id)?.nome ?? 'Estrutura indisponível'} × ${e.quantidade}`).join(', ') || null,
        ...(indice >= 0 ? { prancha: `${indice + 1} · ${pranchas[indice].nome}`, pranchaId: ponto.prancha_id } : {}), metragemLinear, itens });
    }
  }
  for (const chave of ['materiaisInstalacao', 'materiaisDesativacao', 'maoObraInstalacao', 'maoObraDesativacao', 'maoObraReinstalacao'] as const) resultado[chave] = consolidar(resultado[chave]);
  resultado.materiaisReinstalacao = consolidar(resultado.materiaisReinstalacao ?? []);
  return resultado;
}
