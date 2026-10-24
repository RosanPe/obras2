-- Executar como postgres após as migrações. Todas as alterações de teste são revertidas.

begin;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000987','__teste_admin_rollback@example.invalid');
select set_config('request.jwt.claim.sub',(select user_id::text from public.administradores limit 1),true);
set local role authenticated;
do $$ begin
 if not public.eh_super() then raise exception 'Super não reconhecido'; end if;
 perform public.admin_listar_usuarios();
 perform public.admin_definir_permissao('00000000-0000-4000-8000-000000000987',true);
 begin
  perform public.admin_definir_permissao(auth.uid(),false);
  raise exception 'Remoção do super foi aceita';
 exception when raise_exception then
  if sqlerrm <> 'O administrador mantém acesso total' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000987',true);
do $$ begin
 if public.eh_super() then raise exception 'Editor promovido a super'; end if;
 if not public.pode_editar_catalogos() then raise exception 'Delegação não aplicada'; end if;
 begin perform public.admin_listar_usuarios(); raise exception 'Usuários expostos'; exception when insufficient_privilege then null; end;
 begin perform public.admin_definir_permissao(auth.uid(),true); raise exception 'Delegação não protegida'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.auditoria_catalogos) then raise exception 'Histórico exposto'; end if;
 insert into public.materiais(user_id,codigo,descricao,categoria) values(auth.uid(),'__ADMIN_TESTE_ROLLBACK','Material temporário transacional','geral');
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.administradores limit 1),true);
set local role authenticated;
do $$ begin
 if not exists(select 1 from public.auditoria_catalogos where depois->>'codigo'='__ADMIN_TESTE_ROLLBACK' and usuario_email='__teste_admin_rollback@example.invalid') then raise exception 'Alteração não auditada'; end if;
 perform public.admin_definir_permissao('00000000-0000-4000-8000-000000000987',false);
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000987',true);
do $$ begin
 if public.pode_editar_catalogos() then raise exception 'Revogação não aplicada'; end if;
 begin insert into public.materiais(user_id,codigo,descricao,categoria) values(auth.uid(),'__BLOQUEADO','Não permitido','geral'); raise exception 'Escrita sem permissão'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'super, delegação, revogação, RLS, histórico e rollback verificados' as verificacao;
