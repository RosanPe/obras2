import { describe, expect, it } from 'vitest';
import { calcularMedicao } from './motor-regras';
import type { Catalogos, PontoMedicao } from '../dominio/tipos';
const catalogos: Catalogos = {
  materiais: [{ id: 'm1', codigo: '001', descricao: 'Poste', categoria: 'poste' }, { id: 'm2', codigo: '002', descricao: 'Cabo A', categoria: 'cabo' }, { id: 'm3', codigo: '003', descricao: 'Cabo B', categoria: 'cabo' }],
  maoObra: [{ id: 'mo1', codigo: 'MO-01', descricao: 'Instalar' }],
  estruturas: [{ id: 'e1', nome: 'N1', itens: [{ material_id: 'm1', quantidade: 2 }] }],
  regras: [{ id: 'r1', nome: 'Postes', tipo_gatilho: 'contexto', categorias: ['poste'], material_id: null, estrutura_id: null, operacoes: ['I', 'D', 'R'], saidas: [{ mao_obra_id: 'mo1', quantidade: 3 }] }],
};
const ponto: PontoMedicao = { id: 'p1', numero: 'P01', pagina: 1, x_percent: .2, y_percent: .3, status: 'validado', operacao: 'I', estrutura_id: 'e1', estruturas_secundarias: [], poste_id: null, cabos_ids: [], metragem_linear: 0, mao_obra_adicional: [] };
const calcular = (pontos = [ponto], base = catalogos) => calcularMedicao({ ...base, pontos });
describe('motor de regras', () => {
  it('expande estrutura e registra os itens por ponto', () => {
    const resultado = calcular();
    expect(resultado.materiaisInstalacao[0].quantidade).toBe(2);
    expect(resultado.porPonto[0]).toMatchObject({ numeroPonto: 'P01', pagina: 1, estrutura: 'N1' });
    expect(resultado.porPonto[0].itens).toHaveLength(2);
  });
  it('aplica a metragem a todos os cabos e conta o percurso uma vez', () => {
    const resultado = calcular([{ ...ponto, estrutura_id: null, cabos_ids: ['m2', 'm3'], metragem_linear: 12.5 }]);
    expect(resultado.materiaisInstalacao).toMatchObject([{ codigo: '002', unidade: 'm', quantidade: 12.5 }, { codigo: '003', unidade: 'm', quantidade: 12.5 }]);
    expect(resultado.metragemLinearTotal).toBe(12.5);
    expect(resultado.porPonto[0].metragemLinear).toBe(12.5);
  });
  it('mede vários cabos pela categoria e não duplica uma seleção repetida', () => {
    const base: Catalogos = { ...catalogos, materiais: [...catalogos.materiais, { id: 'm4', codigo: '004', descricao: 'Cabo C', categoria: 'cabo' }] };
    const resultado = calcular([{ ...ponto, estrutura_id: null, cabos_ids: ['m2', 'm3', 'm4', 'm2'], metragem_linear: 20 }], base);
    expect(resultado.materiaisInstalacao.map(m => [m.codigo, m.quantidade])).toEqual([['002', 20], ['003', 20], ['004', 20]]);
    expect(resultado.metragemLinearTotal).toBe(20);
  });
  it('rejeita material de outra categoria na lista de cabos', () => {
    expect(() => calcular([{ ...ponto, cabos_ids: ['m1'], metragem_linear: 10 }])).toThrow('categoria cabo');
  });
  it('aciona regra de contexto uma vez por ponto, sem multiplicar pela metragem', () => {
    const resultado = calcular([{ ...ponto, poste_id: 'm1', cabos_ids: ['m2'], metragem_linear: 100 }]);
    expect(resultado.maoObraInstalacao[0].quantidade).toBe(3);
    expect(resultado.materiaisInstalacao[0].quantidade).toBe(3);
  });
  it('consolida duplicados e preserva o detalhamento individual', () => {
    const resultado = calcular([ponto, { ...ponto, id: 'p2', numero: 'P02' }]);
    expect(resultado.materiaisInstalacao).toHaveLength(1);
    expect(resultado.materiaisInstalacao[0].quantidade).toBe(4);
    expect(resultado.porPonto).toHaveLength(2);
  });
  it('separa desativação e reinstalação sem contabilizar materiais em R', () => {
    const resultado = calcular([{ ...ponto, operacao: 'D' }, { ...ponto, id: 'p2', operacao: 'R' }]);
    expect(resultado.materiaisDesativacao[0].quantidade).toBe(2);
    expect(resultado.materiaisInstalacao).toEqual([]);
    expect(resultado.maoObraDesativacao[0].quantidade).toBe(3);
    expect(resultado.maoObraReinstalacao[0].quantidade).toBe(3);
    expect(resultado.porPonto[1].itens.every(item => item.tipo === 'mao_obra')).toBe(true);
  });
  it('ignora pontos pendentes', () => expect(calcular([{ ...ponto, status: 'pendente' }]).porPonto).toEqual([]));
  it('respeita gatilhos de material, estrutura e operação', () => {
    const base: Catalogos = { ...catalogos, regras: ['material', 'estrutura'].map((tipo, i) => ({ ...catalogos.regras[0], id: String(i), tipo_gatilho: tipo as 'material' | 'estrutura', material_id: 'm1', estrutura_id: 'e1', operacoes: ['I'] })) };
    expect(calcular([ponto], base).maoObraInstalacao[0].quantidade).toBe(6);
    expect(calcular([{ ...ponto, operacao: 'D' }], base).maoObraDesativacao).toEqual([]);
  });
  it('não altera a entrada e rejeita referências ausentes', () => {
    const antes = JSON.stringify(catalogos);
    calcular();
    expect(JSON.stringify(catalogos)).toBe(antes);
    expect(() => calcular([{ ...ponto, poste_id: 'inexistente' }])).toThrow('Material não encontrado');
  });
  it('soma as metragens do mesmo cabo entre pontos sem erro decimal', () => {
    const resultado = calcular([.1, .2].map((metros, i) => ({ ...ponto, id: String(i), numero: `P${i}`, estrutura_id: null, cabos_ids: ['m2'], metragem_linear: metros })));
    expect(resultado.materiaisInstalacao[0]).toMatchObject({ quantidade: .3, unidade: 'm' });
    expect(resultado.porPonto.map(p => p.itens[0].quantidade)).toEqual([.1, .2]);
  });
  it('soma o percurso uma vez por ponto, mesmo com dois tipos de cabo, e ignora rascunhos', () => {
    const pontos = [25, 10.5].map((metros, i) => ({ ...ponto, id: String(i), numero: `P${i}`, cabos_ids: ['m2', 'm3'], metragem_linear: metros }));
    const resultado = calcular([...pontos, { ...pontos[0], id: 'rascunho', status: 'pendente', metragem_linear: 999 }]);
    expect(resultado.metragemLinearTotal).toBe(35.5);
    expect(resultado.materiaisInstalacao.filter(m => m.unidade === 'm').map(m => m.quantidade)).toEqual([35.5, 35.5]);
  });
  it('adiciona várias estruturas e evita duplicar o mesmo vínculo', () => {
    const base = { ...catalogos, estruturas: [...catalogos.estruturas, { id: 'e2', nome: 'N2', itens: [{ material_id: 'm1', quantidade: 4 }] }] };
    const resultado = calcular([{ ...ponto, estruturas_secundarias: ['e1', 'e2'] }], base);
    expect(resultado.materiaisInstalacao[0].quantidade).toBe(6);
    expect(resultado.porPonto[0].estrutura).toBe('N1, N2');
  });
  it('soma mão de obra manual à automática e preserva os itens por ponto', () => {
    const resultado = calcular([{ ...ponto, mao_obra_adicional: [{ mao_obra_id: 'mo1', quantidade: 2.5 }] }]);
    expect(resultado.maoObraInstalacao[0].quantidade).toBe(5.5);
    expect(resultado.porPonto[0].itens.filter(i => i.tipo === 'mao_obra').map(i => i.quantidade)).toEqual([3, 2.5]);
  });
  it('uma regra com alvos mistos usa os metros do cabo correspondente', () => {
    const base: Catalogos = { ...catalogos, regras: [{ ...catalogos.regras[0], tipo_gatilho: 'material', material_id: 'm1', material_ids: ['m1', 'm2'] }] };
    expect(calcular([{ ...ponto, cabos_ids: ['m2'], metragem_linear: 25 }], base).maoObraInstalacao[0].quantidade).toBe(75);
    expect(calcular([{ ...ponto, estrutura_id: null, cabos_ids: ['m2'], metragem_linear: 25 }], base).maoObraInstalacao[0].quantidade).toBe(75);
  });
  it.each(['I', 'D', 'R'] as const)('mede a mão de obra de cabo pela metragem em %s e soma entre pontos', operacao => {
    const base: Catalogos = { ...catalogos, regras: [{ ...catalogos.regras[0], tipo_gatilho: 'material', material_id: 'm2', material_ids: ['m2'], saidas: [{ mao_obra_id: 'mo1', quantidade: 1.5 }] }] };
    const resultado = calcular([10, 2.5].map((metros, i) => ({ ...ponto, id: String(i), estrutura_id: null, operacao, cabos_ids: ['m2', 'm3'], metragem_linear: metros })), base);
    const chave = operacao === 'I' ? 'maoObraInstalacao' : operacao === 'D' ? 'maoObraDesativacao' : 'maoObraReinstalacao';
    expect(resultado[chave][0].quantidade).toBe(18.75);
    expect(resultado.porPonto.map(p => p.itens.filter(i => i.tipo === 'mao_obra')[0].quantidade)).toEqual([15, 3.75]);
  });
  it.each(['material', 'contexto'] as const)('soma os metros de todos os cabos correspondentes no gatilho %s sem repetir IDs', tipo_gatilho => {
    const base: Catalogos = { ...catalogos, regras: [{ ...catalogos.regras[0], tipo_gatilho, categorias: ['cabo'], material_id: 'm2', material_ids: ['m2', 'm3', 'm2'], saidas: [{ mao_obra_id: 'mo1', quantidade: 1 }] }] };
    expect(calcular([{ ...ponto, estrutura_id: null, cabos_ids: ['m2', 'm3', 'm2'], metragem_linear: 25 }], base).maoObraInstalacao[0].quantidade).toBe(50);
  });
  it.each(['I', 'D', 'R'] as const)('mede mão de obra avulsa em %s, mesmo sem materiais', operacao => {
    const resultado = calcular([{ ...ponto, estrutura_id: null, operacao, mao_obra_adicional: [{ mao_obra_id: 'mo1', quantidade: 2 }] }]);
    const chave = operacao === 'I' ? 'maoObraInstalacao' : operacao === 'D' ? 'maoObraDesativacao' : 'maoObraReinstalacao';
    expect(resultado[chave][0]).toMatchObject({ codigo: 'MO-01', quantidade: 2, unidade: 'SV' });
    expect(resultado.porPonto[0].itens).toHaveLength(1);
  });
  it('não ignora serviço adicional removido do catálogo', () => expect(() => calcular([{ ...ponto, mao_obra_adicional: [{ mao_obra_id: 'ausente', quantidade: 2 }] }])).toThrow('Mão de obra não encontrada'));
  it('rejeita metragens e quantidades de serviço inválidas', () => {
    expect(() => calcular([{ ...ponto, cabos_ids: ['m2'], metragem_linear: 0 }])).toThrow('Quantidade');
    expect(() => calcular([{ ...ponto, mao_obra_adicional: [{ mao_obra_id: 'mo1', quantidade: -1 }] }])).toThrow('Quantidade');
  });
});
