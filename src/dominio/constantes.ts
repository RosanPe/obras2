import type { Catalogos } from './tipos';
export const UNIDADE_MATERIAL = 'UN';
export const UNIDADE_CABO = 'm';
export const UNIDADE_MAO_OBRA = 'SV';
export const CATALOGOS_VAZIOS: Catalogos = { materiais: [], maoObra: [], estruturas: [], regras: [] };
export const OPERACOES = { I: 'Instalação', D: 'Desativação', R: 'Reinstalação' } as const;
export const ABAS_RESULTADO = [
  ['materiaisInstalacao', 'Materiais Instalação'], ['materiaisDesativacao', 'Materiais Desativação'],
  ['maoObra', 'Mão de Obra'],
] as const;
