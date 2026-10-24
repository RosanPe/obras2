export interface ItemBusca { id: string; codigo?: string; descricao?: string; nome?: string }
export const normalizarBusca = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g, '');
export const termosBusca = (consulta: string) => consulta.trim().split(/\s+/).map(normalizarBusca).filter(Boolean);
export function indexarCatalogo<T extends ItemBusca>(itens: T[]) {
  return itens.map(item => {
    const textos = [item.codigo ?? '', item.descricao ?? item.nome ?? ''];
    return { item, campos: textos.map(normalizarBusca), palavras: textos.flatMap(t => t.split(/\s+/).map(normalizarBusca)).filter(Boolean) };
  });
}
export function buscarNoIndice<T extends ItemBusca>(indice: ReturnType<typeof indexarCatalogo<T>>, consulta: string) {
  const termos = termosBusca(consulta);
  return indice.flatMap(registro => {
    if (!termos.every(termo => registro.campos.some(campo => campo.includes(termo)))) return [];
    const pontos = termos.reduce((soma, termo) => soma + (registro.campos.some(c => c === termo) ? 100 : registro.palavras.some(p => p === termo) ? 50 : registro.palavras.some(p => p.startsWith(termo)) ? 25 : 5), 0);
    return [{ item: registro.item, pontos }];
  }).sort((a, b) => b.pontos - a.pontos || (a.item.nome ?? a.item.codigo ?? a.item.descricao ?? '').localeCompare(b.item.nome ?? b.item.codigo ?? b.item.descricao ?? '', 'pt-BR', { numeric: true })).map(r => r.item);
}
/** Índices no texto original, preservando separadores em trechos como 11/200. */
export function faixasDestaque(texto: string, consulta: string): [number, number][] {
  const mapa: number[] = []; let normalizado = '';
  for (let i = 0; i < texto.length; i++) {
    const char = normalizarBusca(texto[i]); normalizado += char;
    for (let j = 0; j < char.length; j++) mapa.push(i);
  }
  const faixas: [number, number][] = [];
  for (const termo of termosBusca(consulta)) {
    let indice = normalizado.indexOf(termo);
    while (indice >= 0) { faixas.push([mapa[indice], mapa[indice + termo.length - 1] + 1]); indice = normalizado.indexOf(termo, indice + termo.length); }
  }
  return faixas.sort((a, b) => a[0] - b[0]).reduce<[number, number][]>((unidas, faixa) => {
    const ultima = unidas.at(-1);
    if (ultima && faixa[0] <= ultima[1]) ultima[1] = Math.max(ultima[1], faixa[1]); else unidas.push([...faixa]);
    return unidas;
  }, []);
}
