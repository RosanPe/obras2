-- Após schema.sql e catalogos_crud.sql: catálogo compartilhado, edição restrita.
-- user_id nos catálogos identifica o criador; a leitura é comum aos autenticados.
begin;
create table public.catalogo_permissoes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pode_editar boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.catalogo_permissoes enable row level security;
revoke all on public.catalogo_permissoes from anon, authenticated;
grant select on public.catalogo_permissoes to authenticated;
create policy consultar_propria_permissao on public.catalogo_permissoes
  for select to authenticated using (user_id = (select auth.uid()));

create function public.pode_editar_catalogos()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.catalogo_permissoes p where p.user_id = auth.uid() and p.pode_editar);
$$;
revoke all on function public.pode_editar_catalogos() from public, anon;
grant execute on function public.pode_editar_catalogos() to authenticated;

do $$
declare tabela text;
begin
  foreach tabela in array array['materiais', 'mao_obra', 'estruturas', 'estrutura_itens', 'regras_mao_obra', 'regra_saidas'] loop
    execute format('drop policy conta_isolada on public.%I', tabela);
    execute format('create policy catalogo_consulta on public.%I for select to authenticated using (true)', tabela);
    if tabela in ('materiais', 'mao_obra', 'estruturas', 'regras_mao_obra') then
      execute format('create policy catalogo_insercao on public.%I for insert to authenticated with check ((select public.pode_editar_catalogos()) and user_id = (select auth.uid()))', tabela);
    else
      execute format('create policy catalogo_insercao on public.%I for insert to authenticated with check ((select public.pode_editar_catalogos()))', tabela);
    end if;
    execute format('create policy catalogo_edicao on public.%I for update to authenticated using ((select public.pode_editar_catalogos())) with check ((select public.pode_editar_catalogos()))', tabela);
    execute format('create policy catalogo_exclusao on public.%I for delete to authenticated using ((select public.pode_editar_catalogos()))', tabela);
    -- O criador não pode ser trocado pela API. Atualizações são concedidas só aos campos editáveis.
    execute format('revoke update on public.%I from authenticated', tabela);
  end loop;
end $$;
grant update(codigo, descricao, categoria, tipo_cabo) on public.materiais to authenticated;
grant update(codigo, descricao) on public.mao_obra to authenticated;
grant update(nome) on public.estruturas to authenticated;
grant update(quantidade) on public.estrutura_itens to authenticated;
grant update(nome, tipo_gatilho, material_id, estrutura_id, categorias, operacoes) on public.regras_mao_obra to authenticated;
grant update(quantidade) on public.regra_saidas to authenticated;

-- O código é único no catálogo comum, independentemente de quem cadastrou.
alter table public.materiais drop constraint materiais_user_id_codigo_key;
alter table public.mao_obra drop constraint mao_obra_user_id_codigo_key;
alter table public.materiais add constraint materiais_codigo_unico unique(codigo);
alter table public.mao_obra add constraint mao_obra_codigo_unico unique(codigo);

-- Uma estrutura/regra pode usar itens criados por outro editor autorizado.
do $$
declare vinculo record;
begin
  for vinculo in
    select conname, conrelid::regclass as tabela from pg_constraint where contype = 'f' and (
      (conrelid = 'public.estrutura_itens'::regclass and confrelid = 'public.materiais'::regclass) or
      (conrelid = 'public.regra_saidas'::regclass and confrelid = 'public.mao_obra'::regclass) or
      (conrelid = 'public.regras_mao_obra'::regclass and confrelid in ('public.materiais'::regclass, 'public.estruturas'::regclass))
    )
  loop execute format('alter table %s drop constraint %I', vinculo.tabela, vinculo.conname); end loop;
end $$;
alter table public.estrutura_itens add constraint estrutura_material_ref foreign key(material_id) references public.materiais(id) on delete restrict;
alter table public.regra_saidas add constraint saida_mao_obra_ref foreign key(mao_obra_id) references public.mao_obra(id) on delete restrict;
alter table public.regras_mao_obra add constraint regra_material_ref foreign key(material_id) references public.materiais(id) on delete restrict;
alter table public.regras_mao_obra add constraint regra_estrutura_ref foreign key(estrutura_id) references public.estruturas(id) on delete restrict;

create or replace function public.salvar_estrutura(p_id uuid, p_nome text, p_itens jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_owner uuid; v_user uuid := auth.uid();
begin
  if not public.pode_editar_catalogos() then raise exception 'Sem permissão para alterar catálogos' using errcode = '42501'; end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Adicione materiais à estrutura'; end if;
  if p_id is null then
    insert into public.estruturas(user_id, nome) values (v_user, p_nome) returning id, user_id into v_id, v_owner;
  else
    update public.estruturas set nome = p_nome where id = p_id returning id, user_id into v_id, v_owner;
    if v_id is null then raise exception 'Estrutura não encontrada'; end if;
    delete from public.estrutura_itens where estrutura_id = v_id;
  end if;
  insert into public.estrutura_itens(user_id, estrutura_id, material_id, quantidade)
    select v_owner, v_id, (item->>'material_id')::uuid, (item->>'quantidade')::numeric from jsonb_array_elements(p_itens) as item;
  return v_id;
end $$;

create or replace function public.salvar_regra(p_id uuid, p_regra jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_owner uuid; v_user uuid := auth.uid(); v_operacoes text[]; v_categorias text[];
begin
  if not public.pode_editar_catalogos() then raise exception 'Sem permissão para alterar catálogos' using errcode = '42501'; end if;
  if jsonb_typeof(p_regra->'saidas') is distinct from 'array' or jsonb_array_length(p_regra->'saidas') = 0 then raise exception 'Adicione saídas à regra'; end if;
  select coalesce(array_agg(valor), '{}'::text[]) into v_operacoes from jsonb_array_elements_text(p_regra->'operacoes') as t(valor);
  select coalesce(array_agg(valor), '{}'::text[]) into v_categorias from jsonb_array_elements_text(p_regra->'categorias') as t(valor);
  if p_id is null then
    insert into public.regras_mao_obra(user_id, nome, tipo_gatilho, material_id, estrutura_id, categorias, operacoes)
    values (v_user, p_regra->>'nome', p_regra->>'tipo_gatilho', (p_regra->>'material_id')::uuid, (p_regra->>'estrutura_id')::uuid, v_categorias, v_operacoes) returning id, user_id into v_id, v_owner;
  else
    update public.regras_mao_obra set nome = p_regra->>'nome', tipo_gatilho = p_regra->>'tipo_gatilho', material_id = (p_regra->>'material_id')::uuid, estrutura_id = (p_regra->>'estrutura_id')::uuid, categorias = v_categorias, operacoes = v_operacoes
      where id = p_id returning id, user_id into v_id, v_owner;
    if v_id is null then raise exception 'Regra não encontrada'; end if;
    delete from public.regra_saidas where regra_id = v_id;
  end if;
  insert into public.regra_saidas(user_id, regra_id, mao_obra_id, quantidade)
    select v_owner, v_id, (item->>'mao_obra_id')::uuid, (item->>'quantidade')::numeric from jsonb_array_elements(p_regra->'saidas') as item;
  return v_id;
end $$;
commit;
