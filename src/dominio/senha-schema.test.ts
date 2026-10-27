import { expect, it } from 'vitest';
import { novaSenhaSchema } from './senha-schema';
it('exige senha com oito caracteres e confirmação correspondente', () => {
  expect(novaSenhaSchema.safeParse({ senha: 'Teste#2026', confirmacao: 'Teste#2026' }).success).toBe(true);
  for (const dados of [{ senha: 'curta', confirmacao: 'curta' }, { senha: 'Teste#2026', confirmacao: 'Diferente#2026' }, { senha: 'Teste#2026', confirmacao: '' }]) expect(novaSenhaSchema.safeParse(dados).success).toBe(false);
});
