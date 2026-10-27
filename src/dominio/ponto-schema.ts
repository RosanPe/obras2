import { z } from 'zod';
export const pontoFormularioSchema = z.object({
  numero: z.string().trim().min(1, 'Informe o número do ponto.'),
  operacao: z.enum(['I', 'D', 'R']),
  estruturas: z.array(z.string().min(1)),
  poste_id: z.string().nullable(), cabos_ids: z.array(z.string().min(1)),
  metragem_linear: z.number().finite('Informe uma metragem válida.').nonnegative('A metragem não pode ser negativa.'),
  materiais_adicionais: z.array(z.object({ material_id: z.string().min(1), quantidade: z.number().finite().positive('Informe uma quantidade positiva para o material.') })),
  mao_obra_adicional: z.array(z.object({ mao_obra_id: z.string().min(1), quantidade: z.number().finite().positive('Informe uma quantidade positiva para a mão de obra.') })),
});
export const pontoValidadoSchema = pontoFormularioSchema.superRefine((dados, contexto) => {
  if (dados.cabos_ids.length && dados.metragem_linear <= 0) contexto.addIssue({ code: 'custom', path: ['metragem_linear'], message: 'Informe a metragem linear, maior que zero, para os cabos selecionados.' });
  if (!dados.estruturas.length && !dados.poste_id && !dados.cabos_ids.length && !dados.mao_obra_adicional.length && !dados.materiais_adicionais.length) contexto.addIssue({ code: 'custom', path: ['root', 'validacao'], message: 'Adicione uma estrutura, poste, cabo, material ou mão de obra para validar o ponto.' });
});
export type FormularioPonto = z.infer<typeof pontoFormularioSchema>;
