# Obras · Medição no croqui

Aplicação SPA para medir redes de distribuição diretamente sobre um PDF técnico. O escopo completo está em [inicio.md](inicio.md). A etapa atual inclui croqui interativo e editores de catálogos conectados ao Supabase, com consulta para usuários autenticados e edição restrita a contas autorizadas.

## Executar no Ubuntu

Node.js e npm são as únicas ferramentas de sistema necessárias. Se usar Homebrew: `brew install node`. O CI utiliza Node 22; o desenvolvimento inicial também foi verificado com Node 26 instalado pelo Homebrew.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abra o endereço exibido pelo Vite, normalmente `http://localhost:5173/obras/`. Sem credenciais do Supabase, a aplicação abre em ambiente local: carregamento de PDF e rascunhos funcionam; não há catálogo fictício nem escrita anônima.

```bash
npm test
npm run build
npm run preview
```

O lockfile fixa as versões verificadas. O override de `postcss-selector-parser` usa a versão corrigida com Tailwind 3. Não é necessária nenhuma outra instalação pelo Homebrew nesta etapa.

## O que funciona nesta etapa

- Base Vite + React 18 + TypeScript, Tailwind, botão shadcn/ui, HashRouter e tema claro/escuro.
- Login, cadastro por e-mail e senha, logout e carregamento dos catálogos, quando o Supabase estiver configurado.
- PDF.js com worker local, upload sem servidor e navegação de páginas. Área de trabalho ampliada, opção de expandir, modos Mover / Marcar ponto / Editar pontos, roda e slider de zoom de 10% a 800%, enquadramento e ajuste à largura. Pan livre e pinça com react-zoom-pan-pinch; rasterização nítida após o zoom, sem esconder a folha a cada gesto. Apenas a página atual é renderizada, com limite de pixels do canvas para conter o uso de memória.
- Pontos com coordenadas relativas, criação por clique no modo Marcar, reposicionamento com prévia por arraste em qualquer modo, tamanho constante no zoom e destaque do ponto em edição. Janela arrastável/redimensionável no desktop e painel inferior no mobile; exclusão, rascunho e validação. Identificadores funcionam também em HTTP na rede local.
- PDF, pontos e último resumo restaurados via IndexedDB. Falhas de persistência aparecem na interface. Alterar um ponto invalida o resumo anterior.
- Motor puro com testes: estruturas, materiais diretos, cabos por metragem, regras, operações, serviços manuais, consolidação e detalhamento.
- Três tabelas de resumo com busca/ordenação via TanStack Table: materiais de instalação, materiais de desativação e mão de obra única em ordem alfabética; Excel com quatro abas, inclusive **Por Ponto**. Auditoria administrativa exclusiva do super, com registros, histórico e gestão de permissões.
- Cadastros com criação, edição, exclusão, busca e ordenação; filtro de categoria para materiais. Editores de composição de estruturas e regras com busca por código/descrição e quantidades. Estruturas e regras são salvas por RPCs transacionais.
- Schema de catálogos compartilhados com RLS e permissão de edição controlada no banco; workflow de verificação e publicação no Pages.

Autenticação, CRUD dos quatro catálogos, RPCs, rollback e políticas de consulta/edição foram verificados no Supabase real. Os testes usam registros temporários removidos ao final. A base de exemplo foi convertida e carregada no Supabase. A importação/exportação CSV continua pendente. Veja [docs/ROADMAP.md](docs/ROADMAP.md) antes de considerar o aplicativo pronto para produção.

## Configurar o Supabase

