import { loadEnv } from 'vite';
const env = loadEnv('development', process.cwd(), '');
const url = env.VITE_SUPABASE_URL?.trim();
const chave = env.VITE_SUPABASE_ANON_KEY?.trim();
if (!url || !chave) {
  console.error('Conexão pendente: preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local.');
  process.exitCode = 1;
} else {
  try {
    const origem = new URL(url);
    if (!['http:', 'https:'].includes(origem.protocol)) throw new Error('Use uma URL HTTP ou HTTPS.');
    // A chave nunca é exibida. Este diagnóstico apenas consulta serviços; não cria usuários nem registros.
    const resposta = await fetch(new URL('/auth/v1/health', origem), { headers: { apikey: chave }, signal: AbortSignal.timeout(10000) });
    if (!resposta.ok) throw new Error(`O serviço Auth respondeu HTTP ${resposta.status}. Confira a URL e a chave pública.`);
    console.log(`Supabase acessível: ${origem.hostname}. Auth respondeu HTTP ${resposta.status}.`);
    console.log('As tabelas e as políticas RLS devem ser verificadas com uma sessão autenticada.');
  } catch (erro) {
    console.error(`Falha de conexão: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`);
    process.exitCode = 1;
  }
}
