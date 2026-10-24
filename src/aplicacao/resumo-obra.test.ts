import { describe, expect, it } from 'vitest';
import { consolidarMaoObra, obterResumoObra } from './resumo-obra';
import type { LinhaResultado, ResultadoMedicao } from '../dominio/tipos';
const servico = (codigo: string, descricao: string, quantidade: number): LinhaResultado => ({ codigo, descricao, quantidade, unidade: 'SV' });
const vazio: ResultadoMedicao = { metragemLinearTotal: 0, materiaisInstalacao: [], materiaisDesativacao: [], maoObraInstalacao: [], maoObraDesativacao: [], maoObraReinstalacao: [], porPonto: [] };
describe('resumo único de mão de obra', () => {
  it('soma o mesmo serviço das três operações, inclusive frações', () => {
    expect(consolidarMaoObra({ maoObraInstalacao: [servico('001', 'Instalar poste', .1)], maoObraDesativacao: [servico('001', 'Instalar poste', .2)], maoObraReinstalacao: [servico('001', 'Instalar poste', 2.5)] })).toEqual([servico('001', 'Instalar poste', 2.8)]);
  });
  it('ordena pela descrição em português, independentemente do código', () => {
    const resultado = { ...vazio, maoObraInstalacao: [servico('001', 'Zelar pela rede', 1)], maoObraDesativacao: [servico('900', 'Árvore: retirada', 2)], maoObraReinstalacao: [servico('050', 'Abrir conexão', 3)] };
    expect(consolidarMaoObra(resultado).map(l => l.descricao)).toEqual(['Abrir conexão', 'Árvore: retirada', 'Zelar pela rede']);
  });
  it('preserva as duas listas de materiais e não altera a medição salva', () => {
    const resultado = { ...vazio, materiaisInstalacao: [{ codigo: 'P01', descricao: 'Poste', unidade: 'UN', quantidade: 1 }], materiaisDesativacao: [{ codigo: 'P02', descricao: 'Poste antigo', unidade: 'UN', quantidade: 2 }], maoObraInstalacao: [servico('001', 'Serviço', 1)], maoObraDesativacao: [servico('001', 'Serviço', 2)] };
    const antes = JSON.stringify(resultado); const resumo = obterResumoObra(resultado);
    expect(resumo.materiaisInstalacao).toEqual(resultado.materiaisInstalacao);
    expect(resumo.materiaisDesativacao).toEqual(resultado.materiaisDesativacao);
    expect(resumo.maoObra).toEqual([servico('001', 'Serviço', 3)]);
    expect(JSON.stringify(resultado)).toBe(antes);
  });
  it('ordena ambos os materiais pela descrição sem modificar as entradas', () => {
    const linhas = [servico('001', 'Zebra', 1), servico('999', 'Árvore', 2), servico('400', 'Abrir', 1)];
    const resultado = { ...vazio, materiaisInstalacao: linhas, materiaisDesativacao: linhas };
    const resumo = obterResumoObra(resultado);
    expect(resumo.materiaisInstalacao.map(l => l.codigo)).toEqual(['400', '999', '001']);
    expect(resumo.materiaisDesativacao).toEqual(resumo.materiaisInstalacao);
    expect(linhas[0].codigo).toBe('001');
  });
  it('gera lista vazia se não houver serviços e não une códigos diferentes', () => {
    expect(consolidarMaoObra(vazio)).toEqual([]);
    expect(consolidarMaoObra({ ...vazio, maoObraInstalacao: [servico('1', 'Mesmo nome', 1), servico('2', 'Mesmo nome', 2)] })).toHaveLength(2);
  });
});
