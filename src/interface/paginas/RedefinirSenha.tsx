import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { z } from 'zod';
import { novaSenhaSchema } from '../../dominio/senha-schema';
import { atualizarSenha } from '../../infraestrutura/supabase/auth';
import { Button } from '../componentes/ui/button';
export function RedefinirSenha({ email, concluir }: { email: string | null; concluir: () => void }) {
  const [erro, setErro] = useState('');
  const [concluido, setConcluido] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof novaSenhaSchema>>({ resolver: zodResolver(novaSenhaSchema) });
  return <main className="login"><section className="login-card panel"><KeyRound size={32} className="text-primary" /><p className="eyebrow">OBRAS / ACESSO</p><h1>{concluido ? 'Senha atualizada' : 'Definir nova senha'}</h1>
    {!email ? <><p className="error mt-4" role="alert">O link é inválido ou expirou. Solicite um novo link ao administrador e abra-o pelo e-mail recebido.</p><Button className="mt-4" variant="outline" onClick={concluir}>Voltar ao acesso</Button></> : concluido ? <><p className="muted mt-4" role="status">Sua senha foi atualizada com sucesso.</p><Button className="mt-4" onClick={concluir}>Continuar para a medição</Button></> : <><p className="muted">Escolha a nova senha para {email}.</p><form onSubmit={handleSubmit(async dados => {
      setErro('');
      try { await atualizarSenha(dados.senha); reset(); setConcluido(true); }
      catch (e) { setErro(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Não foi possível atualizar a senha. Solicite um novo link se a sessão expirou.'); }
    })}>
      <label>Nova senha<input type="password" autoComplete="new-password" {...register('senha')} aria-invalid={!!errors.senha} /></label>{errors.senha && <small className="error" role="alert">{errors.senha.message}</small>}
      <label>Confirmar nova senha<input type="password" autoComplete="new-password" {...register('confirmacao')} aria-invalid={!!errors.confirmacao} /></label>{errors.confirmacao && <small className="error" role="alert">{errors.confirmacao.message}</small>}
      {erro && <p className="error" role="alert">{erro}</p>}<Button disabled={isSubmitting} type="submit">{isSubmitting ? 'Atualizando…' : 'Salvar nova senha'}</Button>
    </form></>}
  </section></main>;
}
