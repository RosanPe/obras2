# Estado da implementação

O documento `inicio.md` permanece como especificação completa. Esta etapa avançou o croqui e os cadastros, sem alterar os serviços de hospedagem previstos.

## Implementado nesta etapa

- Área do PDF maior e modo expandido, com a janela do ponto acima do desenho.
- Modos Mover, Marcar ponto e Editar pontos; primeiro PDF abre em Marcar.
- Pan livre, zoom pela roda, slider, botões e pinça pelo react-zoom-pan-pinch; enquadramento e ajuste à largura.
- Rasterização em canvas separado, debounce e limite de pixels, preservando o desenho durante o zoom.
- Criação imediata da janela ao marcar, fallback de UUID para HTTP na rede local, marcadores com tamanho constante, prévia de arraste e destaque de edição.
- CRUD de materiais e mão de obra, filtro de categoria e tabelas com busca/ordenação.
- Editores de estruturas e regras, busca por código/descrição, composição e quantidades.
- RPCs transacionais aplicadas e verificadas no Supabase, executadas como usuário autenticado sob RLS.
- Diagnóstico `npm run verificar:supabase`, sem exibir credenciais.

## Ajustes do formulário do ponto

- Campo de observações retirado.
- Busca por múltiplos termos em qualquer ordem, com código/descrição, acentos e separadores normalizados; destaque das correspondências e seleção pelo teclado.
- Estruturas em lista: digitar, selecionar, adicionar várias e remover individualmente.
- Poste e cabos com a mesma busca (11200 → 11/200; alum 2/0 ca → CABO ALUM CA 2/0).
- Mão de obra adicional por ponto, com vários serviços e quantidade editável, somada às saídas automáticas das regras.
- Sem multiplicador de quantidade de pontos. Busca única de cabos com lista de selecionados e metragem linear compartilhada logo abaixo. Cadastro apenas pela categoria cabo, sem BT/MT. O resumo e o Excel somam o percurso uma vez por ponto, além de consolidar separadamente as quantidades de cada cabo. Totais de unidades diferentes não são misturados no rodapé.
- Atualização dos pontos locais antigos preservando posições e itens; resumo invalidado e pontos com multiplicador antigo devolvidos a rascunho para revisão.

## Resumo e Excel

- Cabeçalho global e apresentação removidos; abas e ações de tema/saída ficam no topo.
- Quadro de metragem linear removido do resumo; cálculo e detalhamento do Excel preservados.

- Materiais de instalação e desativação continuam em abas distintas.
- Mão de obra de I/D/R consolidada em uma única aba, somando serviços iguais e ordenando pela descrição em português.
- Excel com quatro abas: Materiais Instalação, Materiais Desativação, Mão de Obra e Por Ponto.
- O detalhamento por ponto mantém a operação de origem. Medições locais salvas anteriormente continuam compatíveis; nenhuma mudança nos catálogos ou migração de banco foi necessária.

## Validação

- 64 testes Vitest locais (61 no CI e 3 opcionais da base importada) e 6 testes do conversor Python do motor, Excel, geometria, busca por nomenclaturas, formulário do ponto, migração local e validação de catálogos.
- Brave headless no Ubuntu, em perfil isolado: PDF de duas páginas, upload, criação/reedição/arraste de pontos, zoom, pan, área expandida e restauração após reload.
- Buscas N/11200/alum 2/0 ca, adicionar/remover estruturas, seleção por teclado e serviços manuais com quantidades.
- Login real pela interface e criação de cabo sem subtipo no Supabase pelo editor de materiais.
- Campo de metragem logo abaixo da lista de cabos em desktop e viewport mobile. Cada cabo recebe o comprimento informado; o percurso é somado uma vez por ponto no Excel.
- Download real do Excel, reabertura do arquivo e conferência do total linear e das quantidades de material.
- Os registros de teste foram removidos e a sessão temporária encerrada. Testes em aparelhos físicos continuam pendentes.

## Integração Supabase concluída

- Projeto configurado em `.env.local`: Auth e login reais responderam HTTP 200.
- Schema público vazio foi inspecionado antes da instalação. Tabelas, funções e políticas criadas por migração.
- Catálogos compartilhados para consulta de usuários autenticados; criação, edição e exclusão restritas por `catalogo_permissoes`.
- Conta indicada pelo responsável autorizada no banco; nenhuma senha gravada no repositório.
- CRUD real de materiais, mão de obra, estruturas e regras verificado com registros temporários, removidos ao final.
- Rollback de estrutura com referência inválida, proteção de itens vinculados e cascatas verificados.
- Leitor e acesso anônimo verificados por roles SQL: consulta autenticada permitida, escrita/RPC/autopromoção e acesso anônimo bloqueados. O teste usa transação revertida.
- A API mantém PDF, pontos e medição exclusivamente no navegador.

## Base de exemplo carregada

- 633 materiais, 483 serviços, 59 estruturas e 65 regras importados, todos com UUIDs v4 novos.
- 14 códigos repetidos unificados, com remapeamento de todos os IDs antigos; 554 itens de estrutura e 97 saídas de regra preservados.
- 444 alvos válidos preservados, incluindo 47 regras com vínculos múltiplos. O motor mede regras vinculadas a cabos pela soma dos metros dos cabos correspondentes; os demais gatilhos permanecem por ponto. O editor permite revisar todos os alvos.
- Banco e site conferidos: contagens e UUIDs, buscas, abertura de N4 e de regra com 46 materiais, criação/edição de regra temporária com múltiplos alvos e rollback após referência inválida.
- A carga original trouxe 45 cabos com rótulo BT. A distinção BT/MT foi retirada da aplicação: todos aparecem pela categoria cabo. Os metadados históricos no banco e nos artefatos de importação foram preservados.
- Artefatos de conversão, relatório e reversão em `base-exemplo/convertida/`. A reversão não foi executada.

## Próximos itens do escopo

- Importação/exportação CSV; a carga da base de exemplo por conversor já foi concluída.
- Ordenação persistida dos itens de estrutura.
- Bottom sheet com gesto de expansão/recolhimento.
- Cache de páginas do PDF; persistência de zoom e modo nas preferências.
- Drawer de auditoria com miniatura do PDF e destaque da localização.
- Automatizar em CI o fluxo verificado localmente com um Supabase de testes.
- Conferir com exemplos do projeto original: contexto, quantidades e reinstalação.
- Confirmar em integração real que PDF/pontos/medição nunca são enviados ao servidor.
- Workflow Pages preparado e validado localmente. Falta criar/configurar remoto, secrets e Pages, enviar o código e conferir o deploy real.

Detecção automática de círculos e relatório PDF permanecem opcionais de fase 2.


## Administração atualizada

- Auditoria exclusiva da conta Pedro, com validação por UUID no banco, navegação oculta e rota protegida para os demais usuários.
- Listagem de contas e concessão/revogação de direitos para cadastros por funções protegidas. Editores não podem delegar direitos.
- Todos os registros atuais dos catálogos com composição, busca e histórico paginado de alterações a partir da ativação.
- Teste SQL transacional verificou super, editor, revogação, RLS e histórico, com rollback completo.
- Materiais instalados/desativados e mão de obra ordenados pela descrição no resumo e Excel.


## Preparação para GitHub Pages

- CI com Node 22, instalação pelo lockfile, testes Vitest/Python e publicação somente de dist.
- Build de publicação valida URL/chave pública do Supabase e resolve base pelo nome do repositório; raiz e domínio próprio suportados.
- Dados locais, base importada, backups e credenciais ignorados pelo Git. Guia em GITHUB-PAGES.md.
- Sem remoto, push ou publicação nesta preparação.
