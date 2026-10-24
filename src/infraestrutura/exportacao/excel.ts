import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ABAS_RESULTADO } from '../../dominio/constantes';
import { obterResumoObra } from '../../aplicacao/resumo-obra';
import type { ResultadoMedicao, ResultadoPorPonto } from '../../dominio/tipos';
export function linhasPorPonto(pontos: ResultadoPorPonto[]) {
  return pontos.flatMap(p => p.itens.map((item, indice) => ({ Ponto: p.numeroPonto, Página: p.pagina, Operação: p.operacao, Estrutura: p.estrutura ?? '—', Tipo: item.tipo === 'material' ? 'Material' : 'Mão de Obra', Código: item.codigo, Descrição: item.descricao, Unidade: item.unidade, Quantidade: item.quantidade, 'Metragem linear (m)': indice === 0 ? p.metragemLinear : undefined })));
}
const COLUNAS_PONTO = ['Ponto', 'Página', 'Operação', 'Estrutura', 'Tipo', 'Código', 'Descrição', 'Unidade', 'Quantidade', 'Metragem linear (m)'];
function adicionarPontos(livro: XLSX.WorkBook, pontos: ResultadoPorPonto[]) {
  adicionarAba(livro, 'Por Ponto', linhasPorPonto(pontos), COLUNAS_PONTO);
  const aba = livro.Sheets['Por Ponto'];
  XLSX.utils.sheet_add_aoa(aba, [['Metragem linear total (m)'], [Math.round(pontos.reduce((total, p) => total + p.metragemLinear, 0) * 1e8) / 1e8]], { origin: 'L1' });
}
function adicionarAba(livro: XLSX.WorkBook, nome: string, linhas: object[], cabecalho: string[]) {
  const aba = XLSX.utils.json_to_sheet(linhas, { header: cabecalho });
  aba['!cols'] = cabecalho.map(coluna => ({ wch: coluna === 'Descrição' ? 56 : 22 }));
  if (aba['!ref']) aba['!autofilter'] = { ref: aba['!ref'] };
  XLSX.utils.book_append_sheet(livro, aba, nome);
}
export function criarExcel(resultado: ResultadoMedicao) {
  const livro = XLSX.utils.book_new();
  const resumo = obterResumoObra(resultado);
  for (const [chave, nome] of ABAS_RESULTADO) adicionarAba(livro, nome, resumo[chave].map(linha => ({ Código: linha.codigo, Descrição: linha.descricao, Unidade: linha.unidade, Quantidade: linha.quantidade })), ['Código', 'Descrição', 'Unidade', 'Quantidade']);
  adicionarPontos(livro, resultado.porPonto);
  return livro;
}
export function baixarExcel(resultado: ResultadoMedicao) { XLSX.writeFile(criarExcel(resultado), `medicao_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`); }
export function baixarAuditoria(pontos: ResultadoPorPonto[]) {
  const livro = XLSX.utils.book_new();
  adicionarPontos(livro, pontos);
  XLSX.writeFile(livro, `auditoria_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
}
