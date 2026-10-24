# Publicar no GitHub Pages

O projeto está pronto para publicação como site estático. O frontend fica no Pages e o login/catálogos continuam no Supabase existente. Não é necessário instalar servidor, banco ou Homebrew no GitHub.

## 1. Criar o repositório e configurar o Pages

Crie um repositório vazio no GitHub, por exemplo `obras`, sem README inicial. Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.

No plano GitHub Free, use repositório público para Pages. Outros planos permitem Pages em repositórios privados. Veja a [documentação oficial](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## 2. Configurar o Supabase no GitHub Actions

Em **Settings → Secrets and variables → Actions → Secrets → New repository secret**, cadastre:

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | O valor da mesma variável no `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | A chave pública publishable/anon do `.env.local` |

Também são aceitas Repository variables com esses nomes. As variáveis são incorporadas ao JavaScript durante o build; use somente a chave pública. A chave secret/service_role e senhas não devem ser utilizadas. As permissões continuam protegidas por RLS e pelas funções do Supabase.

O workflow recusa publicação se a configuração estiver ausente ou a chave for de servidor. Em pull requests, roda testes e build sem acesso às credenciais de publicação.

O caminho é automático:

| Repositório | Endereço | Base |
| --- | --- | --- |
| `usuario/obras` | `https://usuario.github.io/obras/` | `/obras/` |
| `usuario/outro-nome` | `https://usuario.github.io/outro-nome/` | `/outro-nome/` |
| `usuario/usuario.github.io` | `https://usuario.github.io/` | `/` |

Se usar domínio próprio, configure o domínio em **Settings → Pages** e crie a Repository variable `VITE_BASE_PATH` com valor `/`. Ela também permite sobrescrever o caminho em configurações especiais.

## 3. Enviar o código

O Git local já está inicializado, ainda sem commits ou remoto. Na raiz do projeto, substitua `SEU_USUARIO/SEU_REPOSITORIO` pelo destino real:

```bash
git branch -M main
git add .
git status --short
git commit -m "Prepara aplicação Obras para GitHub Pages"
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Se o Git pedir identidade, configure seu nome/e-mail antes do commit. Se já existir remoto `origin`, confira `git remote -v` e ajuste o endereço existente em vez de adicionar outro.

O `.gitignore` mantém `.env.local`, dependências, `dist`, backups e toda a pasta local `base-exemplo` fora do repositório. Nenhum arquivo local foi apagado. O conversor e seus testes usam dados sintéticos e continuam funcionando sem a base original. Os três testes adicionais da carga real são opcionais: rodam localmente quando o arquivo convertido existe e são marcados como ignorados no CI. As migrações SQL e os testes de políticas acompanham o código, mas o workflow não executa migrações nem altera os dados do banco.

## 4. Conferir a publicação e ajustar o login

Acompanhe **Actions → Verificar e publicar no GitHub Pages**. Depois dos testes e build, o job `deploy` publica somente `dist/`. O endereço aparece na execução e em **Settings → Pages**. Novos pushes para `main` atualizam o site; a execução manual também está disponível na aba Actions.

No Supabase, em **Authentication → URL Configuration**:

- Ajuste **Site URL** para a URL final, como `https://SEU_USUARIO.github.io/obras/`.
- Adicione a mesma URL em **Redirect URLs** para confirmação de e-mail. Preserve as URLs de desenvolvimento que você ainda usa.

Não recrie tabelas nem execute novamente o schema ou a importação no banco existente. A conta Pedro e as permissões já configuradas continuam válidas no site publicado.

As abas usam HashRouter, por exemplo `/obras/#/resumo`, sem precisar de servidor com fallback de rotas. O worker do PDF é compilado junto ao site. PDF e medição salvos no localhost não migram automaticamente: cada origem e navegador têm seus próprios dados locais.

## Verificar localmente

```bash
npm ci
npm test
npm run test:importacao
npm run build:pages
npm run preview
```

O comando `build:pages` lê o `.env.local` no computador e valida a configuração. No GitHub ele usa os secrets/variables. O Node do CI está fixado na linha 22 em `.nvmrc`.

Referências: [deploy do Vite](https://vite.dev/guide/static-deploy#github-pages), [workflow do Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
