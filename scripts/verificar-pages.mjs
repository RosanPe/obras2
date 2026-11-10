import { pathToFileURL } from 'node:url';

export async function verificarOrigemPages(env = process.env, requisitar = fetch) {
  const repositorio = env.GITHUB_REPOSITORY;
  if (!repositorio || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repositorio)) throw new Error('GITHUB_REPOSITORY ausente ou inválido.');
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN ausente para consultar a configuração do Pages.');
  const settings = `https://github.com/${repositorio}/settings/pages`;
  const resposta = await requisitar(`https://api.github.com/repos/${repositorio}/pages`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resposta.ok) throw new Error(`Não foi possível consultar o Pages (HTTP ${resposta.status}). Confira pages: read e habilite o site em ${settings}.`);
  const configuracao = await resposta.json();
  if (configuracao.build_type !== 'workflow') throw new Error(`Origem incorreta do GitHub Pages: ${configuracao.build_type ?? 'não informada'}. Abra ${settings} e selecione Build and deployment → Source → GitHub Actions. A publicação pela branch/Jekyll pode sobrescrever dist e causar tela branca. Depois execute novamente este workflow.`);
  return configuracao;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await verificarOrigemPages(); console.log('Origem do Pages validada: GitHub Actions.'); }
  catch (erro) { console.error(erro instanceof Error ? erro.message : 'Falha ao verificar a origem do Pages.'); process.exitCode = 1; }
}