1. Crie um projeto Supabase e execute [supabase/schema.sql](supabase/schema.sql) uma vez no SQL Editor de um banco novo. O script cria seis tabelas: quatro catálogos e duas tabelas de composição. Não cria projetos, pontos ou medições. Em seguida, execute [a migração dos editores](supabase/migrations/20261024_catalogos_crud.sql), que cria as funções `salvar_estrutura` e `salvar_regra`. Depois execute [a migração de permissões](supabase/migrations/20261024_permissoes_catalogos.sql), que habilita o catálogo compartilhado com edição restrita. Por fim, aplique [a migração de alvos múltiplos](supabase/migrations/20261024_regras_multiplos_alvos.sql), que preserva os vínculos das regras da base importada. Aplique também [a simplificação de cabos](supabase/migrations/20261024_categoria_cabo_unica.sql) para cadastrar cabos somente por categoria. Se as tabelas já existem, revise o schema antes de aplicar; não o execute por cima de um banco existente.
2. Em Authentication, habilite e-mail/senha e configure a Site URL para a URL publicada. Configure as Redirect URLs de localhost e produção se habilitar confirmação de e-mail.
3. Preencha `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (chave pública anon ou publishable). Nunca use uma chave service role no frontend.
4. Execute `npm run verificar:supabase` para testar o serviço Auth sem expor a chave no terminal. Reinicie o Vite. Crie uma conta, confirme o e-mail e faça login.

Registrar o MCP do Supabase no Codex não preenche as variáveis da aplicação. O MCP precisa estar autenticado e suas ferramentas carregadas na sessão; o frontend precisa da URL e da chave pública em `.env.local`, que é ignorado pelo Git. Não coloque senha ou chave service role no frontend.

No cadastro de materiais há código, descrição e categoria, sem tipo de cabo. A coluna histórica `tipo_cabo` foi mantida no banco somente para compatibilidade com os arquivos da carga original; ela não é consultada nem exigida pelo aplicativo.

Os catálogos são compartilhados entre usuários autenticados. `user_id` identifica o criador dos registros; não restringe a leitura. Somente contas com `pode_editar = true` em `catalogo_permissoes` podem criar, editar ou excluir. A função `pode_editar_catalogos()` verifica essa permissão no servidor; os botões da interface e os repositórios também a verificam.

Para autorizar uma conta já existente, execute como administrador no SQL Editor:

```sql
insert into public.catalogo_permissoes(user_id, pode_editar)
select id, true from auth.users where email = 'EMAIL_DO_EDITOR'
on conflict (user_id) do update set pode_editar = true;
```

Novas contas sem essa autorização podem consultar os catálogos e realizar medições normalmente. A tabela de permissões não aceita escrita pela API de usuários; campos enviados no cadastro ou em `user_metadata` não concedem edição. Para revogar, altere `pode_editar` para `false` no banco. O acesso anônimo aos catálogos é bloqueado.

O projeto indicado em `.env.local` já recebeu as tabelas, funções e políticas. A conta indicada pelo responsável foi autorizada. Não reaplique o schema inicial nesse banco. Nenhuma senha foi incluída no código ou nas migrações.

As chamadas de dados passam por `infraestrutura/supabase/repositorios/`; autenticação fica no serviço `auth.ts`. O teste [supabase/tests/permissoes.sql](supabase/tests/permissoes.sql) simula leitor e acesso anônimo, testa a restrição de escrita/RPC e impede autopromoção, revertendo todos os dados de teste ao terminar.

## Interagir com o croqui

A aplicação começa diretamente pelas abas. O cabeçalho de apresentação foi removido; tema e saída ficam ao lado da navegação. No resumo, ficam as tabelas e a exportação, sem quadro de metragem linear.

1. Carregue o PDF. Sem pontos, o modo **Marcar ponto** já vem ativo.
2. Clique sobre um círculo vermelho do desenho. Isso cria um marcador interativo e abre o formulário. Círculos desenhados no arquivo são parte do PDF: a detecção automática ainda não está implementada.
3. Digite para buscar as estruturas, poste, cabos e mão de obra. As estruturas ficam numa lista e podem ser adicionadas/removidas individualmente; os serviços adicionais têm quantidade editável. Informe a **Metragem linear (m)** uma única vez, logo abaixo da lista de cabos. Use a busca **Adicionar cabo** para incluir vários materiais da categoria cabo; esse mesmo comprimento será aplicado a cada cabo adicionado. Não há separação BT/MT. Salve um rascunho ou valide. Clique em qualquer marcador para reabrir, inclusive no modo Mover.

   A busca combina termos em qualquer ordem, sem depender de acentos, caixa e separadores: `N` lista N1, N2, N3, N4; `11200` encontra `POSTE CONCRE DT 11/200`; `alum 2/0 ca` encontra `CABO ALUM CA 2/0`. As setas e Enter permitem selecionar pelo teclado. O formulário do ponto não contém observações.
4. Use **Mover** para arrastar a folha livremente. A roda aumenta/diminui o zoom junto ao cursor; no celular, use dois dedos para pinça. Os botões e o slider também controlam o zoom.
5. **Enquadrar** mostra a folha inteira; **Largura** ajusta ao espaço horizontal; clicar no percentual restaura 100%. O botão no canto superior direito expande a área e mantém a janela do ponto disponível por cima.
6. Para reposicionar um ponto, arraste o próprio marcador. O deslocamento não cria outro ponto. As coordenadas e o tamanho visual continuam corretos com o zoom.

Após focar o desenho, segure Espaço para mover temporariamente; `+` e `-` controlam o zoom. `Esc` fecha a janela; um segundo `Esc`, com o foco no croqui, recolhe a área expandida. `Delete` em um marcador focado pede confirmação de exclusão.

## Regras adotadas nesta etapa

- Apenas pontos validados entram no motor. Um ponto válido tem número único e ao menos uma estrutura, poste, cabo ou serviço adicional. Cada marcador representa um ponto físico; o campo quantidade de pontos foi retirado.
- Cada estrutura adicionada contribui com seus materiais e quantidades cadastradas, uma vez por ponto. O poste direto contribui com uma unidade. Todos os cabos adicionados ao ponto usam a mesma metragem linear, em metros, somada por código no consolidado. O total linear do Excel conta o comprimento de cada ponto uma única vez, independentemente da quantidade de cabos. O resumo não exibe um quadro de metragem linear. A metragem não multiplica os demais materiais. Regras de mão de obra vinculadas a cabos usam os metros dos cabos correspondentes.
- Regras de poste, estrutura e outros materiais aplicam a quantidade da saída uma vez por ponto. Nas regras de material ou contexto vinculadas a cabos, a quantidade da saída é multiplicada pela soma dos metros dos cabos correspondentes. Contexto usa correspondência de **qualquer** categoria selecionada. A mão de obra adicionada manualmente ao ponto soma às regras; se o código coincidir, as quantidades são consolidadas.
- Uma regra pode ter vários materiais ou estruturas alternativos como gatilho. Os alvos não lineares disparam a regra uma vez por ponto. Para cabos, somam-se os metros de cada cabo correspondente, sem repetir o mesmo vínculo.
- A mesma estrutura selecionada como principal e secundária é aplicada uma vez. Um material direto também presente na estrutura soma suas quantidades.
- **Reinstalação (R) gera somente mão de obra**, pois o escopo possui apenas duas listas consolidadas de materiais (I/D). Os materiais da estrutura e diretos continuam servindo de gatilho em R, mas não são exportados como consumo. Esta interpretação precisa de conferência com as regras do projeto original antes do uso real.
- Referências ausentes e quantidades inválidas bloqueiam o cálculo em vez de omitir itens silenciosamente. UN para materiais gerais/postes, m para cabos e SV para serviços estão em `dominio/constantes.ts`. Os rodapés totalizam separadamente cada unidade.

Não foi possível consultar o conteúdo do repositório original durante esta etapa. O motor segue `inicio.md`; compatibilidade com casos reais do projeto original permanece pendente.

## Exportação e dados locais

A mão de obra é apresentada em uma única aba, consolidando as quantidades por código, descrição e unidade, com ordenação alfabética em português. Resumos locais já salvos no formato anterior também usam essa apresentação, sem refazer os pontos. As duas abas de materiais permanecem separadas por instalação/desativação.

Pontos salvos no modelo antigo são atualizados ao restaurar, preservando PDF, posições e seleções. A metragem compartilhada é preservada. As antigas seleções separadas de cabos são restauradas na lista única com os mesmos IDs. Resultados do modelo anterior com metragem linear continuam utilizáveis. Pontos do modelo intermediário com comprimentos BT/MT iguais são unificados; se eram diferentes, voltam a rascunho com metragem zero para o usuário informar o comprimento correto. Apenas resultados de modelos incompatíveis são invalidados para novo cálculo; pontos que usavam multiplicador diferente de 1 também voltam a rascunho para revisão. A atualização aparece num aviso na interface.

Na aba Croqui, valide os pontos e use **Gerar resumo**. Pendentes exigem confirmação para serem excluídos do cálculo. Em Resumo, **Baixar Excel da medição** gera `medicao_YYYY-MM-DD_HHmm.xlsx` com Materiais Instalação, Materiais Desativação, Mão de Obra e Por Ponto. A aba Mão de Obra soma os mesmos serviços das operações I/D/R e ordena pela descrição, em ordem alfabética. Códigos permanecem texto; quantidades são células numéricas. As quatro abas existem mesmo quando vazias. As operações originais continuam registradas no detalhamento Por Ponto. Na aba Por Ponto, a coluna **Metragem linear (m)** é preenchida apenas na primeira linha de cada ponto para permitir soma sem duplicidade; a célula L2 mostra o total linear. Exemplo: um ponto de 25 m com três cabos gera 25 m de cada cabo, mas apenas 25 m de percurso linear.

PDF e medição pertencem ao navegador/dispositivo, não à conta. Sair não apaga o trabalho local. Os itens dos catálogos compartilhados ficam disponíveis às demais contas autenticadas; a medição corrente permanece local ao navegador. Limpar dados do navegador remove a medição; exporte o Excel ao concluir. Trocar o PDF pede confirmação e substitui todos os pontos e o resumo.

## Base de exemplo importada

A base `base-exemplo/base-medicao.json` foi carregada no Supabase: **633 materiais únicos, 483 serviços, 59 estruturas e 65 regras**, com 554 itens de estrutura, 97 saídas e 444 vínculos de gatilho. Os 647 materiais originais tinham 14 códigos repetidos, unificados sem quebrar as referências. Todos os novos IDs são UUIDs v4.

A conversão original preservou os rótulos BT/MT da origem, mas essa distinção foi retirada do aplicativo: os 45 materiais de cabo são consultados e cadastrados apenas pela categoria cabo. A quantidade `3KG` foi normalizada para `3`, três referências inexistentes a `CE1` foram ignoradas e um item repetido em RELIGADOR foi consolidado. Detalhes e arquivos de reversão em `base-exemplo/convertida/LEIA-ME.md` (arquivo local, não versionado).

O conversor não acessa a rede nem usa senha. Para novas cargas, use um backup atualizado e um diretório novo para preservar os manifestos da importação anterior:

```bash
python3 scripts/converter-base.py --entrada base-exemplo/base-medicao.json --backup CAMINHO_DO_BACKUP_ATUAL.json --saida DIRETORIO_NOVA_CARGA --usuario-id UUID_DO_EDITOR
npm run test:importacao
```

A carga foi feita em transação. O SQL de reversão está preparado, mas não foi executado. Não use o backup vazio antigo para gerar outra carga sobre os registros já revisados.

## Publicar no GitHub Pages

O workflow está preparado: testes, build validado e publicação de `dist/` a cada push para `main`. O caminho acompanha automaticamente o nome do repositório. Ainda não há commits, remoto nem site publicado.

Siga o [guia de publicação](docs/GITHUB-PAGES.md): crie o repositório, escolha **GitHub Actions** em Settings → Pages, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nos secrets e envie o código. O guia inclui os comandos Git e o ajuste das URLs de autenticação no Supabase. A configuração segue o [fluxo oficial do Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

`.env.local`, backups e a pasta `base-exemplo/` ficam somente no computador, fora do Git. O `.env.example` contém apenas campos vazios. O workflow não altera o banco nem executa importações.

## Organização

```text
src/dominio/                 tipos e constantes
src/aplicacao/              motor puro e testes
src/infraestrutura/local/    IndexedDB e preferências
src/infraestrutura/supabase/ autenticação e repositórios
src/infraestrutura/exportacao/ Excel e teste de arquivo
src/interface/              componentes, páginas e stores
supabase/schema.sql         tabelas de catálogo e RLS
docs/ROADMAP.md              próximas etapas e validações pendentes
```

As listas de cadastros, resumo e auditoria têm rolagem interna. O e-mail do usuário aparece ao lado do botão de tema. Resumos existentes são recalculados ao abrir a aba com os catálogos carregados, incluindo a exportação.


### Administração e auditoria

A migração [administracao_super.sql](supabase/migrations/20261024_administracao_super.sql) identifica a conta `pedro.hrosan@hotmail.com` pelo UUID no banco e libera a aba Auditoria somente para esse administrador. Editores não podem promover usuários nem consultar contas ou histórico. Pedro pode conceder/revogar edição dos catálogos para usuários já cadastrados. O acesso normal à medição permanece disponível aos demais usuários.

A auditoria reúne todos os registros atuais dos quatro catálogos, composição incluída, além das contas e permissões. O histórico registra criações, edições, exclusões e mudanças de permissão a partir da ativação, com autor, data e dados anteriores/novos. Não há histórico retroativo. PDFs e pontos continuam locais e não são centralizados nesta página. As três listas do resumo e as respectivas abas do Excel começam em ordem alfabética pela descrição.

O teste [administracao.sql](supabase/tests/administracao.sql), executado como postgres em transação revertida, valida acesso super, delegação, revogação, bloqueio de usuários comuns e registro das alterações. Nenhum usuário ou material de teste é mantido.
