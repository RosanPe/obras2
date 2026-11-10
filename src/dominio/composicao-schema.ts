import { z } from 'zod';
const quantidade = z.number().finite('Informe uma quantidade válida.').positive('A quantidade deve ser maior que zero.');
const material = z.object({ material_id: z.string().min(1), quantidade });
const servico = z.object({ mao_obra_id: z.string().min(1), quantidade });
export const composicaoSchema = z.object({
  estruturas: z.array(z.object({ estrutura_id: z.string().min(1), quantidade })),
  postes: z.array(material), cabos: z.array(material), materiais: z.array(material), mao_obra: z.array(servico),
  base: z.object({ materiais: z.array(material), mao_obra: z.array(servico) }),
});
export const pontoComposicaoSchema = z.object({
  numero: z.string().trim().min(1, 'Informe o número do ponto.'),
  operacoes: z.object({ I: composicaoSchema.optional(), D: composicaoSchema.optional(), R: composicaoSchema.optional() }),
});
export const pontoComposicaoValidadoSchema = pontoComposicaoSchema.refine(dados => Object.values(dados.operacoes).some(o => !!o && (o.materiais.length || o.mao_obra.length)), { path: ['operacoes'], message: 'Adicione materiais ou mão de obra às listas finais de pelo menos uma operação.' });
