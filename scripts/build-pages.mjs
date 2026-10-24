import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';

export function configurarPages(env) {
  let url;
  try { url = new URL(env.VITE_SUPABASE_URL); } catch { throw new Error('Configure VITE_SUPABASE_URL no GitHub Actions.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('VITE_SUPABASE_URL deve ser uma URL HTTPS sem credenciais.');
  const chave = env.VITE_SUPABASE_ANON_KEY ?? '';
  let publica = /^sb_publishable_[A-Za-z0-9_-]+$/.test(chave);
  if (!publica && chave.split('.').length === 3) {
    try { publica = JSON.parse(Buffer.from(chave.split('.')[1], 'base64url')).role === 'anon'; } catch { /* inválida */ }
  }
  if (!publica) throw new Error('Configure VITE_SUPABASE_ANON_KEY com a chave pública publishable ou anon. Chaves secret/service_role não são aceitas.');
  const repositorio = (env.GITHUB_REPOSITORY ?? '').split('/').at(-1);
  const padrao = repositorio ? repositorio.toLowerCase().endsWith('.github.io') ? '/' : `/${repositorio}/` : '/obras/';
  const caminho = env.VITE_BASE_PATH?.trim() || padrao;
  if (!/^\/[A-Za-z0-9_./-]*$/.test(caminho) || caminho.includes('..') || caminho.includes('//')) throw new Error('VITE_BASE_PATH deve ser / ou /nome-do-repositorio/.');
  return { ...env, VITE_BASE_PATH: caminho.endsWith('/') ? caminho : `${caminho}/` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const env = configurarPages({ ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env });
    console.log(`Compilando GitHub Pages no caminho ${env.VITE_BASE_PATH}`);
    const resultado = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', env });
    if (resultado.error) throw resultado.error;
    process.exitCode = resultado.status ?? 1;
  } catch (erro) {
    console.error(erro.message);
    process.exitCode = 1;
  }
}
