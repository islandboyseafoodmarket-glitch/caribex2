begin;

-- Ferry manifests are accessed by administrators through the app backend.
-- Anonymous ferry access must go through a token-validating server route.
alter table public.ferry_manifests enable row level security;
alter table public.ferry_manifest_entries enable row level security;

drop policy if exists ferry_manifests_admin_select on public.ferry_manifests;
drop policy if exists ferry_manifests_admin_insert on public.ferry_manifests;
drop policy if exists ferry_manifests_admin_update on public.ferry_manifests;
drop policy if exists ferry_manifests_admin_delete on public.ferry_manifests;

drop policy if exists ferry_manifest_entries_admin_select on public.ferry_manifest_entries;
drop policy if exists ferry_manifest_entries_admin_insert on public.ferry_manifest_entries;
drop policy if exists ferry_manifest_entries_admin_update on public.ferry_manifest_entries;
drop policy if exists ferry_manifest_entries_admin_delete on public.ferry_manifest_entries;

create policy ferry_manifests_admin_select
on public.ferry_manifests
for select
to authenticated
using (
  exists (
    select 1
    from public.administradores a
    where a.id = auth.uid()
  )
);

create policy ferry_manifests_admin_insert
on public.ferry_manifests
for insert
to authenticated
with check (
  creado_por = auth.uid()
  and exists (
    select 1
    from public.administradores a
    where a.id = auth.uid()
  )
);

create policy ferry_manifests_admin_update
on public.ferry_manifests
for update
to authenticated
using (
  exists (
    select 1
    from public.administradores a
    where a.id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.administradores a
    where a.id = auth.uid()
  )
);

create policy ferry_manifests_admin_delete
on public.ferry_manifests
for delete
to authenticated
using (
  exists (
    select 1
    from public.administradores a
    where a.id = auth.uid()
  )
);

create policy ferry_manifest_entries_admin_select
on public.ferry_manifest_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.administradores a
    where a.id = auth.uid()
  )
);

create policy ferry_manifest_entries_admin_insert
on public.ferry_manifest_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.administradores a
    where a.id = auth.uid()
  )
);

create policy ferry_manifest_entries_admin_update
on public.ferry_manifest_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.administradores a
    where a.id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.administradores a
    where a.id = auth.uid()
  )
);

create policy ferry_manifest_entries_admin_delete
on public.ferry_manifest_entries
for delete
to authenticated
using (
  exists (
    select 1
    from public.administradores a
    where a.id = auth.uid()
  )
);

commit;
