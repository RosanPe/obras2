import { describe, expect, it } from 'vitest';
import { buscarNoIndice, faixasDestaque, indexarCatalogo } from './busca-catalogo';
const buscar = <T extends { id: string }>(itens: T[], consulta: string) => buscarNoIndice(indexarCatalogo(itens), consulta);
describe('busca de nomenclaturas do ponto', () => {
  it('lista N1, N2, N3, N4 e N10 em ordem natural ao digitar N', () => {
    expect(buscar(['N10', 'B1', 'N4', 'N3', 'N1', 'N2'].map(nome => ({ id: nome, nome })), 'N').map(e => e.nome)).toEqual(['N1', 'N2', 'N3', 'N4', 'N10']);
  });
  it('encontra 11/200 ao digitar 11200 ou por código', () => {
    const poste = { id: 'p', codigo: 'P-001', descricao: 'POSTE CONCRE DT 11/200' };
    expect(buscar([poste], '11200')).toEqual([poste]);
    expect(buscar([poste], 'p001')).toEqual([poste]);
    expect(buscar([poste], 'concre 11200')).toEqual([poste]);
  });
  it('encontra cabos com palavras fora de ordem e ignora acentos e caixa', () => {
    const cabos = [{ id: '1', descricao: 'CABO ALUM CA 2/0' }, { id: '2', descricao: 'CABO COBRE CA 2/0' }, { id: '3', descricao: 'CABO ALUM CA 4/0' }];
    expect(buscar(cabos, 'alum 2/0 ca')).toEqual([cabos[0]]);
    expect(buscar([{ id: '4', descricao: 'Cabo alumínio CA 2/0' }], 'ALUMINIO 2/0')).toHaveLength(1);
  });
  it('não exige texto entre os termos pesquisados e prioriza código exato', () => {
    const itens = [{ id: '1', codigo: '01', descricao: 'Poste 11/200' }, { id: '2', codigo: '11200', descricao: 'Poste DT' }];
    expect(buscar(itens, '11200').map(i => i.id)).toEqual(['2', '1']);
  });
  it('destaca 11/200 a partir da nomenclatura sem separador', () => expect(faixasDestaque('POSTE 11/200', '11200')).toEqual([[6, 12]]));
});
