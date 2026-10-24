-- O cadastro passa a exigir somente categoria = cabo, sem subtipo BT/MT.
-- Mantém a coluna histórica inativa para compatibilidade com o backup e a carga original.
-- Nenhum ID, descrição, vínculo ou registro é removido.
begin;
do $$
declare restricao record; coluna smallint;
begin
  select attnum into coluna from pg_attribute where attrelid = 'public.materiais'::regclass and attname = 'tipo_cabo' and not attisdropped;
  if coluna is not null then
    for restricao in select conname from pg_constraint where conrelid = 'public.materiais'::regclass and contype = 'c' and coluna = any(conkey)
    loop execute format('alter table public.materiais drop constraint %I', restricao.conname); end loop;
  end if;
end $$;
commit;
