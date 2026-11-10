# Obras - Medicao

Aplicação para medir obras de redes de distribuição de energia diretamente nas pranchas PDF do projeto. O usuário marca pontos no croqui, preenche as operações de cada ponto, confere materiais e mão de obra e exporta a medição consolidada em Excel.

**O resumo e o Excel usam exclusivamente as listas finais salvas de Materiais e Mão de obra dos pontos validados.** As regras ajudam a preencher essas listas; não são executadas novamente ao gerar o resumo.

- Repositório: [RosanPe/obras2](https://github.com/RosanPe/obras2).
- Endereço de publicação: [rosanpe.github.io/obras2](https://rosanpe.github.io/obras2/).
- [Guia de publicação](docs/GITHUB-PAGES.md) e [histórico/pendências](docs/ROADMAP.md).

## Funcionalidades

- Vários PDFs na mesma obra, com seleção de prancha e página.
- Marcação por clique, edição e reposicionamento dos pontos sobre o desenho.
- Movimento do PDF pelo botão direito, zoom pela roda, pinça no celular, enquadramento e área expandida.
- Abas **Instalado**, **Desativado** e **Reinstalado** no mesmo ponto.
- Quantidade individual de estruturas/postes e metragem individual dos cabos.
- Materiais e mão de obra preenchidos pelas regras, com inclusão, alteração e exclusão manual nas listas finais.
- Resumo alfabético, mão de obra consolidada das três operações e detalhamento por ponto no Excel.
- Rascunhos, validação, restauração local e botão **Nova medição** com confirmação.
- Catálogos compartilhados no Supabase, com escrita restrita a usuários autorizados.
- Auditoria exclusiva do administrador, concessão/revogação de permissões e envio de link para redefinir senha.
- Tema claro/escuro, janela do ponto arrastável/redimensionável no computador e painel inferior no celular.

## Onde os dados ficam

| Dados | Armazenamento |
| --- | --- |
| Conta e autenticação | Supabase Auth |
| Materiais, mão de obra, estruturas, regras e composições | Supabase Postgres |
| Permissões e histórico de alterações dos catálogos | Supabase Postgres |
| PDFs, pontos, operações, quantidades finais e resumo corrente | Somente no navegador, via IndexedDB |
| Resultado exportado | Arquivo Excel baixado pelo usuário |

PDFs e medições não são enviados ao Supabase. O trabalho local pertence à origem do site e ao navegador/dispositivo, não à conta: sair não apaga a obra, mas entrar em outro computador não transfere a medição. O localhost e o site publicado têm dados locais separados. Limpar os dados do navegador remove o trabalho local; exporte o Excel ao concluir.

## Executar localmente

### Requisitos

- Node.js **22.12 ou superior** e npm; o CI usa a linha **22**, indicada em [.nvmrc](.nvmrc).
- Python 3 para testar o conversor ou converter uma base de importação.
- Navegador com suporte a PDF.js, canvas e IndexedDB.

No Ubuntu com Homebrew, Node.js pode ser instalado com `brew install node`. As bibliotecas da aplicação são instaladas pelo npm.

```bash
git clone https://github.com/RosanPe/obras2.git
cd obras2
npm ci
cp .env.example .env.local
```

Preencha `.env.local` com os valores do seu projeto:

```dotenv
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
VITE_BASE_PATH=/obras/
```

Use a chave pública **publishable** ou **anon**. As variáveis `VITE_` são incorporadas ao frontend; não use chave secret/service_role nem senhas nesse arquivo de configuração do cliente.

```bash
npm run dev
```

Abra o endereço exibido pelo Vite, normalmente `http://localhost:5173/obras/`. O nome do repositório é `obras2`, mas o caminho padrão de desenvolvimento continua `/obras/`; o workflow detecta o caminho de produção automaticamente. Reinicie o Vite depois de alterar variáveis de ambiente.

Sem URL/chave do Supabase, o carregamento de PDFs e os rascunhos locais funcionam, mas não há catálogo fictício nem edição anônima no banco.

### Comandos disponíveis

| Comando | Finalidade |
| --- | --- |
| `npm ci` | Instalar as dependências fixadas no lockfile |
| `npm run dev` | Iniciar o desenvolvimento com Vite |
| `npm test` | Executar os testes Vitest |
| `npm run test:watch` | Executar Vitest em modo de acompanhamento |
| `npm run test:importacao` | Executar os testes Python do conversor |
| `npm run verificar:supabase` | Consultar a saúde do Auth sem imprimir a chave |
| `npm run build` | Verificar TypeScript e gerar `dist/` |
| `npm run build:pages` | Validar a configuração pública, resolver o caminho e compilar para Pages |
| `npm run preview` | Conferir localmente o build de `dist/` |

O diagnóstico `verificar:supabase` não cria usuários nem registros. Acesso às tabelas e permissões dependem de uma sessão autenticada.

## Fluxo de medição

### Pranchas e navegação

1. Clique em **Carregar PDFs** e selecione um ou vários arquivos.
2. Use **Adicionar PDFs** para incluir outras pranchas sem apagar as anteriores.
3. Escolha o arquivo no seletor **Prancha** e navegue pelas páginas com as setas ou o seletor de página.
4. Clique no desenho para criar um ponto. Clique num marcador existente para editar ou arraste o marcador com o botão esquerdo para reposicioná-lo.

Cada ponto pertence a uma prancha e página. Somente os marcadores da página atual aparecem sobre o desenho; a numeração dos pontos é única em toda a obra. Arquivos com nomes iguais são distinguidos pelo índice da prancha.

| Ação | Controle |
| --- | --- |
| Criar ponto / abrir ponto existente | Clique esquerdo |
| Reposicionar marcador | Arrastar o marcador com o botão esquerdo |
| Mover o PDF | Segurar o botão direito e arrastar |
| Movimento temporário com botão esquerdo | Segurar Espaço com o croqui em foco |
| Aproximar / afastar | Roda do mouse, botões ou slider de zoom |
| Navegar no celular | Arrastar a folha e usar pinça com dois dedos |
| Ajustar a visualização | Enquadrar, Largura ou clicar no percentual para 100% |
| Ampliar a área de trabalho | Botão de expandir/recolher |

A tela não tem bloco de contadores nem seletor de modos. **Gerar resumo** fica ao lado de **Nova medição**. Somente a página atual do PDF é renderizada, com limite de pixels do canvas e ajuste de nitidez após o zoom.

### Operações no mesmo ponto

O formulário abre em **Instalado** e oferece três abas independentes:

| Aba | Uso |
| --- | --- |
| Instalado | Materiais e serviços de instalação |
| Desativado | Materiais e serviços de desativação |
| Reinstalado | Serviços de reinstalação; materiais somente por inclusão manual |

Um único marcador pode ter as três operações. Trocar de aba conserva as edições da janela. **Salvar e validar** grava e valida todas as operações preenchidas; **Salvar rascunho** grava o ponto como pendente e o exclui da medição até ser validado novamente. Fechar ou cancelar a janela não confirma as edições em andamento.

O número do ponto é obrigatório e não pode repetir outro ponto da obra. As quantidades devem ser finitas e positivas. Para validar, pelo menos uma operação precisa ter materiais ou mão de obra nas listas finais.

### Seleções e listas finais

Na parte superior da operação, adicione **estruturas**, **postes** e **cabos**. Cada linha permite editar a quantidade e remover a seleção. Cabos usam metros na própria linha, sem campo de metragem compartilhada.

As seleções preenchem duas listas de conferência:

- **Materiais:** quantidades que serão medidas nessa operação.
- **Mão de obra:** serviços e quantidades que serão medidos nessa operação.

Nessas listas finais é possível adicionar itens avulsos, alterar quantidades e excluir itens sugeridos. **É exatamente o conteúdo final salvo e validado que entra no resumo e no Excel.** Alterar essas listas não dispara novas regras automaticamente.

A busca combina código, descrição e nome, sem depender de acentos, caixa ou ordem dos termos. Exemplos: `N` encontra N1/N2/N3/N4; `11200` encontra um poste com nomenclatura `11/200`; `alum 2/0 ca` encontra cabo com esses termos. Setas e Enter permitem escolher um resultado.

## Regras de preenchimento

### Estruturas e postes

- **Estrutura N1 × 2:** multiplica por 2 os materiais da composição e as quantidades de saída das regras correspondentes.
- **Poste × 3:** gera 3 unidades do material e multiplica por 3 a saída da regra correspondente.
- Se vários componentes da mesma estrutura correspondem à mesma regra, a estrutura contribui uma vez pela quantidade selecionada, evitando repetição por vínculos alternativos.
- Regras podem usar material, estrutura ou contexto/categoria como gatilho e restringir as operações I/D/R.

### Cabos e maior metragem por regra

Cada cabo conserva sua quantidade nos materiais. Cabos que acionam a **mesma regra** usam a maior metragem para a mão de obra dessa regra:

| Seleção | Material | Mão de obra da mesma regra, com coeficiente 1 |
| --- | --- | --- |
| Cabo 2: 50 m | 50 m do cabo 2 | |
| Cabo 2/0: 52 m | 52 m do cabo 2/0 | **52**, considerando os dois cabos |

Uma saída com coeficiente 2 geraria 104 de serviço nesse exemplo. Regras distintas conservam seus próprios gatilhos e máximos. Cabos presentes na composição de estruturas também são considerados pelos metros medidos, agrupados por material.

### Reinstalado

Estruturas, postes e cabos nessa aba preenchem automaticamente **somente a mão de obra**. A lista de materiais começa vazia.

Se precisar medir materiais reinstalados, adicione-os manualmente na lista final. Quando houver itens, o resumo e o Excel mostram **Materiais Reinstalação** separadamente, sem misturá-los com instalação ou desativação.

### Edições manuais e alterações posteriores nas regras

As regras são usadas para preencher sugestões quando as seleções são feitas ou alteradas. Linhas ainda automáticas acompanham as mudanças de quantidade das seleções. Quantidades modificadas manualmente e exclusões nas listas finais são preservadas.

Gerar o resumo ou exportar o Excel não executa as regras novamente. Alterar o cadastro de uma regra ou a composição de uma estrutura também não modifica automaticamente as quantidades finais já salvas nos pontos.

## Resumo e Excel

**Gerar resumo** considera os pontos validados de todas as pranchas e páginas. Se houver pendentes, pede confirmação para continuar sem eles. Alterar um ponto salvo invalida o resumo anterior; gere-o novamente depois de concluir a revisão.

As listas são ordenadas alfabeticamente pela descrição, com busca, ordenação e rolagem interna:

| Lista / aba do Excel | Conteúdo |
| --- | --- |
| Materiais Instalação | Materiais finais das operações Instalado |
| Materiais Desativação | Materiais finais das operações Desativado |
| Materiais Reinstalação | Materiais incluídos manualmente em Reinstalado; aparece somente quando há itens |
| Mão de Obra | Serviços consolidados das três operações |
| Por Ponto | Detalhamento dos itens finais por ponto e operação; disponível no Excel |

O arquivo é baixado como `medicao_YYYY-MM-DD_HHmm.xlsx`. Sem materiais reinstalados, são quatro abas; com materiais reinstalados, são cinco. Códigos são texto e quantidades são células numéricas.

**Por Ponto** registra número do ponto, página, operação, estruturas/quantidades, tipo, código, descrição, unidade, quantidade, metragem linear e prancha. O mesmo ponto pode ter linhas I/D/R. A metragem linear corresponde ao maior comprimento de cabo das listas finais daquela operação e é preenchida apenas na primeira linha da combinação ponto/operação; a célula L2 mostra a soma dessas metragens.

Unidades padrão: **UN** para materiais gerais/postes, **m** para cabos e **SV** para mão de obra. Os catálogos não têm campo de unidade; os totais por unidade são mantidos separados.

## Persistência, migração e nova medição

PDFs, pontos, operações, listas finais, prancha/página ativa e resultado são restaurados via IndexedDB. Falhas de persistência aparecem na interface. As gravações são serializadas para evitar sobrescritas entre alterações concorrentes; se a adição de PDFs falhar por falta de espaço, os arquivos anteriores são preservados.

- **Nova medição:** pede confirmação e limpa todos os PDFs, pontos e resumo locais. Mantém a sessão, os catálogos e o tema.
- **Remover prancha atual:** pede confirmação e exclui somente o PDF escolhido e seus pontos, invalidando o resumo.
- **Adicionar PDFs:** valida o lote antes de adicionar os arquivos e preserva as outras pranchas.

O PDF único de versões antigas é migrado para a primeira prancha. Ao carregar os catálogos, pontos do modelo anterior são organizados na aba da operação correspondente, mantendo posição, página, vínculos e itens avulsos. Estruturas/postes recebem quantidade 1 e os cabos mantêm os comprimentos antigos. As listas são preenchidas segundo as regras atuais; o aviso de atualização pede conferir as quantidades e gerar o resumo novamente. Pontos com medidas antigas incompatíveis podem exigir revisão como rascunho. Depois de convertidos, os ajustes finais salvos não são recalculados ao abrir a obra.

A reformulação dos pontos usa a versão local 6 e não exige mudança no banco do Supabase.

## Catálogos e permissões

A aba **Cadastros** permite consultar materiais, mão de obra, estruturas e regras. Usuários autorizados também podem criar, editar e excluir registros. Estruturas e regras têm editores de composição com busca; são salvas por RPCs transacionais.

| Perfil | Permissões |
| --- | --- |
| Usuário autenticado comum | Consultar catálogos, marcar pontos, medir e exportar |
| Editor autorizado | Permissões comuns e criação/edição/exclusão de catálogos |
| Administrador super/master | Acesso total e auditoria, gestão de usuários/permissões e solicitação de link de senha |

Os catálogos são compartilhados entre contas autenticadas. `user_id` identifica o criador do registro. A RLS e as funções do banco validam a escrita; ocultar botões na interface não é a única proteção. Acesso anônimo aos catálogos é bloqueado, e metadados enviados no cadastro não promovem usuários.

A conta master atual é `pedro.hrosan@hotmail.com`. A migração administrativa vincula o UUID dessa conta à tabela protegida de administradores. Conceder edição a outro usuário não o transforma em super.

## Administração, auditoria e senha

A aba **Auditoria**, exclusiva do super, oferece:

- **Usuários e permissões:** consulta das contas e concessão/revogação de edição dos catálogos.
- **Todos os registros:** consulta dos catálogos atuais, incluindo suas composições.
- **Histórico de alterações:** criação, edição, exclusão e mudanças de permissão, com autor, data e dados anteriores/novos. O histórico começa na ativação da auditoria e não é retroativo.

PDFs e pontos de outros navegadores não são centralizados nessa página.

Na linha de uma conta, **Redefinir senha** solicita confirmação e envia um pedido de recuperação ao Supabase Auth. Antes do envio, o repositório consulta novamente a função protegida de usuários para obter o e-mail real do destinatário. A solicitação não troca a sessão do administrador nem define uma senha por ele.

O destinatário abre o link recebido e preenche **Nova senha** e **Confirmar nova senha**, com no mínimo oito caracteres. A tela trata o evento `PASSWORD_RECOVERY`, erros do provedor e links inválidos/expirados. A entrega real depende do serviço de e-mail configurado no Supabase.

## Configurar o Supabase

### Banco existente deste projeto

O banco utilizado no desenvolvimento já recebeu o schema, as migrações e a carga inicial. Para usar esse mesmo banco, configure a URL e a chave pública; não reaplique o schema ou a importação sobre os registros existentes.

O registro do MCP do Supabase no Codex não preenche `.env.local`. O frontend precisa da sua própria URL/chave pública.

### Banco novo

Execute no SQL Editor, como administrador e nesta ordem:

1. [schema.sql](supabase/schema.sql): catálogos, composições e políticas iniciais.
2. [catalogos_crud.sql](supabase/migrations/20261024_catalogos_crud.sql): funções de gravação dos editores.
3. [permissoes_catalogos.sql](supabase/migrations/20261024_permissoes_catalogos.sql): catálogos compartilhados e edição restrita.
4. [regras_multiplos_alvos.sql](supabase/migrations/20261024_regras_multiplos_alvos.sql): vínculos alternativos das regras.
5. [categoria_cabo_unica.sql](supabase/migrations/20261024_categoria_cabo_unica.sql): cadastro de cabos somente por categoria, sem exigir BT/MT.
6. Crie a conta master `pedro.hrosan@hotmail.com` no Supabase Auth, pelo cadastro da aplicação ou pelo painel. Confirme o e-mail quando essa opção estiver habilitada.
7. [administracao_super.sql](supabase/migrations/20261024_administracao_super.sql): administrador, auditoria e RPCs de gestão. Essa migração exige que a conta master já exista.

As migrações são scripts de evolução do schema e não devem ser reaplicadas indiscriminadamente. A coluna histórica `tipo_cabo` permanece no banco para compatibilidade da carga antiga, mas não é exigida nem consultada pelo aplicativo.

### Autenticação e links de retorno

Em **Authentication → URL Configuration**, configure:

- **Site URL:** `https://rosanpe.github.io/obras2/` para a publicação deste repositório.
- **Redirect URLs:** a mesma raiz de produção e as URLs locais que forem utilizadas, como `http://localhost:5173/obras/`.

Os links de confirmação e recuperação precisam retornar a uma URL permitida. O pedido de redefinição usa a origem e o caminho base da página do administrador: para enviar links destinados ao site publicado, use o botão nesse site. Habilite e-mail/senha no Auth e configure o serviço de envio de e-mail conforme o ambiente.

A primeira concessão de edição também pode ser feita pelo SQL Editor, quando necessário:

```sql
insert into public.catalogo_permissoes(user_id, pode_editar)
select id, true from auth.users where email = 'EMAIL_DO_EDITOR'
on conflict (user_id) do update set pode_editar = true;
```

No uso normal, o master gerencia essas permissões pela Auditoria. Os testes [permissoes.sql](supabase/tests/permissoes.sql) e [administracao.sql](supabase/tests/administracao.sql), executados como postgres, validam as políticas em transações revertidas.

## Publicar e atualizar no GitHub Pages

O remoto do projeto é `git@github.com:RosanPe/obras2.git`, e a branch de publicação é **main**.

1. Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.
2. Em **Settings → Secrets and variables → Actions**, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` como repository secrets ou variables, usando a URL e a chave pública do ambiente desejado.
3. Faça o commit e envie para `main`.
4. Acompanhe **Actions → Verificar e publicar no GitHub Pages** e confira a conclusão do job `deploy`.

```bash
git status
git add README.md docs src public index.html
git commit -m "Atualiza aplicação e documentação"
git push origin main
```

O workflow instala pelo lockfile, executa os testes Vitest/Python, valida a configuração, compila e publica somente **dist/**. Ele não aplica migrações nem altera o banco. Pull requests executam testes/build sem receber os secrets de publicação.

O caminho de produção acompanha o nome do repositório: em `RosanPe/obras2`, usa `/obras2/`. Repositórios `<usuario>.github.io` usam `/`. Para domínio próprio, configure o domínio no Pages e a repository variable `VITE_BASE_PATH=/`.

`.env.local`, `node_modules`, `dist`, caches, backups e a pasta `base-exemplo/` são ignorados pelo Git. Em upload manual pelo navegador, esses arquivos precisam ser excluídos da seleção: o uploader não aplica o `.gitignore`. Inclua os arquivos ocultos necessários, como `.github/workflows/deploy.yml` e `.nvmrc`.

O [guia complementar](docs/GITHUB-PAGES.md) detalha o procedimento. O HashRouter mantém as rotas como `/obras2/#/resumo`, sem depender de fallback no servidor.

### Tela branca ou `%BASE_URL%` no endereço do favicon

Se o site publicado ainda contém `%BASE_URL%favicon.svg` ou tenta carregar `/src/main.tsx`, está servindo o HTML fonte, sem o build do Vite.

O workflow verifica a origem do Pages e interrompe com uma mensagem clara se ela ainda estiver em publicação por branch. Essa verificação não altera configurações administrativas. Confira **Settings → Pages → Source = GitHub Actions** e execute novamente **Verificar e publicar no GitHub Pages** na `main`. A publicação padrão de uma branch com Jekyll pode concorrer com o workflow da aplicação e substituir o site compilado pelo conteúdo da raiz. Aguarde o deploy e recarregue com `Ctrl + Shift + R`.

## Testes e verificações

A suíte cobre geração de sugestões, quantidades de estruturas/postes, máximo dos cabos por regra, listas finais editadas, três operações no mesmo ponto, consolidação, Excel, validações, migração, persistência, permissões e recuperação de senha.

Há três verificações adicionais da carga real que rodam apenas quando existe o arquivo local `base-exemplo/convertida/catalogos-supabase.json`. No CI, esses testes são ignorados; os demais testes usam dados independentes dessa base. O conversor Python também usa dados sintéticos.

A reformulação atual foi verificada com **87 testes Vitest locais**, além do build para Pages. O fluxo no navegador foi conferido em perfil isolado no computador e celular, incluindo arraste com botão direito, I/D/R, edição/exclusão manual, recuperação após reload e conferência do Excel. Os testes de redefinição de senha usam API simulada, sem envio de e-mails ou alteração de senhas reais. Testes de permissão no Supabase foram feitos em transações revertidas.

## Base de exemplo e conversor

A carga inicial trouxe **633 materiais únicos, 483 serviços, 59 estruturas e 65 regras**, com UUIDs v4 novos. Foram preservados 554 itens de estrutura, 97 saídas e 444 alvos de regras; 14 códigos repetidos da origem foram unificados. Essas são contagens históricas da importação, não totais fixos do catálogo atual.

A pasta `base-exemplo/` e os artefatos da carga ficam somente no computador que realizou a importação. O conversor não acessa a rede nem usa senha. Para preparar outra carga, use um backup atualizado e um diretório de saída novo:

```bash
python3 scripts/converter-base.py \
  --entrada CAMINHO_DA_BASE.json \
  --backup CAMINHO_DO_BACKUP_ATUAL.json \
  --saida DIRETORIO_NOVA_CARGA \
  --usuario-id UUID_DO_EDITOR
```

Confira o relatório, os vínculos e o SQL gerado antes de aplicar uma nova importação. Os arquivos locais da carga anterior incluem relatório, mapa de IDs e SQL de reversão; a reversão não foi executada nesta atualização.

## Estrutura do projeto

```text
src/
  dominio/                     tipos, constantes e validações
  aplicacao/                   sugestões, listas finais, resumo e testes
  infraestrutura/
    local/                     IndexedDB, migração e preferências
    supabase/                  Auth, cliente e repositórios
    exportacao/                Excel e detalhamento por ponto
  interface/
    componentes/               croqui, ponto, busca, resumo e editores
    paginas/                   login, recuperação de senha, cadastros e auditoria
    store/                     estado e persistência da medição/catálogos
  estilos/                     estilos e responsividade
public/                        favicon
scripts/                       build Pages, diagnóstico e conversor
supabase/                      schema, migrações e testes de políticas
.github/workflows/             verificação e publicação
docs/                          publicação e histórico/pendências
```

Frontend: React 18, TypeScript, Vite, Tailwind, componentes shadcn/ui, Zustand, React Hook Form, Zod, TanStack Table, Lucide e Sonner. PDFs: PDF.js, react-zoom-pan-pinch e react-rnd. Persistência local: idb-keyval. Backend: Supabase Auth/Postgres. Exportação: SheetJS.

O [inicio.md](inicio.md) registra o escopo original; decisões posteriores, como catálogos compartilhados, mão de obra unificada, múltiplas pranchas e listas finais por operação, estão refletidas neste README e no código atual.

## Pendências e limites conhecidos

- Importação/exportação CSV de catálogos pela interface.
- Detecção automática de círculos vermelhos e relatório em PDF.
- Sincronização de obras entre dispositivos e importação de um Excel para retomar o trabalho não estão implementadas.
- Cache de páginas e outras melhorias de navegação constam no [roadmap](docs/ROADMAP.md).
- Somente a página atual é renderizada, mas o peso dos PDFs e a memória do dispositivo influenciam a fluidez. O cenário de 10 pranchas e 350 pontos ainda não tem benchmark documentado.
