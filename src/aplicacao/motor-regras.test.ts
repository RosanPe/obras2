import { describe, expect, it } from 'vitest';
import { calcularMedicao } from './motor-regras';
import { atualizarFontes, composicaoVazia, gerarSugestoes, obterOperacoesPonto } from './composicao-ponto';
import type { Catalogos, ComposicaoOperacao, PontoMedicao } from '../dominio/tipos';
const catalogos: Catalogos = {
  materiais: [{ id: 'm', codigo: '900', descricao: 'Abraçadeira', categoria: 'geral' }, { id: 'p', codigo: '100', descricao: 'Poste', categoria: 'poste' }, { id: 'c1', codigo: '200', descricao: 'Cabo 2', categoria: 'cabo' }, { id: 'c2', codigo: '201', descricao: 'Cabo 2/0', categoria: 'cabo' }],
  maoObra: [{ id: 'mo1', codigo: 'MO1', descricao: 'Montar estrutura' }, { id: 'mo2', codigo: 'MO2', descricao: 'Instalar poste' }, { id: 'mo3', codigo: 'MO3', descricao: 'Lançar cabo' }],
  estruturas: [{ id: 'e1', nome: 'N1', itens: [{ material_id: 'm', quantidade: 3 }] }],
  regras: [
    { id: 'r1', nome: 'Estrutura', tipo_gatilho: 'estrutura', categorias: [], material_id: null, estrutura_id: 'e1', operacoes: ['I', 'D', 'R'], saidas: [{ mao_obra_id: 'mo1', quantidade: 2 }] },
    { id: 'r2', nome: 'Poste', tipo_gatilho: 'material', categorias: [], material_id: 'p', estrutura_id: null, operacoes: ['I', 'D', 'R'], saidas: [{ mao_obra_id: 'mo2', quantidade: 3 }] },
    { id: 'r3', nome: 'Cabo < 2/0', tipo_gatilho: 'material', categorias: [], material_id: 'c1', material_ids: ['c1', 'c2'], estrutura_id: null, operacoes: ['I', 'D', 'R'], saidas: [{ mao_obra_id: 'mo3', quantidade: 1 }] },
  ],
};
const ponto: PontoMedicao = { id: 'p1', numero: 'P01', pagina: 1, x_percent: .2, y_percent: .3, status: 'validado', operacao: 'I', estrutura_id: null, estruturas_secundarias: [], poste_id: null, cabos_ids: [], metragem_linear: 0, mao_obra_adicional: [] };
const fontes = { estruturas: [{ estrutura_id: 'e1', quantidade: 2 }], postes: [{ material_id: 'p', quantidade: 3 }], cabos: [{ material_id: 'c1', quantidade: 50 }, { material_id: 'c2', quantidade: 52 }] };
const preencher = (op: 'I' | 'D' | 'R' = 'I') => atualizarFontes(catalogos, op, composicaoVazia(), fontes);
const calcular = (composicao = preencher()) => calcularMedicao({ ...catalogos, pontos: [{ ...ponto, operacoes: { I: composicao } }] });
describe('composição por operação', () => {
  it('N1 × 2 multiplica os materiais e a regra; poste × 3 multiplica material e mão de obra', () => {
    const itens = preencher();
    expect(itens.materiais).toContainEqual({ material_id: 'm', quantidade: 6 });
    expect(itens.materiais).toContainEqual({ material_id: 'p', quantidade: 3 });
    expect(itens.mao_obra).toContainEqual({ mao_obra_id: 'mo1', quantidade: 4 });
    expect(itens.mao_obra).toContainEqual({ mao_obra_id: 'mo2', quantidade: 9 });
  });
  it('mantém dois cabos de 50 e 52 m nos materiais e usa 52 m para a mesma regra', () => {
    const itens = preencher();
    expect(itens.materiais).toContainEqual({ material_id: 'c1', quantidade: 50 });
    expect(itens.materiais).toContainEqual({ material_id: 'c2', quantidade: 52 });
    expect(itens.mao_obra).toContainEqual({ mao_obra_id: 'mo3', quantidade: 52 });
  });
  it('o máximo é por regra: cabos em regras diferentes mantêm metragens próprias', () => {
    const base = { ...catalogos, regras: [{ ...catalogos.regras[2], material_ids: ['c1'] }, { ...catalogos.regras[2], id: 'r4', material_id: 'c2', material_ids: ['c2'], saidas: [{ mao_obra_id: 'mo2', quantidade: 2 }] }] };
    const itens = gerarSugestoes(base, 'I', { ...fontes, estruturas: [], postes: [] });
    expect(itens.mao_obra).toEqual([{ mao_obra_id: 'mo3', quantidade: 50 }, { mao_obra_id: 'mo2', quantidade: 104 }]);
  });
  it('gatilho de material da estrutura usa a quantidade de estruturas, sem contar a composição duas vezes', () => {
    const base = { ...catalogos, regras: [{ ...catalogos.regras[0], tipo_gatilho: 'material' as const, estrutura_id: null, material_id: 'm' }] };
    expect(gerarSugestoes(base, 'I', fontes).mao_obra).toEqual([{ mao_obra_id: 'mo1', quantidade: 4 }]);
  });
  it('gatilho de contexto cabo usa a maior metragem e respeita a operação', () => {
    const base = { ...catalogos, regras: [{ ...catalogos.regras[2], tipo_gatilho: 'contexto' as const, categorias: ['cabo' as const], operacoes: ['D' as const] }] };
    expect(gerarSugestoes(base, 'I', fontes).mao_obra).toEqual([]);
    expect(gerarSugestoes(base, 'D', fontes).mao_obra).toEqual([{ mao_obra_id: 'mo3', quantidade: 52 }]);
  });
  it('mantém ajustes e exclusões manuais ao alterar fontes e recalcula somente linhas ainda automáticas', () => {
    const original = preencher();
    const editada = { ...original, materiais: original.materiais.map(i => i.material_id === 'm' ? { ...i, quantidade: 99 } : i), mao_obra: original.mao_obra.filter(i => i.mao_obra_id !== 'mo1') };
    const nova = atualizarFontes(catalogos, 'I', editada, { ...fontes, estruturas: [{ estrutura_id: 'e1', quantidade: 4 }], postes: [{ material_id: 'p', quantidade: 5 }] });
    expect(nova.materiais.find(i => i.material_id === 'm')?.quantidade).toBe(99);
    expect(nova.materiais.find(i => i.material_id === 'p')?.quantidade).toBe(5);
    expect(nova.mao_obra.some(i => i.mao_obra_id === 'mo1')).toBe(false);
    expect(nova.mao_obra.find(i => i.mao_obra_id === 'mo2')?.quantidade).toBe(15);
  });
  it('retirar uma fonte remove seus itens automáticos e conserva materiais manuais', () => {
    const inicial = preencher();
    const editada = { ...inicial, materiais: [...inicial.materiais, { material_id: 'avulso', quantidade: 2 }] };
    const nova = atualizarFontes(catalogos, 'I', editada, { estruturas: [], postes: [], cabos: [] });
    expect(nova.materiais).toEqual([{ material_id: 'avulso', quantidade: 2 }]);
    expect(nova.mao_obra).toEqual([]);
  });
  it('agrega a mesma saída de regras distintas e expande cada estrutura uma vez por seleção', () => {
    const base = { ...catalogos, estruturas: [...catalogos.estruturas, { ...catalogos.estruturas[0], id: 'e2', nome: 'N2' }], regras: [{ ...catalogos.regras[0], estrutura_ids: ['e1', 'e2'] }] };
    const itens = gerarSugestoes(base, 'I', { estruturas: [{ estrutura_id: 'e1', quantidade: 2 }, { estrutura_id: 'e2', quantidade: 3 }], postes: [], cabos: [] });
    expect(itens.materiais).toEqual([{ material_id: 'm', quantidade: 15 }]);
    expect(itens.mao_obra).toEqual([{ mao_obra_id: 'mo1', quantidade: 10 }]);
  });
  it('rejeita referências ausentes, categoria errada e quantidades inválidas', () => {
    expect(() => gerarSugestoes(catalogos, 'I', { ...fontes, estruturas: [{ estrutura_id: 'falta', quantidade: 1 }] })).toThrow('Estrutura');
    expect(() => gerarSugestoes(catalogos, 'I', { ...fontes, cabos: [{ material_id: 'p', quantidade: 2 }] })).toThrow('categoria cabo');
    for (const quantidade of [0, -1, NaN, Infinity]) expect(() => gerarSugestoes(catalogos, 'I', { ...fontes, postes: [{ material_id: 'p', quantidade }] })).toThrow('Quantidade');
  });
});
describe('resumo das listas finais', () => {
  it('lê exatamente os ajustes finais, sem reconstruir materiais ou regras', () => {
    const editada = { ...preencher(), materiais: [{ material_id: 'm', quantidade: 7 }], mao_obra: [{ mao_obra_id: 'mo1', quantidade: 8 }] };
    const resultado = calcular(editada);
    expect(resultado.materiaisInstalacao).toMatchObject([{ codigo: '900', quantidade: 7 }]);
    expect(resultado.maoObraInstalacao).toMatchObject([{ codigo: 'MO1', quantidade: 8 }]);
    expect(resultado.materiaisInstalacao).toHaveLength(1);
    expect(resultado.maoObraInstalacao).toHaveLength(1);
  });
  it('permite I, D e R no mesmo ponto, mantendo cada operação e origem no detalhamento', () => {
    const resultado = calcularMedicao({ ...catalogos, pranchas: [{ id: 'pdf', nome: 'Projeto.pdf' }], pontos: [{ ...ponto, prancha_id: 'pdf', operacoes: { I: preencher('I'), D: preencher('D'), R: preencher('R') } }] });
    expect(resultado.porPonto.map(p => [p.numeroPonto, p.operacao, p.prancha])).toEqual([['P01', 'I', '1 · Projeto.pdf'], ['P01', 'D', '1 · Projeto.pdf'], ['P01', 'R', '1 · Projeto.pdf']]);
    expect(resultado.materiaisInstalacao.find(m => m.codigo === '900')?.quantidade).toBe(6);
    expect(resultado.materiaisDesativacao.find(m => m.codigo === '900')?.quantidade).toBe(6);
    expect(resultado.maoObraReinstalacao.find(m => m.codigo === 'MO3')?.quantidade).toBe(52);
    expect(resultado.porPonto[2].itens.some(i => i.tipo === 'material')).toBe(false);
    expect(resultado.materiaisReinstalacao).toEqual([]);
  });
  it('soma entre pranchas, preserva casas decimais e ignora pontos pendentes', () => {
    const c: ComposicaoOperacao = { ...composicaoVazia(), materiais: [{ material_id: 'c1', quantidade: .1 }] };
    const pontos = [{ ...ponto, prancha_id: 'pdf1', operacoes: { I: c } }, { ...ponto, id: 'p2', numero: 'P02', prancha_id: 'pdf2', operacoes: { I: { ...c, materiais: [{ material_id: 'c1', quantidade: .2 }] } } }, { ...ponto, id: 'p3', status: 'pendente' as const, operacoes: { I: preencher() } }];
    const resultado = calcularMedicao({ ...catalogos, pontos });
    expect(resultado.materiaisInstalacao[0].quantidade).toBe(.3);
    expect(resultado.metragemLinearTotal).toBe(.3);
    expect(resultado.porPonto).toHaveLength(2);
  });
  it('não recria um serviço removido e não muda a medição quando o catálogo de regras é editado', () => {
    const operacoes = { I: { ...preencher(), mao_obra: [] } };
    const antes = JSON.stringify(operacoes);
    const resultado = calcularMedicao({ ...catalogos, regras: [], estruturas: [], pontos: [{ ...ponto, operacoes }] });
    expect(resultado.maoObraInstalacao).toEqual([]);
    expect(JSON.stringify(operacoes)).toBe(antes);
  });
  it('rejeita itens finais ausentes ou com quantidade inválida', () => {
    expect(() => calcular({ ...preencher(), materiais: [{ material_id: 'ausente', quantidade: 1 }] })).toThrow('Material');
    expect(() => calcular({ ...preencher(), mao_obra: [{ mao_obra_id: 'ausente', quantidade: 1 }] })).toThrow('Mão de obra');
    expect(() => calcular({ ...preencher(), materiais: [{ material_id: 'm', quantidade: -1 }] })).toThrow('Quantidade');
  });
  it('migra as seleções antigas para sua aba e preserva materiais e serviços avulsos', () => {
    const antiga = { ...ponto, operacao: 'D' as const, estrutura_id: 'e1', poste_id: 'p', cabos_ids: ['c1', 'c2'], metragem_linear: 50, materiais_adicionais: [{ material_id: 'm', quantidade: 2 }], mao_obra_adicional: [{ mao_obra_id: 'mo1', quantidade: 1 }] };
    const op = obterOperacoesPonto(antiga, catalogos);
    expect(Object.keys(op)).toEqual(['D']);
    expect(op.D?.materiais).toContainEqual({ material_id: 'm', quantidade: 5 });
    expect(op.D?.mao_obra).toContainEqual({ mao_obra_id: 'mo1', quantidade: 3 });
    expect(op.D?.mao_obra).toContainEqual({ mao_obra_id: 'mo3', quantidade: 50 });
  });
  it('abre rascunho antigo incompleto sem perder a seleção que precisa de correção', () => {
    const op = obterOperacoesPonto({ ...ponto, status: 'pendente', cabos_ids: ['c1'], metragem_linear: 0 }, catalogos);
    expect(op.I?.cabos).toEqual([{ material_id: 'c1', quantidade: 0 }]);
  });
});

