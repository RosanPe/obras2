import { expect, it, vi } from 'vitest';
import { verificarOrigemPages } from './verificar-pages.mjs';
const env = { GITHUB_REPOSITORY: 'RosanPe/obras2', GITHUB_TOKEN: 'token-ficticio' };
it('permite publicação apenas quando a origem é workflow', async () => {
  const requisitar = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ build_type: 'workflow' }) });
  await expect(verificarOrigemPages(env, requisitar)).resolves.toEqual({ build_type: 'workflow' });
});
it('bloqueia origem legacy com a instrução e o link correto de configuração', async () => {
  const requisitar = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ build_type: 'legacy' }) });
  await expect(verificarOrigemPages(env, requisitar)).rejects.toThrow('https://github.com/RosanPe/obras2/settings/pages');
});
it('não aceita resposta desconhecida nem oculta erro de autorização', async () => {
  await expect(verificarOrigemPages(env, vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))).rejects.toThrow('Origem incorreta');
  await expect(verificarOrigemPages(env, vi.fn().mockResolvedValue({ ok: false, status: 403 }))).rejects.toThrow('HTTP 403');
});
it('não inclui token no erro de configuração', async () => {
  const requisitar = vi.fn();
  await expect(verificarOrigemPages({ ...env, GITHUB_REPOSITORY: '' }, requisitar)).rejects.toThrow('GITHUB_REPOSITORY');
  expect(requisitar).not.toHaveBeenCalled();
});
