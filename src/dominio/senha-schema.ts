import { z } from 'zod';
export const novaSenhaSchema = z.object({
  senha: z.string().min(8, 'Use ao menos 8 caracteres.'),
  confirmacao: z.string().min(1, 'Confirme a nova senha.'),
}).refine(dados => dados.senha === dados.confirmacao, { path: ['confirmacao'], message: 'As senhas precisam ser iguais.' });
