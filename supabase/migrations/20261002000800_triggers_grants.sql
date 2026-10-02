-- 08 · updated_at triggers + grants
-- Attaches set_updated_at() to every public base table that has an updated_at column.
-- Re-run this block (or add a trigger by hand) when you create new tables later.

do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- Newer Supabase projects do not auto-expose new public tables to the Data API.
-- RLS (enabled on every table) is what actually limits rows; anon gets nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
