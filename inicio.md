# PROJETO "MEDIÇÃO DE OBRAS COM CROQUI INTERATIVO"

## 1. CONTEXTO E OBJETIVO

Criar uma aplicação web (SPA) para medição de obras de redes de distribuição de energia elétrica, evoluindo o conceito do projeto https://github.com/RosanPe/obras. O novo diferencial é que a medição passa a ser feita diretamente sobre o croqui da obra (PDF técnico exportado do AutoCAD, contendo pontos vermelhos desenhados em campo). O usuário carrega o PDF localmente, marca/clica nos pontos vermelhos, preenche os dados de cada ponto em uma janela flutuante e, ao final, gera o resumo consolidado de materiais e mão de obra.

**Decisões-chave em relação ao projeto original:**

- **Somente os catálogos (Materiais, Mão de Obra, Estruturas e Regras) são persistidos no Supabase.** Tudo o mais (PDF do croqui, pontos marcados, dados da medição corrente, resultado gerado) fica **apenas no navegador** (memória + IndexedDB). Nada de `projetos`, `pontos` ou `medicoes` no banco.
- A medição **não é salva no servidor**. O usuário baixa o resultado em **Excel** quando quiser. O arquivo Excel tem as mesmas abas do projeto original (materiais de instalação, materiais de desativação, mão de obra de instalação, mão de obra de desativação, mão de obra de reinstalação) **mais uma nova aba "Por Ponto"** com o detalhamento item a item por ponto.
- O sistema herda o conceito do **Motor de Regras** do projeto original (regras que disparam mão de obra a partir de materiais, estruturas ou contexto), mas reescrito em TypeScript puro e testável.
- O foco da medição é: **clicar sobre o croqui, preencher o ponto em uma janela flutuante, validar, e ao final gerar o resumo e o Excel**.
- **Multi-tenant**: cada usuário autenticado tem seu próprio conjunto de catálogos (Materiais, Mão de Obra, Estruturas, Regras) no Supabase, protegidos por RLS.

Deploy: **GitHub Pages** (frontend estático) + **Supabase** (Auth + Postgres) no plano gratuito. PDF e pontos nunca saem do navegador.

---

## 2. STACK TECNOLÓGICA OBRIGATÓRIA

**Frontend**
- Vite + React 18 + TypeScript.
- Tailwind CSS + shadcn/ui (componentes acessíveis e modernos).
- Zustand para estado global (catálogos, pontos, medição corrente, UI).
- React Hook Form + Zod para formulários e validação.
- TanStack Table para grids de cadastro e resultado.
- Lucide React para ícones.
- Sonner para toasts.
- date-fns para datas.

**PDF e interação**
- `pdfjs-dist` (PDF.js oficial) para renderizar o PDF em canvas, com controle de escala (zoom).
- Renderização por página com lazy loading (somente a página visível é renderizada).
- Overlay HTML absoluto sobre o canvas para os pontos clicáveis.
- Pan via container com `overflow: auto` (desktop) e `react-zoom-pan-pinch` (mobile, com pinch-to-zoom).
- Ao alterar o zoom, re-renderizar o canvas na nova escala (evita blur do PDF vetorial).
- Aplicar `counter-scale` nos marcadores para manter o tamanho constante em pixels de tela.

**Janela flutuante do ponto**
- `react-rnd` (arrastável + redimensionável) no desktop.
- Em mobile, transformar em **bottom sheet** deslizante.
- Sem backdrop escuro: o croqui continua visível por baixo, a janela é opaca.

**Persistência local (IndexedDB)**
- `idb-keyval` (biblioteca minúscula) para guardar: PDF como `Blob`, lista de pontos marcados, metadados do projeto atual e último resultado gerado.
- Permite que o usuário recarregue a página sem perder o trabalho.
- Sem sincronização com servidor: nada de pontos/medição no Supabase.

**Backend / BaaS (apenas catálogos)**
- Supabase (Auth + Postgres + RLS).
- `@supabase/supabase-js`.
- Autenticação por e-mail/senha (+ magic link opcional).

**Exportação**
- SheetJS (`xlsx`) para gerar o Excel com 6 abas (5 consolidadas + 1 por ponto).
- Opcional: `jspdf` + `html2canvas` para relatório em PDF.

**Deploy**
- GitHub Actions para build e publish no GitHub Pages.
- `base` no `vite.config.ts` conforme o nome do repositório.
- `HashRouter` do React Router (evita configuração de fallback 404).

