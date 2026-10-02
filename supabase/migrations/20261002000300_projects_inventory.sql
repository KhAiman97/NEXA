-- 03 · Prototyping & Project Inventory
-- Electronics, SBCs, DIY builds. Parts are tracked once (inventory_items) and
-- allocated to builds through a bill of materials (project_components).
-- Project expense tags: projects.expense_tag + transactions.project_id (next migration).

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  expense_tag  text not null check (expense_tag ~ '^[a-z0-9][a-z0-9_-]*$'),
  status       text not null default 'idea'
                 check (status in ('idea', 'active', 'paused', 'done', 'abandoned')),
  description  text,
  budget       numeric(14, 2) check (budget >= 0),
  started_on   date,
  completed_on date,
  colour       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, expense_tag),
  check (completed_on is null or started_on is null or completed_on >= started_on)
);

create table public.inventory_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null,
  category       text not null default 'other'
                   check (category in (
                     'sbc', 'microcontroller', 'sensor', 'module', 'display', 'power',
                     'passive', 'connector', 'cable', 'enclosure', 'tool', 'storage', 'networking', 'other'
                   )),
  manufacturer   text,
  model          text,
  sku            text,
  serial_number  text,
  quantity       integer not null default 1 check (quantity >= 0),
  reorder_level  integer not null default 0 check (reorder_level >= 0),
  unit_cost      numeric(14, 2) not null default 0 check (unit_cost >= 0),
  status         text not null default 'in_stock'
                   check (status in ('in_stock', 'in_use', 'reserved', 'broken', 'sold')),
  location       text,
  vendor         text,
  product_url    text,
  purchased_on   date,
  warranty_until date,
  specs          jsonb not null default '{}'::jsonb,
  notes          text,
  liability_id   uuid,              -- hardware bought on an installment plan
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, liability_id) references public.liabilities (user_id, id)
    on delete set null (liability_id)
);

create table public.project_components (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  item_id    uuid not null,
  quantity   integer not null default 1 check (quantity > 0),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, item_id),
  foreign key (user_id, project_id) references public.projects (user_id, id) on delete cascade,
  foreign key (user_id, item_id) references public.inventory_items (user_id, id) on delete cascade
);

create index on public.projects (user_id, status);
create index on public.inventory_items (user_id, category);
create index on public.inventory_items (user_id, status);
create index on public.inventory_items (user_id, liability_id);
create index on public.project_components (user_id, item_id);

alter table public.projects enable row level security;
create policy "Users see own data" on public.projects for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.inventory_items enable row level security;
create policy "Users see own data" on public.inventory_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.project_components enable row level security;
create policy "Users see own data" on public.project_components for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
