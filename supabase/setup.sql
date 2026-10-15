-- Folha Semanal: banco de dados e anexos.
-- Rode tudo de uma vez no Supabase: SQL Editor → New query → cole → Run.
-- Pode rodar de novo sem problema.

-- 1. Tabela onde ficam folhas, notas, lembretes e ajustes (um registro por item)
create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 2. Cada pessoa só enxerga e altera os próprios dados
alter table public.docs enable row level security;
drop policy if exists "docs_select_own" on public.docs;
drop policy if exists "docs_insert_own" on public.docs;
drop policy if exists "docs_update_own" on public.docs;
drop policy if exists "docs_delete_own" on public.docs;
create policy "docs_select_own" on public.docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "docs_insert_own" on public.docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "docs_update_own" on public.docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "docs_delete_own" on public.docs for delete to authenticated using ((select auth.uid()) = user_id);

-- 3. Atualização em tempo real entre aparelhos
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 4. Pasta privada para imagens, anexos e áudios (até 50 MB por arquivo)
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "anexos_select_own" on storage.objects;
drop policy if exists "anexos_insert_own" on storage.objects;
drop policy if exists "anexos_delete_own" on storage.objects;
create policy "anexos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "anexos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "anexos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text);
