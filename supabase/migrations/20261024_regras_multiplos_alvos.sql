-- Preserva regras da base antiga com vários materiais/estruturas alternativos.
-- Cada regra continua disparando uma única vez por ponto, ao corresponder qualquer alvo.
begin;
create table public.regra_alvos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  regra_id uuid not null,
  material_id uuid references public.materiais(id) on delete restrict,
  estrutura_id uuid references public.estruturas(id) on delete restrict,
  foreign key (regra_id, user_id) references public.regras_mao_obra(id, user_id) on delete cascade,
  check ((material_id is not null)::int + (estrutura_id is not null)::int = 1),
  unique(regra_id, material_id), unique(regra_id, estrutura_id)
);
create index regra_alvos_user_idx on public.regra_alvos(user_id);
create index regra_alvos_material_idx on public.regra_alvos(material_id);
create index regra_alvos_estrutura_idx on public.regra_alvos(estrutura_id);
alter table public.regra_alvos enable row level security;
revoke all on public.regra_alvos from anon, authenticated;
grant select, insert, delete on public.regra_alvos to authenticated;
create policy catalogo_consulta on public.regra_alvos for select to authenticated using (true);
create policy catalogo_insercao on public.regra_alvos for insert to authenticated with check ((select public.pode_editar_catalogos()));
create policy catalogo_exclusao on public.regra_alvos for delete to authenticated using ((select public.pode_editar_catalogos()));
insert into public.regra_alvos(user_id, regra_id, material_id, estrutura_id)
  select user_id, id, material_id, estrutura_id from public.regras_mao_obra where material_id is not null or estrutura_id is not null;

create or replace function public.salvar_regra(p_id uuid, p_regra jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_owner uuid; v_user uuid := auth.uid(); v_operacoes text[]; v_categorias text[];
  v_materiais uuid[]; v_estruturas uuid[]; v_tipo text := p_regra->>'tipo_gatilho';
begin
  if not public.pode_editar_catalogos() then raise exception 'Sem permissão para alterar catálogos' using errcode = '42501'; end if;
  if jsonb_typeof(p_regra->'saidas') is distinct from 'array' or jsonb_array_length(p_regra->'saidas') = 0 then raise exception 'Adicione saídas à regra'; end if;
  select coalesce(array_agg(valor), '{}'::text[]) into v_operacoes from jsonb_array_elements_text(p_regra->'operacoes') as t(valor);
  select coalesce(array_agg(valor), '{}'::text[]) into v_categorias from jsonb_array_elements_text(p_regra->'categorias') as t(valor);
  v_materiais := array(select distinct valor::uuid from jsonb_array_elements_text(
    coalesce(p_regra->'material_ids', '[]'::jsonb) || case when p_regra->>'material_id' is null then '[]'::jsonb else jsonb_build_array(p_regra->>'material_id') end
  ) as t(valor));
  v_estruturas := array(select distinct valor::uuid from jsonb_array_elements_text(
    coalesce(p_regra->'estrutura_ids', '[]'::jsonb) || case when p_regra->>'estrutura_id' is null then '[]'::jsonb else jsonb_build_array(p_regra->>'estrutura_id') end
  ) as t(valor));
  if (v_tipo = 'material' and (cardinality(v_materiais) = 0 or cardinality(v_estruturas) > 0)) or
     (v_tipo = 'estrutura' and (cardinality(v_estruturas) = 0 or cardinality(v_materiais) > 0)) or
     (v_tipo = 'contexto' and (cardinality(v_estruturas) > 0 or cardinality(v_materiais) > 0)) then
    raise exception 'Os vínculos devem corresponder ao tipo do gatilho';
  end if;
  if p_id is null then
    insert into public.regras_mao_obra(user_id, nome, tipo_gatilho, material_id, estrutura_id, categorias, operacoes)
      values (v_user, p_regra->>'nome', v_tipo, v_materiais[1], v_estruturas[1], v_categorias, v_operacoes) returning id, user_id into v_id, v_owner;
  else
    update public.regras_mao_obra set nome = p_regra->>'nome', tipo_gatilho = v_tipo, material_id = v_materiais[1], estrutura_id = v_estruturas[1], categorias = v_categorias, operacoes = v_operacoes
      where id = p_id returning id, user_id into v_id, v_owner;
    if v_id is null then raise exception 'Regra não encontrada'; end if;
    delete from public.regra_saidas where regra_id = v_id;
    delete from public.regra_alvos where regra_id = v_id;
  end if;
  insert into public.regra_saidas(user_id, regra_id, mao_obra_id, quantidade)
    select v_owner, v_id, (item->>'mao_obra_id')::uuid, (item->>'quantidade')::numeric from jsonb_array_elements(p_regra->'saidas') as item;
  insert into public.regra_alvos(user_id, regra_id, material_id) select v_owner, v_id, unnest(v_materiais);
  insert into public.regra_alvos(user_id, regra_id, estrutura_id) select v_owner, v_id, unnest(v_estruturas);
  return v_id;
end $$;
commit;
