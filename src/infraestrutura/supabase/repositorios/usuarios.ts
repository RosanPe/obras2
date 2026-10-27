import { listarUsuarios } from './permissoes';
import { solicitarRedefinicaoSenha } from '../auth';
export async function enviarLinkSenhaUsuario(userId: string) {
  // A RPC valida o super no banco e fornece o e-mail real; não confiar no e-mail da linha da UI.
  const usuarios = await listarUsuarios();
  const usuario = usuarios.find(u => u.user_id === userId);
  if (!usuario?.email) throw new Error('Usuário não encontrado ou sem e-mail cadastrado.');
  await solicitarRedefinicaoSenha(usuario.email);
}
