-- Aplicar após schema.sql. Funções executam com permissões do usuário (RLS ativa).
begin;
create or replace function public.salvar_estrutura(p_id uuid, p_nome text, p_itens jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Autenticação obrigatória'; end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Adicione materiais à estrutura'; end if;
  if p_id is null then
    insert into public.estruturas(user_id, nome) values (v_user, p_nome) returning id into v_id;
  else
    update public.estruturas set nome = p_nome where id = p_id and user_id = v_user returning id into v_id;
    if v_id is null then raise exception 'Estrutura não encontrada'; end if;
    delete from public.estrutura_itens where estrutura_id = v_id and user_id = v_user;
  end if;
  insert into public.estrutura_itens(user_id, estrutura_id, material_id, quantidade)
    select v_user, v_id, (item->>'material_id')::uuid, (item->>'quantidade')::numeric from jsonb_array_elements(p_itens) as item;
  return v_id;
end $$;

create or replace function public.salvar_regra(p_id uuid, p_regra jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid(); v_operacoes text[]; v_categorias text[];
begin
  if v_user is null then raise exception 'Autenticação obrigatória'; end if;
  if jsonb_typeof(p_regra->'saidas') is distinct from 'array' or jsonb_array_length(p_regra->'saidas') = 0 then raise exception 'Adicione saídas à regra'; end if;
  select coalesce(array_agg(valor), '{}'::text[]) into v_operacoes from jsonb_array_elements_text(p_regra->'operacoes') as t(valor);
  select coalesce(array_agg(valor), '{}'::text[]) into v_categorias from jsonb_array_elements_text(p_regra->'categorias') as t(valor);
  if p_id is null then
    insert into public.regras_mao_obra(user_id, nome, tipo_gatilho, material_id, estrutura_id, categorias, operacoes)
    values (v_user, p_regra->>'nome', p_regra->>'tipo_gatilho', (p_regra->>'material_id')::uuid, (p_regra->>'estrutura_id')::uuid, v_categorias, v_operacoes) returning id into v_id;
  else
    update public.regras_mao_obra set nome = p_regra->>'nome', tipo_gatilho = p_regra->>'tipo_gatilho', material_id = (p_regra->>'material_id')::uuid, estrutura_id = (p_regra->>'estrutura_id')::uuid, categorias = v_categorias, operacoes = v_operacoes
    where id = p_id and user_id = v_user returning id into v_id;
    if v_id is null then raise exception 'Regra não encontrada'; end if;
    delete from public.regra_saidas where regra_id = v_id and user_id = v_user;
  end if;
  insert into public.regra_saidas(user_id, regra_id, mao_obra_id, quantidade)
    select v_user, v_id, (item->>'mao_obra_id')::uuid, (item->>'quantidade')::numeric from jsonb_array_elements(p_regra->'saidas') as item;
  return v_id;
end $$;
revoke all on function public.salvar_estrutura(uuid, text, jsonb) from public, anon;
revoke all on function public.salvar_regra(uuid, jsonb) from public, anon;
grant execute on function public.salvar_estrutura(uuid, text, jsonb) to authenticated;
grant execute on function public.salvar_regra(uuid, jsonb) to authenticated;
commit;
