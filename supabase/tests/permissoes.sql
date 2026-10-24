-- Teste transacional: não deixa dados, usuários ou permissões de teste no banco.
-- Execute como administrador do banco após aplicar as migrações e autorizar um editor.
begin;
with novo as (
  insert into public.materiais(user_id, codigo, descricao, categoria)
  select user_id, '__ACL_TEST_' || gen_random_uuid()::text, 'Material temporário para teste de RLS', 'geral'
  from public.catalogo_permissoes where pode_editar limit 1 returning id
)
select set_config('obras.test_material_id', id::text, true) from novo;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000098","role":"authenticated"}', true);
do $$
declare quantidade integer; material uuid := current_setting('obras.test_material_id')::uuid;
begin
  if public.pode_editar_catalogos() then raise exception 'Leitor recebeu permissão de edição'; end if;
  select count(*) into quantidade from public.materiais where id = material;
  if quantidade <> 1 then raise exception 'Leitor não consegue consultar o catálogo compartilhado'; end if;
  update public.materiais set descricao = 'Alteração proibida' where id = material;
  get diagnostics quantidade = row_count;
  if quantidade <> 0 then raise exception 'Leitor conseguiu editar um material'; end if;
  delete from public.materiais where id = material;
  get diagnostics quantidade = row_count;
  if quantidade <> 0 then raise exception 'Leitor conseguiu excluir um material'; end if;
  begin
    insert into public.materiais(codigo, descricao, categoria) values ('__NAO_DEVE_EXISTIR', 'Proibido', 'geral');
    raise exception 'Leitor conseguiu criar um material';
  exception when insufficient_privilege then null; end;
  begin
    perform public.salvar_estrutura(null, 'Proibida', jsonb_build_array(jsonb_build_object('material_id', material, 'quantidade', 1)));
    raise exception 'Leitor conseguiu escrever por RPC';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.catalogo_permissoes(user_id, pode_editar) values (auth.uid(), true);
    raise exception 'Leitor conseguiu se promover a editor';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.regra_alvos(user_id, regra_id, material_id) values (auth.uid(), gen_random_uuid(), material);
    raise exception 'Leitor conseguiu criar vínculo de regra';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.materiais limit 1;
    raise exception 'Acesso anônimo ao catálogo foi permitido';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.regra_alvos limit 1;
    raise exception 'Acesso anônimo aos vínculos foi permitido';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select jsonb_build_object('consulta_leitor', true, 'edicao_leitor_bloqueada', true, 'rpc_bloqueada', true, 'autopromocao_bloqueada', true, 'anonimo_bloqueado', true) as verificacoes;
rollback;
