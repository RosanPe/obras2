begin;

-- Saídas antigas continuam válidas para todas as operações da regra.
alter table public.regra_saidas
  add column operacao text check (operacao in ('I', 'D', 'R'));

alter table public.regra_saidas
  drop constraint regra_saidas_regra_id_mao_obra_id_key;
create unique index regra_saidas_servico_compartilhado_idx
  on public.regra_saidas(regra_id, mao_obra_id) where operacao is null;
create unique index regra_saidas_servico_operacao_idx
  on public.regra_saidas(regra_id, mao_obra_id, operacao) where operacao is not null;

create or replace function public.salvar_regra_por_operacao(p_id uuid, p_regra jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_owner uuid; v_user uuid := auth.uid(); v_operacoes text[]; v_categorias text[];
  v_materiais uuid[]; v_estruturas uuid[]; v_tipo text := p_regra->>'tipo_gatilho';
begin
  if not public.pode_editar_catalogos() then raise exception 'Sem permissão para alterar catálogos' using errcode = '42501'; end if;
  if jsonb_typeof(p_regra->'saidas') is distinct from 'array' or jsonb_array_length(p_regra->'saidas') = 0 then raise exception 'Adicione saídas à regra'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_regra->'saidas') as item
    where item->>'operacao' is null or item->>'operacao' not in ('I', 'D', 'R')
  ) then
    raise exception 'Cada saída de mão de obra deve ter uma operação válida';
  end if;
  v_operacoes := array(
    select op from unnest(array['I', 'D', 'R']) with ordinality as abas(op, ordem)
    where exists (
      select 1 from jsonb_array_elements(p_regra->'saidas') as item
      where item->>'operacao' = op
    )
    order by ordem
  );
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
  insert into public.regra_saidas(user_id, regra_id, mao_obra_id, quantidade, operacao)
    select v_owner, v_id, (item->>'mao_obra_id')::uuid, (item->>'quantidade')::numeric, item->>'operacao'
      from jsonb_array_elements(p_regra->'saidas') as item;
  insert into public.regra_alvos(user_id, regra_id, material_id) select v_owner, v_id, unnest(v_materiais);
  insert into public.regra_alvos(user_id, regra_id, estrutura_id) select v_owner, v_id, unnest(v_estruturas);
  return v_id;
end $$;
revoke all on function public.salvar_regra_por_operacao(uuid, jsonb) from public, anon;
grant execute on function public.salvar_regra_por_operacao(uuid, jsonb) to authenticated;
commit;
