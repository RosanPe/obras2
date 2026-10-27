import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('./permissoes', () => ({ listarUsuarios: vi.fn() }));
vi.mock('../auth', () => ({ solicitarRedefinicaoSenha: vi.fn() }));
import { listarUsuarios } from './permissoes';
import { solicitarRedefinicaoSenha } from '../auth';
import { enviarLinkSenhaUsuario } from './usuarios';
beforeEach(() => vi.resetAllMocks());
it('resolve o destinatário pelo registro protegido do banco', async () => {
  vi.mocked(listarUsuarios).mockResolvedValue([{ user_id: 'u', email: 'destino@example.com', criado_em: '', ultimo_acesso: null, pode_editar: false, super: false }]);
  await enviarLinkSenhaUsuario('u');
  expect(solicitarRedefinicaoSenha).toHaveBeenCalledWith('destino@example.com');
});
it('não solicita envio se o banco negar acesso a um usuário sem direito super', async () => {
  vi.mocked(listarUsuarios).mockRejectedValue(new Error('Acesso exclusivo do administrador'));
  await expect(enviarLinkSenhaUsuario('u')).rejects.toThrow('Acesso exclusivo');
  expect(solicitarRedefinicaoSenha).not.toHaveBeenCalled();
});
it('não envia para um destinatário inexistente ou sem e-mail', async () => {
  vi.mocked(listarUsuarios).mockResolvedValue([]);
  await expect(enviarLinkSenhaUsuario('inexistente')).rejects.toThrow('Usuário não encontrado');
  expect(solicitarRedefinicaoSenha).not.toHaveBeenCalled();
});
