import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cadastrar, entrar } from '../../infraestrutura/supabase/auth';
import { Button } from '../componentes/ui/button';
const schema = z.object({ email: z.string().email('Informe um e-mail válido.'), senha: z.string().min(8, 'Use ao menos 8 caracteres.') });
export function Login() {
  const [cadastro, setCadastro] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return <main className="login"><div className="login-card panel"><Zap size={32} className="text-primary" /><p className="eyebrow">OBRAS / MEDIÇÃO NO CROQUI</p><h1>{cadastro ? 'Crie sua conta' : 'Entre para medir'}</h1><p className="muted">Seus catálogos na nuvem. O croqui e a medição ficam neste navegador.</p>
    <form onSubmit={handleSubmit(async dados => { try { if (cadastro) { await cadastrar(dados.email, dados.senha); toast.success('Conta criada. Confira seu e-mail para confirmar o acesso.'); } else await entrar(dados.email, dados.senha); } catch (erro) { toast.error(erro instanceof Error ? erro.message : 'Falha na autenticação.'); } })}>
      <label>E-mail<input type="email" autoComplete="email" {...register('email')} /></label><small className="error">{errors.email?.message}</small>
      <label>Senha<input type="password" autoComplete={cadastro ? 'new-password' : 'current-password'} {...register('senha')} /></label><small className="error">{errors.senha?.message}</small>
      <Button disabled={isSubmitting} type="submit">{isSubmitting ? 'Aguarde…' : cadastro ? 'Criar conta' : 'Entrar'}</Button>
    </form><Button variant="ghost" onClick={() => setCadastro(!cadastro)}>{cadastro ? 'Já tenho uma conta' : 'Criar uma conta'}</Button></div></main>;
}