---

## 3. ARQUITETURA

Separar em camadas claras:
src/
dominio/ # Entidades e tipos (Material, Estrutura, Regra, MaoObra, Ponto, ResultadoMedicao)
aplicacao/
motor-regras.ts # Motor de cálculo puro, sem dependência de UI/Supabase/IndexedDB
motor-regras.test.ts
casos-uso/
infraestrutura/
supabase/ # Cliente, auth, repositórios de catálogos
local/ # IndexedDB (pontos, PDF, preferências)
exportacao/ # Excel (consolidado + por ponto)
interface/
componentes/
ui/ # shadcn
croqui/ # PDFViewer, PontoMarker, Toolbar
janela-ponto/ # JanelaFlutuantePonto
cadastros/ # MateriaisGrid, EstruturasEditor, RegrasEditor, MaoObraGrid
resumo/ # TabelaResumo, AuditoriaDrawer
paginas/
Login.tsx
App.tsx # Abas: Croqui | Resumo | Auditoria | Cadastros
hooks/
store/
useCatalogosStore.ts
usePontosStore.ts
useMedicaoStore.ts
estilos/
App.tsx
main.tsx
supabase/
schema.sql

text

Regras:
- O motor de regras é uma **função pura**: `(catalogos, pontos) => ResultadoMedicao`. Testável com Vitest, sem dependência de React, Supabase ou IndexedDB.
- Repositórios isolam o Supabase. Componentes e hooks nunca chamam Supabase diretamente.
- IndexedDB acessível somente via `infraestrutura/local/`. O resto do app não sabe que existe.
- Zustand só armazena estado de UI/cache; persistência real via repositórios (Supabase para catálogos, IndexedDB para pontos e PDF).

---

## 4. MODELO DE DADOS (SUPABASE / POSTGRES)

Apenas as **quatro tabelas de catálogo** vivem no Supabase. Todas protegidas por RLS (`user_id = auth.uid()`).

