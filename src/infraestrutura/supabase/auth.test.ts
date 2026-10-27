import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), onAuthStateChange: vi.fn() }));
vi.mock('./cliente', () => ({ supabase: { auth: mocks } }));
import { atualizarSenha, observarSessao, solicitarRedefinicaoSenha } from './auth';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { location: { origin: 'https://usuario.github.io', hash: '' } });
  vi.stubEnv('BASE_URL', '/obras2/');
  mocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  mocks.updateUser.mockResolvedValue({ data: {}, error: null });
});
it('envia link para a raiz correta do Pages sem alterar a senha ou a sessão do administrador', async () => {
  await solicitarRedefinicaoSenha('usuario@example.com');
  expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('usuario@example.com', { redirectTo: 'https://usuario.github.io/obras2/' });
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
it('propaga falhas do envio em vez de indicar sucesso', async () => {
  mocks.resetPasswordForEmail.mockResolvedValueOnce({ error: new Error('Limite de envios') });
  await expect(solicitarRedefinicaoSenha('usuario@example.com')).rejects.toThrow('Limite');
});
it('atualiza a senha somente pela sessão corrente e propaga sessão expirada', async () => {
  await atualizarSenha('SenhaDeTeste#2026');
  expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'SenhaDeTeste#2026' });
  mocks.updateUser.mockResolvedValueOnce({ error: new Error('Sessão expirada') });
  await expect(atualizarSenha('OutraSenha#2026')).rejects.toThrow('Sessão expirada');
});
it('entrega o evento PASSWORD_RECOVERY ao app e libera a inscrição', () => {
  const unsubscribe = vi.fn(); let listener: (evento: string, sessao: unknown) => void = () => {};
  mocks.onAuthStateChange.mockImplementationOnce(callback => { listener = callback; return { data: { subscription: { unsubscribe } } }; });
  const callback = vi.fn(); const limpar = observarSessao(callback);
  listener('PASSWORD_RECOVERY', { user: { email: 'usuario@example.com', id: 'uuid' } });
  expect(callback).toHaveBeenCalledWith('usuario@example.com', 'uuid', 'PASSWORD_RECOVERY');
  limpar(); expect(unsubscribe).toHaveBeenCalled();
});
