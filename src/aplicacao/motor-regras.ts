import { UNIDADE_CABO, UNIDADE_MAO_OBRA, UNIDADE_MATERIAL } from '../dominio/constantes';
import type { Catalogos, LinhaResultado, PontoMedicao, ResultadoMedicao, ResultadoPorPonto } from '../dominio/tipos';

function positiva(valor: number) {
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Quantidade deve ser positiva e finita.');
  return valor;
}
const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 1e8) / 1e8;
function consolidar(linhas: LinhaResultado[]): LinhaResultado[] {
  const grupos = new Map<string, LinhaResultado>();
  for (const linha of linhas) {
    const chave = JSON.stringify([linha.codigo, linha.descricao]);
    const anterior = grupos.get(chave);
    grupos.set(chave, { codigo: linha.codigo, descricao: linha.descricao, unidade: linha.unidade, quantidade: arredondar((anterior?.quantidade ?? 0) + linha.quantidade) });
  }
  return [...grupos.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
}

/** Cada marcador representa um ponto físico, sem multiplicador global.
 * Todos os cabos selecionados usam a mesma metragem; o percurso só conta uma vez no total linear.
 * Mão de obra manual soma às regras.
 * R gera apenas mão de obra. Materiais presentes em R continuam elegíveis como gatilhos.
 * Contexto corresponde a qualquer categoria selecionada. Somente validados são medidos.
 */
export function calcularMedicao({ materiais, maoObra, estruturas, regras, pontos }: Catalogos & { pontos: PontoMedicao[] }): ResultadoMedicao {
  const resultado: ResultadoMedicao = { metragemLinearTotal: 0, materiaisInstalacao: [], materiaisDesativacao: [], maoObraInstalacao: [], maoObraDesativacao: [], maoObraReinstalacao: [], porPonto: [] };
  for (const ponto of pontos.filter(p => p.status === 'validado')) {
    if (!Number.isFinite(ponto.metragem_linear) || ponto.metragem_linear < 0) throw new Error('Metragem linear deve ser finita e não negativa.');
    const estruturasIds = [...new Set([ponto.estrutura_id, ...ponto.estruturas_secundarias].filter((id): id is string => !!id))];
    const materiaisPonto: (LinhaResultado & { material_id: string })[] = [];
    const adicionarMaterial = (id: string, quantidade: number) => {
      const material = materiais.find(m => m.id === id);
      if (!material) throw new Error(`Material não encontrado: ${id}`);
      materiaisPonto.push({ codigo: material.codigo, descricao: material.descricao, unidade: material.categoria === 'cabo' ? UNIDADE_CABO : UNIDADE_MATERIAL, quantidade: arredondar(positiva(quantidade)), material_id: id });
    };
    const nomes = estruturasIds.map(id => {
      const estrutura = estruturas.find(e => e.id === id);
      if (!estrutura) throw new Error(`Estrutura não encontrada: ${id}`);
      estrutura.itens.forEach(item => adicionarMaterial(item.material_id, item.quantidade));
      return estrutura.nome;
    });
    if (ponto.poste_id) adicionarMaterial(ponto.poste_id, 1);
    for (const id of new Set(ponto.cabos_ids)) {
      const cabo = materiais.find(m => m.id === id);
      if (!cabo) throw new Error(`Material não encontrado: ${id}`);
      if (cabo.categoria !== 'cabo') throw new Error(`O material ${cabo.codigo} não pertence à categoria cabo.`);
      adicionarMaterial(id, ponto.metragem_linear);
    }
    const materialIds = new Set(materiaisPonto.map(m => m.material_id));
    const categorias = new Set(materiais.filter(m => materialIds.has(m.id)).map(m => m.categoria));
    const itens: ResultadoPorPonto['itens'] = ponto.operacao === 'R' ? [] : materiaisPonto.map(({ material_id: _id, ...item }) => ({ ...item, tipo: 'material' }));
    const adicionarMaoObra = (id: string, quantidade: number) => {
      const servico = maoObra.find(m => m.id === id);
      if (!servico) throw new Error(`Mão de obra não encontrada: ${id}`);
      itens.push({ tipo: 'mao_obra', codigo: servico.codigo, descricao: servico.descricao, unidade: UNIDADE_MAO_OBRA, quantidade: arredondar(positiva(quantidade)) });
    };
    for (const regra of regras) {
      if (!regra.operacoes.includes(ponto.operacao)) continue;
      const corresponde = regra.tipo_gatilho === 'material' ? [regra.material_id, ...regra.material_ids ?? []].some(id => !!id && materialIds.has(id))
        : regra.tipo_gatilho === 'estrutura' ? [regra.estrutura_id, ...regra.estrutura_ids ?? []].some(id => !!id && estruturasIds.includes(id))
          : regra.categorias.some(categoria => categorias.has(categoria));
      if (!corresponde) continue;
      // Os alvos de cabo usam a quantidade em metros dos mesmos materiais medidos.
      // Outros gatilhos mantêm a aplicação uma vez por ponto.
      const alvosMaterial = new Set([regra.material_id, ...regra.material_ids ?? []]);
      const cabosCorrespondentes = regra.tipo_gatilho === 'estrutura' ? [] : materiaisPonto.filter(item =>
        materiais.find(material => material.id === item.material_id)?.categoria === 'cabo' &&
        (regra.tipo_gatilho === 'material' ? alvosMaterial.has(item.material_id) : regra.categorias.includes('cabo')));
      const multiplicador = cabosCorrespondentes.length
        ? cabosCorrespondentes.reduce((total, item) => total + item.quantidade, 0) : 1;
      for (const saida of regra.saidas) {
        adicionarMaoObra(saida.mao_obra_id, saida.quantidade * multiplicador);
      }
    }
    for (const adicional of ponto.mao_obra_adicional) adicionarMaoObra(adicional.mao_obra_id, adicional.quantidade);
    const materiaisGerados = itens.filter(i => i.tipo === 'material');
    const servicosGerados = itens.filter(i => i.tipo === 'mao_obra');
    if (ponto.operacao === 'I') { resultado.materiaisInstalacao.push(...materiaisGerados); resultado.maoObraInstalacao.push(...servicosGerados); }
    if (ponto.operacao === 'D') { resultado.materiaisDesativacao.push(...materiaisGerados); resultado.maoObraDesativacao.push(...servicosGerados); }
    if (ponto.operacao === 'R') resultado.maoObraReinstalacao.push(...servicosGerados);
    resultado.metragemLinearTotal = arredondar(resultado.metragemLinearTotal + ponto.metragem_linear);
    resultado.porPonto.push({ numeroPonto: ponto.numero, pagina: ponto.pagina, operacao: ponto.operacao, estrutura: nomes.join(', ') || null, metragemLinear: ponto.metragem_linear, itens });
  }
  resultado.materiaisInstalacao = consolidar(resultado.materiaisInstalacao);
  resultado.materiaisDesativacao = consolidar(resultado.materiaisDesativacao);
  resultado.maoObraInstalacao = consolidar(resultado.maoObraInstalacao);
  resultado.maoObraDesativacao = consolidar(resultado.maoObraDesativacao);
  resultado.maoObraReinstalacao = consolidar(resultado.maoObraReinstalacao);
  return resultado;
}