```sql
-- Perfil (opcional, apenas para exibir nome no header)
profiles (
  id uuid pk refs auth.users,
  nome text,
  created_at timestamptz default now()
)

-- MATERIAIS (simplificado conforme decisão do projeto)
materiais (
  id uuid pk default gen_random_uuid(),
  user_id uuid refs auth.users not null,
  codigo text not null,
  descricao text not null,
  categoria text not null check (categoria in ('cabo','poste','geral')),
  tipo_cabo text check (tipo_cabo in ('BT','MT')), -- apenas quando categoria = 'cabo'
  created_at timestamptz default now(),
  unique (user_id, codigo)
)

-- MÃO DE OBRA (conforme decisão: código e descrição)
mao_obra (
  id uuid pk default gen_random_uuid(),
  user_id uuid refs auth.users not null,
  codigo text not null,
  descricao text not null,
  created_at timestamptz default now(),
  unique (user_id, codigo)
)

-- ESTRUTURAS (nome + materiais associados com quantidade)
estruturas (
  id uuid pk default gen_random_uuid(),
  user_id uuid refs auth.users not null,
  nome text not null,
  created_at timestamptz default now()
)

estrutura_itens (
  id uuid pk default gen_random_uuid(),
  estrutura_id uuid refs estruturas on delete cascade,
  material_id uuid refs materiais on delete restrict,
  quantidade numeric not null check (quantidade > 0)
)

-- REGRAS DE MÃO DE OBRA (mesma lógica do projeto original)
regras_mao_obra (
  id uuid pk default gen_random_uuid(),
  user_id uuid refs auth.users not null,
  nome text not null,
  tipo_gatilho text not null check (tipo_gatilho in ('material','estrutura','contexto')),
  material_id uuid refs materiais,      -- quando tipo_gatilho = 'material'
  estrutura_id uuid refs estruturas,    -- quando tipo_gatilho = 'estrutura'
  categorias text[],                    -- quando tipo_gatilho = 'contexto' (ex: ['poste','cabo'])
  operacoes text[] not null,            -- subconjunto de ['I','D','R']
  created_at timestamptz default now()
)

regra_saidas (
  id uuid pk default gen_random_uuid(),
  regra_id uuid refs regras_mao_obra on delete cascade,
  mao_obra_id uuid refs mao_obra on delete restrict,
  quantidade numeric not null check (quantidade > 0)
)
Notas de modelagem:

Nenhuma tabela projetos, pontos ou medicoes — esses dados são locais (IndexedDB).

unidade foi removida de materiais e mão de obra por decisão do projeto. No Excel, o campo unidade sai em branco (ou "UN"/"SV" como padrão, configurável em constantes.ts).

O campo tipo_cabo (BT/MT) é usado apenas quando categoria = 'cabo', para os selects do formulário de ponto.

A RLS bloqueia qualquer acesso cruzado entre usuários. Sem escrita anônima.

Seed opcional: um botão "Carregar base exemplo" insere, no catálogo do usuário logado, o conteúdo de base-medicao.json do projeto original (materiais, mão de obra, estruturas e regras), adaptado ao novo modelo simplificado.

5. FUNCIONALIDADES DETALHADAS
5.1 Autenticação e Layout Base
Tela de login/cadastro (e-mail + senha) com Supabase Auth.

Após login, a aplicação abre direto na aba Croqui (não há dashboard de "projetos", pois a medição não é persistida).

Header global: nome do app, nome do usuário, botão de sair e seletor de tema (claro/escuro).

Navegação por abas: Croqui · Resumo · Auditoria · Cadastros.

5.2 Upload e Visualização do PDF
Botão "Carregar Croqui (PDF)" na aba Croqui.

Upload local via <input type="file">. O arquivo não vai para o servidor — é lido como ArrayBuffer, guardado como Blob no IndexedDB e renderizado com pdfjs-dist.

Na próxima sessão, se houver um PDF salvo no IndexedDB, ele é restaurado automaticamente.

Controles de zoom: botões - / +, slider, "Ajustar à tela", "100%".

Pan por scroll (desktop) e arrasto/pinch (mobile).

Navegação entre páginas do PDF (quando houver múltiplas): setas + seletor.

Performance: renderizar somente a página atual, cache de renderização, debounce no zoom.

5.3 Marcação de Pontos (Hotspots)
Barra de ferramentas sobre o PDF com dois modos:

Modo "Marcar Pontos" (cadastro inicial dos hotspots)

Cursor vira mira. Cada clique sobre o PDF cria um ponto na coordenada clicada (coordenadas salvas em percentual da página: x_percent, y_percent em [0,1], e pagina 1-based).

Abre imediatamente a janela flutuante do ponto para preenchimento (ver 5.4).

Ponto criado fica com estado pendente (vermelho).

Pode ser movido (arrastar) e excluído (× ou menu de contexto).

Modo "Validar" (padrão após marcação)

Clique em ponto pendente abre a janela para preencher/editar.

Ao salvar com dados mínimos válidos, o ponto vira validado (verde com check).

Clique em ponto validado reabre em modo edição; permite desvalidar (voltar para pendente).

Estados visuais do marcador (tamanho constante em tela, independente do zoom):

pendente: círculo vermelho pulsante com número.

validado: círculo verde com ícone de check.

em edição: anel azul.

Hover: tooltip com número do ponto e status.

Persistência: os pontos (metadados + coordenadas) são salvos em IndexedDB (chave pontos). Nunca vão ao Supabase. Ao recarregar a página, são restaurados.

Auto-detecção (opcional, fase 2): botão "Detectar círculos vermelhos" que lê o canvas renderizado, aplica threshold de cor (R > 200, G < 100, B < 100), faz análise de componentes conexos, filtra por área/aspecto circular e propõe pontos. Usuário confirma/ajusta. Não obrigatório no MVP; a arquitetura fica preparada.

5.4 Janela Flutuante do Ponto
Ao clicar em um ponto (ou criar um novo), abrir janela com:

Cabeçalho arrastável (react-rnd):

Exibe Ponto Nº [input] e status.

Botão minimizar, botão fechar (×).

Corpo rolável (React Hook Form + Zod):

Número do ponto (texto, obrigatório; sugestão automática P01, P02…).

Operação (segmented: Instalação / Desativação / Reinstalação).

Estrutura principal (select buscável das estruturas cadastradas).

Estruturas secundárias (multi-select, opcional).

Poste (select de materiais com categoria = 'poste').

Cabo BT (select de materiais com categoria = 'cabo' e tipo_cabo = 'BT').

Cabo MT (select de materiais com categoria = 'cabo' e tipo_cabo = 'MT').

Quantidade de cabo (numérico; aparece quando cabo BT/MT selecionado).

Quantidade de pontos (numérico, default 1 — multiplica o ponto inteiro).

Observações (textarea).

Rodapé com ações:

Salvar e Validar (primário) → salva em IndexedDB, marca validado, fecha.

Salvar Rascunho → salva como pendente.

Excluir Ponto (somente em edição, com confirmação).

Cancelar.

Comportamento:

Arrastável pelo cabeçalho (desktop e mobile).

Redimensionável (react-rnd) no desktop.

Sempre dentro do viewport.

Em mobile (< 768px), abre como bottom sheet (~85% da altura, com handle de arraste).

Sem backdrop escuro: o croqui continua visível ao redor da janela.

Posição da janela é lembrada durante a sessão.

5.5 Cadastros
Aba "Cadastros" com sub-abas e grids CRUD, todas persistidas no Supabase.

Materiais

Campos: código, descrição, categoria (cabo | poste | geral), tipo de cabo (BT/MT, só quando categoria = cabo).

Busca por código/descrição, filtro por categoria.

Importação/exportação CSV.

Grid com TanStack Table.

Mão de Obra

Campos: código, descrição.

Busca por código/descrição.

Estruturas (UX crítica)

Campos: nome da estrutura.

Editor de itens: lista de materiais associados com quantidade.

Busca de materiais por iniciais: digitar as primeiras letras do código ou da descrição e ver a lista filtrada em tempo real (usar ilike no Supabase ou filtragem client-side após carregar todos os materiais do usuário; recomendado carregar todos e filtrar localmente para resposta instantânea).

Adicionar material → escolher quantidade → empilhar na lista.

Permitir incluir vários materiais na mesma estrutura.

Reordenar itens, editar quantidade, remover.

Salvar a estrutura de uma vez (transação: insere estruturas + estrutura_itens).

Regras de Mão de Obra (mesma lógica do projeto original)

Campos:

nome da regra.

tipo_gatilho: material | estrutura | contexto.

Vínculo: material (select), estrutura (select) ou categorias (multi-select de ['cabo','poste','geral']).

operações: checkboxes para I, D, R.

saídas: lista de mao_obra + quantidade (multi-linha).

Editor com busca de mão de obra por iniciais (mesmo padrão das estruturas).

Pré-visualizar quais pontos seriam afetados (opcional, mas útil).

Todas as abas têm busca, filtros, criação, edição e exclusão. Multi-tenant via RLS.

5.6 Motor de Cálculo (MotorDeRegras)
Implementar em src/aplicacao/motor-regras.ts como função pura:

ts
type Entrada = {
  materiais: Material[];
  maoObra: MaoObra[];
  estruturas: EstruturaComItens[];
  regras: RegraComSaidas[];
  pontos: PontoMedicao[];
};

type Saida = {
  materiaisInstalacao: LinhaResultado[];
  materiaisDesativacao: LinhaResultado[];
  maoObraInstalacao: LinhaResultado[];
  maoObraDesativacao: LinhaResultado[];
  maoObraReinstalacao: LinhaResultado[];
  porPonto: ResultadoPorPonto[];   // usado na aba "Por Ponto" do Excel
};

type LinhaResultado = {
  codigo: string;
  descricao: string;
  unidade: string; // "UN" ou "SV" por padrão (não há unidade cadastrada)
  quantidade: number;
};

type ResultadoPorPonto = {
  numeroPonto: string;
  pagina: number;
  operacao: 'I' | 'D' | 'R';
  estrutura: string | null;
  itens: {
    tipo: 'material' | 'mao_obra';
    codigo: string;
    descricao: string;
    unidade: string;
    quantidade: number;
  }[];
};
Para cada ponto:

Materiais de estrutura: para cada estrutura vinculada (principal + secundárias), para cada estrutura_item, adiciona material com quantidade_item * ponto.quantidade_pontos.

Materiais diretos: adiciona poste, cabo BT e cabo MT (este multiplicado por quantidade_cabo).

Regras de mão de obra: para cada regra cujo gatilho/vínculo/operação corresponda ao contexto do ponto, adiciona as saídas de mão de obra multiplicando por quantidade_pontos.

Consolidação: agrupa por codigo + descricao, somando quantidades, separando nas 5 listas por operação e tipo.

Por ponto: mantém o detalhamento item a item de cada ponto para a aba nova do Excel.

Testes unitários (Vitest) cobrindo: ponto com estrutura, ponto com cabo, ponto com regra de contexto, consolidação de duplicados, multiplicação por quantidade de pontos, geração da lista porPonto.

5.7 Barra Superior com Resumo em Tempo Real
Fixa no topo da aba Croqui.

Contadores: total de pontos, validados, pendentes.

Totais consolidados em tempo real (nº de linhas de materiais, nº de linhas de mão de obra, soma de itens) via Zustand, sempre que um ponto é salvo/validado.

Botão "Gerar Resumo da Obra" (habilitado quando há pelo menos 1 ponto validado; se houver pendentes, pedir confirmação):

Executa o MotorDeRegras.

Guarda o resultado em Zustand e em IndexedDB (para persistir entre recarregamentos).

Navega para a aba Resumo.

5.8 Aba "Resumo da Obra"
Cinco tabelas/tabs internas (mesma estrutura do projeto original):

Materiais — Instalação

Materiais — Desativação

Mão de Obra — Instalação

Mão de Obra — Desativação

Mão de Obra — Reinstalação

Colunas: código, descrição, unidade, quantidade. Totalizador por tabela.

Busca e ordenação (TanStack Table).

Botão "Baixar Excel da Medição" — dispara a exportação via SheetJS (ver 5.9).

5.9 Exportação Excel (nova estrutura)
Um único arquivo .xlsx com 6 abas:

Materiais Instalação — consolidação dos materiais de instalação.

Materiais Desativação — consolidação dos materiais de desativação.

Mão de Obra Instalação — consolidação de mão de obra de instalação.

Mão de Obra Desativação — consolidação de mão de obra de desativação.

Mão de Obra Reinstalação — consolidação de mão de obra de reinstalação.

Por Ponto — detalhamento item a item por ponto.

Formato da aba "Por Ponto": uma linha por item (material ou mão de obra) gerado por cada ponto. Colunas:

Ponto	Página	Operação	Estrutura	Tipo	Código	Descrição	Unidade	Quantidade
P01	1	I	Estrutura X	Material	12345	Alça pré-formada	UN	3
P01	1	I	Estrutura X	Mão de Obra	MO-01	Instalação alça	SV	3
P02	1	I	—	Material	67890	Poste 11m	UN	1
...	...	...	...	...	...	...	...	...
Essa aba permite filtrar/agrupar por Ponto no Excel, servindo de justificativa para o empreiteiro.

Nome do arquivo: medicao_YYYY-MM-DD_HHmm.xlsx.

Sem unidade cadastrada: como o cadastro de materiais e mão de obra não possui campo unidade, usar UN para materiais e SV para mão de obra (configurável em constantes.ts).

5.10 Aba "Auditoria por Ponto"
Objetivo: dentro do app, permitir visualizar rapidamente o que foi medido em cada ponto (além da aba Excel "Por Ponto").

Lista de pontos (validados e pendentes) com filtros por status, operação e número.

Cada linha/card mostra: número, página, operação, estrutura, poste, cabos, quantidade de cabo, quantidade de pontos, status.

Ação "Ver detalhes" abre um drawer lateral com:

Miniatura do croqui destacando a localização do ponto (renderizar a página em canvas pequeno + overlay do marcador).

Lista dos itens gerados exclusivamente por aquele ponto (rodar o motor só para ele usando porPonto).

Observações.

Botão "Exportar auditoria (Excel)": gera um .xlsx contendo apenas a aba "Por Ponto" filtrada pelos pontos em questão.

6. LAYOUT E UX
Design moderno, limpo, com Tailwind + shadcn/ui. Paleta neutra com acento verde (energia) e vermelho/âmbar para alertas.

Dark mode nativo (toggle no header, persistido em localStorage).

Header global: nome do app, tema, usuário.

Abas dentro do app: Croqui · Resumo · Auditoria · Cadastros.

Barra de ferramentas do croqui (acima do canvas): zoom, ajustar, modo (Marcar/Validar), páginas, contadores (pendentes/validados).

Feedback visual imediato: toasts para salvar, validar, excluir; skeleton loaders durante renderização do PDF; spinners em uploads.

Estados vazios informativos:

Sem PDF: "Carregue o croqui da obra para começar."

Sem pontos: "Ative o modo Marcar Pontos e clique sobre os círculos vermelhos do croqui."

Sem resumo: "Valide os pontos e clique em Gerar Resumo."

Acessibilidade: foco visível, atalhos (Esc fecha janela, Enter salva, Delete exclui ponto focado), aria-* nos controles.

7. RESPONSIVIDADE (MOBILE E DESKTOP)
Desktop (≥1024px): janela flutuante livre (react-rnd), abas horizontais, grids completos, tabelas do TanStack.

Tablet (768–1023px): janela flutuante com limites de largura; grids com colunas reduzidas.

Mobile (<768px):

Header compacto com menu hambúrguer.

Abas em scroll horizontal.

Barra de ferramentas do croqui em duas linhas (zoom em cima, modos embaixo).

Janela do ponto vira bottom sheet (arrastar para expandir/recolher).

Auditoria e cadastros viram listas de cards em vez de tabelas.

Exportações via menu "⋮".

8. PERSISTÊNCIA E BACKEND
No Supabase (somente catálogos):

materiais, mao_obra, estruturas + estrutura_itens, regras_mao_obra + regra_saidas.

Auth de e-mail/senha, com RLS user_id = auth.uid() em todas as tabelas.

Sem tabelas de projetos, pontos ou medicoes.

Sem uso de Storage.

No navegador (IndexedDB, via idb-keyval):

PDF do croqui como Blob.

Lista de pontos marcados (id, pagina, x_percent, y_percent, número, operação, estrutura(s), poste, cabos, quantidades, status, observações).

Resultado da última medição gerada (ResultadoMedicao completo).

Preferências (tema, zoom, modo).

Regra de ouro: se o usuário limpar o IndexedDB, os pontos e a medição são perdidos — o que é esperado, pois a medição não é persistida no servidor. Um aviso no header e no botão "Baixar Excel" reforça que o usuário deve exportar quando terminar.

9. DEPLOY (GITHUB PAGES)
vite.config.ts com base: '/<nome-do-repo>/'.

HashRouter do react-router-dom.

GitHub Actions (.github/workflows/deploy.yml):

Trigger em push na main.

Setup Node 20, npm ci, npm run build.

Upload do dist/ como artifact e deploy em GitHub Pages.

Variáveis de ambiente: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY via GitHub Secrets, injetadas no build.

README com instruções:

Como rodar localmente (npm install && npm run dev).

Como criar o projeto no Supabase.

Como rodar supabase/schema.sql.

Como publicar no GitHub Pages.

10. ESTRUTURA DE PASTAS SUGERIDA
text
obras-croqui/
├── .github/workflows/deploy.yml
├── public/
├── src/
│   ├── dominio/
│   │   ├── tipos.ts
│   │   └── constantes.ts       # UN / SV, cores, limites
│   ├── aplicacao/
│   │   ├── motor-regras.ts
│   │   ├── motor-regras.test.ts
│   │   └── casos-uso/
│   ├── infraestrutura/
│   │   ├── supabase/
│   │   │   ├── cliente.ts
│   │   │   ├── auth.ts
│   │   │   └── repositorios/    # materiais.ts, maoObra.ts, estruturas.ts, regras.ts
│   │   ├── local/
│   │   │   ├── indexedDb.ts     # PDF, pontos, último resultado
│   │   │   └── preferencias.ts
│   │   └── exportacao/
│   │       └── excel.ts         # 6 abas
│   ├── interface/
│   │   ├── componentes/
│   │   │   ├── ui/              # shadcn
│   │   │   ├── croqui/          # PDFViewer, PontoMarker, Toolbar
│   │   │   ├── janela-ponto/    # JanelaFlutuantePonto
│   │   │   ├── cadastros/       # MateriaisGrid, EstruturasEditor, MaoObraGrid, RegrasEditor
│   │   │   └── resumo/          # TabelaResumo, AuditoriaDrawer
│   │   ├── paginas/
│   │   │   ├── Login.tsx
│   │   │   └── App.tsx          # Tabs
│   │   ├── hooks/
│   │   └── store/
│   │       ├── useCatalogosStore.ts
│   │       ├── usePontosStore.ts
│   │       └── useMedicaoStore.ts
│   ├── estilos/
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   └── schema.sql
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
11. ROADMAP DE IMPLEMENTAÇÃO (ORDEM SUGERIDA)
Setup: Vite + React + TS + Tailwind + shadcn/ui + Supabase client + HashRouter. Configurar GitHub Actions.

Auth: login, cadastro, guard de rota, header global com logout.

Visualizador de PDF: upload local, renderização com PDF.js, zoom, pan, navegação de páginas, persistência em IndexedDB.

Cadastros (ordem):

Materiais (CRUD + busca + filtro por categoria).

Mão de Obra (CRUD + busca).

Estruturas (CRUD + editor de itens com busca por iniciais).

Regras (CRUD + gatilho + operações + saídas com busca por iniciais).

Motor de Regras: implementar motor-regras.ts + testes Vitest cobrindo todos os casos.

Pontos interativos: modo Marcar, criação/edição/exclusão, persistência em IndexedDB, estados visuais.

Janela flutuante do ponto: react-rnd + RHF/Zod, responsiva (bottom sheet no mobile).

Barra de resumo em tempo real: contadores e totais reativos via Zustand.

Geração e aba Resumo: execução do motor, store do resultado, tabelas 5 abas internas.

Exportação Excel: implementar excel.ts com as 6 abas (5 consolidadas + "Por Ponto"), botão "Baixar Excel da Medição".

Auditoria por Ponto: lista, drawer com croqui mini + itens por ponto, exportação da aba Por Ponto.

Polimento: dark mode, acessibilidade, toasts, estados vazios, performance do PDF (lazy render, cache).

Testes e2e (Playwright): login → carregar PDF → marcar 2 pontos → validar → gerar resumo → baixar Excel.

12. CRITÉRIOS DE ACEITE
Usuário cria conta, faz login e cai direto na aba Croqui.

Upload de PDF local funciona e o arquivo é restaurado automaticamente ao recarregar (IndexedDB).

PDF renderiza com zoom e pan fluidos em desktop e mobile.

É possível marcar pontos sobre o PDF, mover, excluir e persistir entre recarregamentos.

Clicar em um ponto abre a janela flutuante arrastável; salvar valida o ponto (vermelho → verde).

Cadastros de Materiais, Mão de Obra, Estruturas e Regras funcionam com CRUD completo e persistem no Supabase.

A busca por iniciais em Estruturas e Regras é instantânea e retorna materiais/mão de obra corretos.

Motor de regras produz resultado correto, coberto por testes unitários.

Barra superior atualiza contadores em tempo real.

Botão "Gerar Resumo da Obra" produz as 5 listas consolidadas na aba Resumo.

Botão "Baixar Excel da Medição" gera um .xlsx com as 5 abas consolidadas + a aba "Por Ponto".

Aba de Auditoria lista pontos com detalhes e permite exportar a aba "Por Ponto" filtrada.

Layout responsivo (desktop e mobile), dark mode, acessibilidade básica.

Deploy automático no GitHub Pages funcionando via GitHub Actions.

RLS do Supabase garante que um usuário não acessa catálogos de outro.

Nenhum ponto ou medição é enviado ao Supabase (verificável via Network tab).

13. OBSERVAÇÕES FINAIS PARA O CODEX
Prioridade 1: o motor de regras precisa ficar correto e testado, porque é o núcleo do negócio. Escrever os testes antes de integrar com a UI (TDD leve).

Prioridade 2: o exportador Excel com a aba "Por Ponto" é um entregável explícito do produto — tratar como feature de primeira classe, não acessório.

Prioridade 3: a busca por iniciais nos editores de Estruturas e Regras precisa ser muito boa (debounce, highlight do trecho pesquisado, suporte a código e descrição).

Manter o motor de regras 100% desacoplado de React, Supabase e IndexedDB (função pura).

Toda chamada ao Supabase deve passar por repositórios em infraestrutura/supabase/repositorios/.

Usar zod para validar tanto formulários quanto o retorno do Supabase.

Não persistir pontos, PDF ou medição no Supabase — respeitar a decisão do projeto (verificável por inspeção de rede).

Documentar no README: como rodar, como configurar Supabase (schema + RLS), como publicar no GitHub Pages, e como usar a exportação Excel (6 abas).

Não reinventar componentes de UI — usar shadcn/ui.

Manter o projeto original (RosanPe/obras) como referência das regras de negócio, mas não copiar a arquitetura (JSONB único) nem o acoplamento de UI com dados.

pode sugerir melhorias, porem pergunte antes, projeto de exemplo esta em https://github.com/RosanPe/obras

disponivel pelo github pages rosanpe.github.io/obras/

organize tudo



