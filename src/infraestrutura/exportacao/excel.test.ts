import { expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { criarExcel } from './excel';
import { calcularMedicao } from '../../aplicacao/motor-regras';
import type { PontoMedicao } from '../../dominio/tipos';
it('exporta quatro abas, preserva códigos e quantidades numéricas no arquivo', () => {
  const item = { codigo: '001', descricao: '=texto', unidade: 'UN', quantidade: 2.5 };
  const livro = criarExcel({ metragemLinearTotal: 2.5, materiaisInstalacao: [item], materiaisDesativacao: [], maoObraInstalacao: [], maoObraDesativacao: [], maoObraReinstalacao: [], porPonto: [{ numeroPonto: 'P01', pagina: 2, operacao: 'I', estrutura: null, metragemLinear: 2.5, itens: [{ ...item, tipo: 'material' }] }] });
  const reaberto = XLSX.read(XLSX.write(livro, { type: 'array', bookType: 'xlsx' }));
  expect(reaberto.SheetNames).toEqual(['Materiais Instalação', 'Materiais Desativação', 'Mão de Obra', 'Por Ponto']);
  expect(reaberto.Sheets['Por Ponto'].F2.v).toBe('001');
  expect(reaberto.Sheets['Por Ponto'].I2.v).toBe(2.5);
  expect(reaberto.Sheets['Por Ponto'].G2.f).toBeUndefined();
});
it('exporta mão de obra única em ordem alfabética, somando I/D/R e preservando materiais e operações por ponto', () => {
  const z = { codigo: '001', descricao: 'Zelar pela rede', unidade: 'SV', quantidade: 1 };
  const a = { codigo: '900', descricao: 'Árvore: retirada', unidade: 'SV', quantidade: 2 };
  const b = { codigo: '050', descricao: 'Abrir conexão', unidade: 'SV', quantidade: 3 };
  const resultado = {
    metragemLinearTotal: 0,
    materiaisInstalacao: [{ codigo: 'MI', descricao: 'Poste novo', unidade: 'UN', quantidade: 2 }, { codigo: 'ZZ', descricao: 'Abraçadeira', unidade: 'UN', quantidade: 4 }],
    materiaisDesativacao: [{ codigo: 'MD', descricao: 'Poste antigo', unidade: 'UN', quantidade: 3 }, { codigo: 'ZZ', descricao: 'Cabo antigo', unidade: 'm', quantidade: 5 }],
    maoObraInstalacao: [z], maoObraDesativacao: [a, { ...z, quantidade: 2 }], maoObraReinstalacao: [b, { ...z, quantidade: 4 }],
    porPonto: (['I', 'D', 'R'] as const).map((operacao, i) => ({ numeroPonto: `P0${i + 1}`, pagina: 1, operacao, estrutura: null, metragemLinear: 0, itens: [{ ...z, tipo: 'mao_obra' as const }] })),
  };
  const livro = XLSX.read(XLSX.write(criarExcel(resultado), { type: 'array', bookType: 'xlsx' }));
  expect(livro.SheetNames).toEqual(['Materiais Instalação', 'Materiais Desativação', 'Mão de Obra', 'Por Ponto']);
  expect(XLSX.utils.sheet_to_json(livro.Sheets['Mão de Obra'])).toEqual([
    { Código: '050', Descrição: 'Abrir conexão', Unidade: 'SV', Quantidade: 3 },
    { Código: '900', Descrição: 'Árvore: retirada', Unidade: 'SV', Quantidade: 2 },
    { Código: '001', Descrição: 'Zelar pela rede', Unidade: 'SV', Quantidade: 7 },
  ]);
  expect(livro.Sheets['Materiais Instalação'].B2.v).toBe('Abraçadeira');
  expect(livro.Sheets['Materiais Instalação'].D3.v).toBe(2);
  expect(livro.Sheets['Materiais Desativação'].B2.v).toBe('Cabo antigo');
  expect(livro.Sheets['Materiais Desativação'].D3.v).toBe(3);
  expect(XLSX.utils.sheet_to_json<Record<string, unknown>>(livro.Sheets['Por Ponto']).map(p => p.Operação)).toEqual(['I', 'D', 'R']);
});
it('leva a soma de metros e serviços manuais ao consolidado e ao detalhamento', () => {
  const ponto: PontoMedicao = { id: 'p1', numero: 'P01', pagina: 1, x_percent: .2, y_percent: .3, operacao: 'I', status: 'validado', estrutura_id: null, estruturas_secundarias: [], poste_id: null, cabos_ids: ['bt'], metragem_linear: 12.5, mao_obra_adicional: [{ mao_obra_id: 'mo', quantidade: 2 }] };
  const resultado = calcularMedicao({ materiais: [{ id: 'bt', codigo: 'BT-01', descricao: 'CABO ALUM CA 2/0', categoria: 'cabo' }], maoObra: [{ id: 'mo', codigo: 'MO-01', descricao: 'Serviço adicional' }], estruturas: [], regras: [], pontos: [ponto, { ...ponto, id: 'p2', numero: 'P02', metragem_linear: 7.25 }] });
  const livro = XLSX.read(XLSX.write(criarExcel(resultado), { type: 'array', bookType: 'xlsx' }));
  expect(livro.Sheets['Por Ponto'].L2.v).toBe(19.75);
  const detalhe = XLSX.utils.sheet_to_json<Record<string, unknown>>(livro.Sheets['Por Ponto']);
  expect(detalhe.reduce((soma, linha) => soma + Number(linha['Metragem linear (m)'] ?? 0), 0)).toBe(19.75);
  expect(livro.Sheets['Materiais Instalação'].C2.v).toBe('m');
  expect(livro.Sheets['Materiais Instalação'].D2.v).toBe(19.75);
  expect(livro.Sheets['Mão de Obra'].D2.v).toBe(4);
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(livro.Sheets['Por Ponto']);
  expect(linhas.filter(l => l.Tipo === 'Material').map(l => [l.Ponto, l.Quantidade, l.Unidade])).toEqual([['P01', 12.5, 'm'], ['P02', 7.25, 'm']]);
  expect(linhas.filter(l => l.Tipo === 'Mão de Obra')).toHaveLength(2);
});

it('exporta a origem das pranchas sem misturar as páginas de PDFs diferentes', () => {
  const ponto: PontoMedicao = { id: 'a', numero: 'P01', pagina: 1, x_percent: .5, y_percent: .5, status: 'validado', operacao: 'I', estrutura_id: null, estruturas_secundarias: [], poste_id: null, cabos_ids: [], metragem_linear: 0, mao_obra_adicional: [], materiais_adicionais: [{ material_id: 'm', quantidade: 2 }] };
  const resultado = calcularMedicao({ materiais: [{ id: 'm', codigo: '001', descricao: 'Material', categoria: 'geral' }], maoObra: [], estruturas: [], regras: [], pranchas: [{ id: 'pdf-a', nome: 'A.pdf' }, { id: 'pdf-b', nome: 'B.pdf' }], pontos: [{ ...ponto, prancha_id: 'pdf-a' }, { ...ponto, id: 'b', numero: 'P02', prancha_id: 'pdf-b' }] });
  const livro = XLSX.read(XLSX.write(criarExcel(resultado), { type: 'array', bookType: 'xlsx' }));
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(livro.Sheets['Por Ponto']);
  expect(linhas.map(l => [l.Prancha, l.Página, l.Quantidade])).toEqual([['1 · A.pdf', 1, 2], ['2 · B.pdf', 1, 2]]);
  expect(livro.Sheets['Materiais Instalação'].D2.v).toBe(4);
});
