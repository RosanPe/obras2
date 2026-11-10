import type { Catalogos, ComposicaoOperacao, ItemMaterialPonto, ItemMaoObraPonto, Operacao, PontoMedicao } from '../dominio/tipos';
export const arredondarQuantidade = (n: number) => Math.round((n + Number.EPSILON) * 1e8) / 1e8;
export function composicaoVazia(): ComposicaoOperacao {
  return { estruturas: [], postes: [], cabos: [], materiais: [], mao_obra: [], base: { materiais: [], mao_obra: [] } };
}
function somar<T>(itens: T[], chave: (item: T) => string, quantidade: (item: T) => number, criar: (id: string, q: number) => T): T[] {
  const grupos = new Map<string, number>();
  for (const item of itens) { const q = quantidade(item); if (!Number.isFinite(q) || q <= 0) throw new Error('Quantidade deve ser positiva e finita.'); grupos.set(chave(item), arredondarQuantidade((grupos.get(chave(item)) ?? 0) + q)); }
  return [...grupos].map(([id, q]) => criar(id, q));
}
export const somarMateriais = (itens: ItemMaterialPonto[]) => somar(itens, i => i.material_id, i => i.quantidade, (material_id, quantidade) => ({ material_id, quantidade }));
export const somarMaoObra = (itens: ItemMaoObraPonto[]) => somar(itens, i => i.mao_obra_id, i => i.quantidade, (mao_obra_id, quantidade) => ({ mao_obra_id, quantidade }));

/** Sugestões são geradas apenas ao selecionar/alterar as fontes do ponto. */
export function gerarSugestoes(catalogos: Catalogos, operacao: Operacao, fontes: Pick<ComposicaoOperacao, 'estruturas' | 'postes' | 'cabos'>, avulsosLegados: ItemMaterialPonto[] = []): ComposicaoOperacao['base'] {
  const materialPorId = new Map(catalogos.materiais.map(m => [m.id, m]));
  const estruturaPorId = new Map(catalogos.estruturas.map(e => [e.id, e]));
  const materiais: ItemMaterialPonto[] = [];
  const contribuicoes: { estrutura_id?: string; material_ids: string[]; quantidade: number; cabo: boolean; legado?: boolean }[] = [];
  const conferir = (id: string, quantidade: number) => {
    if (!Number.isFinite(quantidade) || quantidade <= 0) throw new Error('Quantidade deve ser positiva e finita.');
    if (!materialPorId.has(id)) throw new Error(`Material não encontrado: ${id}`);
  };
  for (const item of fontes.estruturas) {
    if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) throw new Error('Quantidade da estrutura deve ser positiva.');
    const estrutura = estruturaPorId.get(item.estrutura_id);
    if (!estrutura) throw new Error(`Estrutura não encontrada: ${item.estrutura_id}`);
    for (const componente of estrutura.itens) {
      const quantidade = componente.quantidade * item.quantidade;
      conferir(componente.material_id, quantidade);
      materiais.push({ material_id: componente.material_id, quantidade });
    }
    contribuicoes.push({ estrutura_id: estrutura.id, material_ids: estrutura.itens.map(i => i.material_id), quantidade: item.quantidade, cabo: false });
  }
  for (const [itens, categoria] of [[fontes.postes, 'poste'], [fontes.cabos, 'cabo']] as const) {
    for (const item of itens) {
      conferir(item.material_id, item.quantidade);
      if (materialPorId.get(item.material_id)!.categoria !== categoria) throw new Error(`O material não pertence à categoria ${categoria}.`);
      materiais.push({ ...item });
      contribuicoes.push({ material_ids: [item.material_id], quantidade: item.quantidade, cabo: categoria === 'cabo' });
    }
  }
  for (const item of avulsosLegados) {
    conferir(item.material_id, item.quantidade); materiais.push({ ...item });
    contribuicoes.push({ material_ids: [item.material_id], quantidade: item.quantidade, cabo: materialPorId.get(item.material_id)!.categoria === 'cabo', legado: true });
  }
  const materiaisSomados = somarMateriais(materiais);
  const mao_obra: ItemMaoObraPonto[] = [];
  for (const regra of catalogos.regras) {
    if (!regra.operacoes.includes(operacao)) continue;
    const alvosMateriais = new Set([regra.material_id, ...regra.material_ids ?? []]);
    const alvosEstruturas = new Set([regra.estrutura_id, ...regra.estrutura_ids ?? []]);
    const materialCorresponde = (id: string) => regra.tipo_gatilho === 'material' ? alvosMateriais.has(id) : regra.categorias.includes(materialPorId.get(id)!.categoria);
    const correspondentes = contribuicoes.filter(c => regra.tipo_gatilho === 'estrutura'
      ? !!c.estrutura_id && alvosEstruturas.has(c.estrutura_id)
      : c.material_ids.some(materialCorresponde));
    const naoLineares = correspondentes.filter(c => !c.legado && (regra.tipo_gatilho === 'estrutura' || c.material_ids.some(id => materialCorresponde(id) && materialPorId.get(id)!.categoria !== 'cabo')));
    const quantidadeFontes = naoLineares.reduce((q, c) => q + c.quantidade, 0);
    const maiorCabo = regra.tipo_gatilho === 'estrutura' ? 0 : Math.max(0, ...materiaisSomados.filter(i => materialPorId.get(i.material_id)!.categoria === 'cabo' && materialCorresponde(i.material_id)).map(i => i.quantidade));
    // A migração conserva gatilhos de materiais avulsos antigos, sem duplicar uma regra já acionada pelas fontes.
    const avulso = !quantidadeFontes && !maiorCabo && correspondentes.some(c => c.legado) ? 1 : 0;
    const multiplicador = quantidadeFontes + maiorCabo + avulso;
    if (!multiplicador) continue;
    for (const saida of regra.saidas) {
      if (!catalogos.maoObra.some(m => m.id === saida.mao_obra_id)) throw new Error(`Mão de obra não encontrada: ${saida.mao_obra_id}`);
      if (!Number.isFinite(saida.quantidade) || saida.quantidade <= 0) throw new Error('Quantidade da regra deve ser positiva.');
      mao_obra.push({ mao_obra_id: saida.mao_obra_id, quantidade: saida.quantidade * multiplicador });
    }
  }
  return { materiais: operacao === 'R' ? [] : materiaisSomados, mao_obra: somarMaoObra(mao_obra) };
}

