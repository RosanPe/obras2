export type Operacao = 'I' | 'D' | 'R';
export type Categoria = 'cabo' | 'poste' | 'geral';
export interface Material { id: string; codigo: string; descricao: string; categoria: Categoria }
export interface MaoObra { id: string; codigo: string; descricao: string }
export interface Estrutura { id: string; nome: string; itens: { material_id: string; quantidade: number }[] }
export interface Regra { id: string; nome: string; tipo_gatilho: 'material' | 'estrutura' | 'contexto'; material_id: string | null; estrutura_id: string | null; material_ids?: string[]; estrutura_ids?: string[]; categorias: Categoria[]; operacoes: Operacao[]; saidas: { mao_obra_id: string; quantidade: number }[] }
export interface Catalogos { materiais: Material[]; maoObra: MaoObra[]; estruturas: Estrutura[]; regras: Regra[] }
export interface PontoMedicao {
  id: string; numero: string; pagina: number; x_percent: number; y_percent: number;
  status: 'pendente' | 'validado'; operacao: Operacao;
  estrutura_id: string | null; estruturas_secundarias: string[]; poste_id: string | null;
  cabos_ids: string[];
  metragem_linear: number;
  mao_obra_adicional: { mao_obra_id: string; quantidade: number }[];
}
export interface LinhaResultado { codigo: string; descricao: string; unidade: string; quantidade: number }
export interface ResultadoPorPonto { numeroPonto: string; pagina: number; operacao: Operacao; estrutura: string | null; metragemLinear: number; itens: (LinhaResultado & { tipo: 'material' | 'mao_obra' })[] }
export interface ResultadoMedicao {
  metragemLinearTotal: number;
  materiaisInstalacao: LinhaResultado[]; materiaisDesativacao: LinhaResultado[];
  maoObraInstalacao: LinhaResultado[]; maoObraDesativacao: LinhaResultado[]; maoObraReinstalacao: LinhaResultado[];
  porPonto: ResultadoPorPonto[];
}
