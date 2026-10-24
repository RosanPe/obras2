-- Execute uma vez no SQL Editor de um projeto Supabase novo.
-- Não há tabelas de projetos, pontos ou medições, nem bucket de Storage.
begin;

create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  codigo text not null check (length(trim(codigo)) > 0),
  descricao text not null check (length(trim(descricao)) > 0),
  categoria text not null check (categoria in ('cabo', 'poste', 'geral')),
  tipo_cabo text,
  created_at timestamptz not null default now(),
  unique (user_id, codigo), unique (id, user_id),
  check ((categoria = 'cabo' and tipo_cabo is not null and tipo_cabo in ('BT', 'MT')) or (categoria <> 'cabo' and tipo_cabo is null))
);
create table public.mao_obra (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  codigo text not null check (length(trim(codigo)) > 0),
  descricao text not null check (length(trim(descricao)) > 0),
  created_at timestamptz not null default now(),
  unique (user_id, codigo), unique (id, user_id)
);
create table public.estruturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
-- user_id nos filhos permite RLS direta e FKs compostas impedem vínculos entre contas.
create table public.estrutura_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  estrutura_id uuid not null,
  material_id uuid not null,
  quantidade numeric not null check (quantidade > 0 and quantidade <> 'NaN'::numeric and quantidade < 'Infinity'::numeric),
  foreign key (estrutura_id, user_id) references public.estruturas(id, user_id) on delete cascade,
  foreign key (material_id, user_id) references public.materiais(id, user_id) on delete restrict,
  unique (estrutura_id, material_id)
);
create table public.regras_mao_obra (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  tipo_gatilho text not null check (tipo_gatilho in ('material', 'estrutura', 'contexto')),
  material_id uuid,
  estrutura_id uuid,
  categorias text[] not null default '{}',
  operacoes text[] not null check (cardinality(operacoes) > 0 and operacoes <@ array['I', 'D', 'R']::text[] and array_position(operacoes, null) is null),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (material_id, user_id) references public.materiais(id, user_id) on delete restrict,
  foreign key (estrutura_id, user_id) references public.estruturas(id, user_id) on delete restrict,
  check (categorias <@ array['cabo', 'poste', 'geral']::text[] and array_position(categorias, null) is null),
  check (
    (tipo_gatilho = 'material' and material_id is not null and estrutura_id is null and cardinality(categorias) = 0) or
    (tipo_gatilho = 'estrutura' and estrutura_id is not null and material_id is null and cardinality(categorias) = 0) or
    (tipo_gatilho = 'contexto' and material_id is null and estrutura_id is null and cardinality(categorias) > 0)
  )
);
create table public.regra_saidas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  regra_id uuid not null,
  mao_obra_id uuid not null,
  quantidade numeric not null check (quantidade > 0 and quantidade <> 'NaN'::numeric and quantidade < 'Infinity'::numeric),
  foreign key (regra_id, user_id) references public.regras_mao_obra(id, user_id) on delete cascade,
  foreign key (mao_obra_id, user_id) references public.mao_obra(id, user_id) on delete restrict,
  unique (regra_id, mao_obra_id)
);

do $$
declare tabela text;
begin
  foreach tabela in array array['materiais', 'mao_obra', 'estruturas', 'estrutura_itens', 'regras_mao_obra', 'regra_saidas'] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('create policy conta_isolada on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', tabela);
    execute format('revoke all on public.%I from anon', tabela);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tabela);
    execute format('create index %I on public.%I(user_id)', tabela || '_user_idx', tabela);
  end loop;
end $$;
create index estrutura_itens_estrutura_idx on public.estrutura_itens(estrutura_id);
create index estrutura_itens_material_idx on public.estrutura_itens(material_id);
create index regras_material_idx on public.regras_mao_obra(material_id);
create index regras_estrutura_idx on public.regras_mao_obra(estrutura_id);
create index regra_saidas_regra_idx on public.regra_saidas(regra_id);
create index regra_saidas_mao_obra_idx on public.regra_saidas(mao_obra_id);
commit;