/** Linhas alteradas/removidas manualmente não são sobrescritas ao mudar outras fontes. */
function reconciliar<T extends { quantidade: number }>(atuais: T[], anterior: T[], proxima: T[], chave: (i: T) => string): T[] {
  const finais = new Map(atuais.map(i => [chave(i), i]));
  const antes = new Map(anterior.map(i => [chave(i), i]));
  const depois = new Map(proxima.map(i => [chave(i), i]));
  const resultado: T[] = [];
  for (const id of new Set([...finais.keys(), ...antes.keys(), ...depois.keys()])) {
    const atual = finais.get(id), velha = antes.get(id), nova = depois.get(id);
    if (velha) {
      if (!atual) continue; // Exclusão manual.
      if (atual.quantidade !== velha.quantidade) resultado.push(atual);
      else if (nova) resultado.push(nova);
    } else if (atual && nova) resultado.push({ ...atual, quantidade: arredondarQuantidade(atual.quantidade + nova.quantidade) });
    else if (atual || nova) resultado.push((atual ?? nova)!);
  }
  return resultado;
}
export function atualizarFontes(catalogos: Catalogos, operacao: Operacao, atual: ComposicaoOperacao, fontes: Pick<ComposicaoOperacao, 'estruturas' | 'postes' | 'cabos'>): ComposicaoOperacao {
  const base = gerarSugestoes(catalogos, operacao, fontes);
  return { ...fontes, base,
    materiais: reconciliar(atual.materiais, atual.base.materiais, base.materiais, i => i.material_id),
    mao_obra: reconciliar(atual.mao_obra, atual.base.mao_obra, base.mao_obra, i => i.mao_obra_id),
  };
}
export function obterOperacoesPonto(ponto: PontoMedicao, catalogos: Catalogos): Partial<Record<Operacao, ComposicaoOperacao>> {
  if (ponto.operacoes) return ponto.operacoes;
  const fontes = {
    estruturas: [...new Set([ponto.estrutura_id, ...ponto.estruturas_secundarias].filter((id): id is string => !!id))].map(estrutura_id => ({ estrutura_id, quantidade: 1 })),
    postes: ponto.poste_id ? [{ material_id: ponto.poste_id, quantidade: 1 }] : [],
    cabos: [...new Set(ponto.cabos_ids)].map(material_id => ({ material_id, quantidade: ponto.metragem_linear })),
  };
  let base: ComposicaoOperacao['base'];
  try { base = gerarSugestoes(catalogos, ponto.operacao, fontes); }
  catch (erro) { if (ponto.status === 'validado') throw erro; base = { materiais: [], mao_obra: [] }; }
  let legado = base;
  if (ponto.materiais_adicionais?.length) {
    try { legado = gerarSugestoes(catalogos, ponto.operacao, fontes, ponto.materiais_adicionais); }
    catch (erro) { if (ponto.status === 'validado') throw erro; legado = { materiais: somarMateriais([...base.materiais, ...ponto.materiais_adicionais]), mao_obra: base.mao_obra }; }
  }
  return { [ponto.operacao]: { ...fontes, base, materiais: ponto.operacao === 'R' ? somarMateriais(ponto.materiais_adicionais ?? []) : legado.materiais, mao_obra: somarMaoObra([...legado.mao_obra, ...ponto.mao_obra_adicional]) } };
}
