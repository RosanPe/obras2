begin;
-- Identidade administrativa fixa; permissões de edição nunca promovem usuários a super.
create table public.administradores (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.administradores enable row level security;
revoke all on public.administradores from public, anon, authenticated;
insert into public.administradores(user_id) select id from auth.users where lower(email)='pedro.hrosan@hotmail.com';
do $$ begin
 if not exists(select 1 from public.administradores) then raise exception 'Conta administrativa não encontrada'; end if;
end $$;
create function public.eh_super() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.administradores where user_id=auth.uid());
$$;
revoke all on function public.eh_super() from public,anon;
grant execute on function public.eh_super() to authenticated;
create or replace function public.pode_editar_catalogos() returns boolean language sql stable security definer set search_path='' as $$
 select public.eh_super() or exists(select 1 from public.catalogo_permissoes where user_id=auth.uid() and pode_editar);
$$;
create table public.auditoria_catalogos (
 id bigint generated always as identity primary key,
 ocorrido_em timestamptz not null default now(),
 usuario_id uuid, usuario_email text,
 tabela text not null, acao text not null,
 registro_id text, antes jsonb, depois jsonb
);
alter table public.auditoria_catalogos enable row level security;
revoke all on public.auditoria_catalogos from public,anon,authenticated;
grant select on public.auditoria_catalogos to authenticated;
create policy super_consulta on public.auditoria_catalogos for select to authenticated using ((select public.eh_super()));
create function public.registrar_auditoria_catalogos() returns trigger language plpgsql security definer set search_path='' as $$
declare anterior jsonb; novo jsonb;
begin
 if TG_OP <> 'INSERT' then anterior:=to_jsonb(old); end if;
 if TG_OP <> 'DELETE' then novo:=to_jsonb(new); end if;
 insert into public.auditoria_catalogos(usuario_id,usuario_email,tabela,acao,registro_id,antes,depois)
 values(auth.uid(),(select email from auth.users where id=auth.uid()),TG_TABLE_NAME,TG_OP,coalesce(novo->>'id',anterior->>'id',novo->>'user_id',anterior->>'user_id'),anterior,novo);
 return coalesce(new,old);
end $$;
revoke all on function public.registrar_auditoria_catalogos() from public,anon,authenticated;
do $$ declare tabela text; begin
 foreach tabela in array array['materiais','mao_obra','estruturas','estrutura_itens','regras_mao_obra','regra_saidas','regra_alvos','catalogo_permissoes'] loop
 execute format('create trigger auditar_alteracao after insert or update or delete on public.%I for each row execute function public.registrar_auditoria_catalogos()',tabela);
 end loop;
end $$;
create function public.admin_listar_usuarios() returns table(user_id uuid,email text,criado_em timestamptz,ultimo_acesso timestamptz,pode_editar boolean,super boolean)
language plpgsql security definer set search_path='' as $$
begin
 if not public.eh_super() then raise exception 'Acesso exclusivo do administrador' using errcode='42501'; end if;
 return query select u.id,u.email::text,u.created_at,u.last_sign_in_at,
 (a.user_id is not null or coalesce(p.pode_editar,false)),a.user_id is not null
 from auth.users u left join public.catalogo_permissoes p on p.user_id=u.id left join public.administradores a on a.user_id=u.id order by u.email;
end $$;
create function public.admin_definir_permissao(p_usuario uuid,p_permitir boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.eh_super() then raise exception 'Acesso exclusivo do administrador' using errcode='42501'; end if;
 if p_permitir is null then raise exception 'Informe a permissão'; end if;
 if exists(select 1 from public.administradores where user_id=p_usuario) then raise exception 'O administrador mantém acesso total'; end if;
 if not exists(select 1 from auth.users where id=p_usuario) then raise exception 'Usuário não encontrado'; end if;
 insert into public.catalogo_permissoes(user_id,pode_editar) values(p_usuario,p_permitir)
 on conflict(user_id) do update set pode_editar=excluded.pode_editar;
end $$;
revoke all on function public.admin_listar_usuarios(),public.admin_definir_permissao(uuid,boolean) from public,anon;
grant execute on function public.admin_listar_usuarios(),public.admin_definir_permissao(uuid,boolean) to authenticated;
commit;