it('em reinstalação só sugere mão de obra e aceita material apenas incluído manualmente', () => {
  const r = preencher('R');
  expect(r.materiais).toEqual([]);
  expect(r.base.materiais).toEqual([]);
  expect(r.mao_obra.find(i => i.mao_obra_id === 'mo3')?.quantidade).toBe(52);
  const comMaterial = { ...r, materiais: [{ material_id: 'm', quantidade: 2 }] };
  const resultado = calcularMedicao({ ...catalogos, pontos: [{ ...ponto, operacoes: { R: comMaterial } }] });
  expect(resultado.materiaisInstalacao).toEqual([]);
  expect(resultado.materiaisDesativacao).toEqual([]);
  expect(resultado.materiaisReinstalacao).toMatchObject([{ codigo: '900', quantidade: 2 }]);
});
it('regra de cabo usa o máximo dos metros medidos mesmo quando há cabo na composição de uma estrutura', () => {
  const base = { ...catalogos, estruturas: [{ ...catalogos.estruturas[0], itens: [{ material_id: 'c1', quantidade: 30 }] }] };
  const gerado = gerarSugestoes(base, 'I', { estruturas: [{ estrutura_id: 'e1', quantidade: 2 }], postes: [], cabos: [{ material_id: 'c2', quantidade: 52 }] });
  expect(gerado.mao_obra.find(i => i.mao_obra_id === 'mo3')?.quantidade).toBe(60);
});
it('migra mão de obra de regras acionadas somente por materiais avulsos antigos', () => {
  const base = { ...catalogos, regras: [{ ...catalogos.regras[1], material_id: 'm' }] };
  const op = obterOperacoesPonto({ ...ponto, materiais_adicionais: [{ material_id: 'm', quantidade: 5 }] }, base);
  expect(op.I?.materiais).toEqual([{ material_id: 'm', quantidade: 5 }]);
  expect(op.I?.mao_obra).toEqual([{ mao_obra_id: 'mo2', quantidade: 3 }]);
});
