-- Store Manager schema for Supabase. Run in SQL Editor after creating a project.
-- Each authenticated user belongs to one store via profiles. Create a store, then
-- insert its owner profile using the user's Auth UUID. See setup notes after the SQL.
create extension if not exists pgcrypto;

create table if not exists public.stores(id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade, store_id uuid not null references public.stores(id) on delete cascade, role text not null check(role in ('owner','staff')), created_at timestamptz not null default now());
create table if not exists public.products(
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
 name text not null, unit_size numeric, unit_type text check(unit_type is null or unit_type in ('ml','L','g','kg','pcs','pack')),
 category text, sku text, buy_price numeric not null default 0 check(buy_price>=0), sell_price numeric not null check(sell_price>=0), wholesale_price numeric check(wholesale_price is null or wholesale_price>=0),
 stock integer not null default 0 check(stock>=0), reorder_level integer not null default 5 check(reorder_level>=0), photo_url text, purchases jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(store_id,sku)
);
create table if not exists public.customers(
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, name text not null, shop_name text,
 phone text not null, alternative_phone text, email text, address text, area text, notes text, customer_type text not null check(customer_type in ('retail','wholesale')),
 credit_limit numeric check(credit_limit is null or credit_limit>=0), outstanding_balance numeric not null default 0 check(outstanding_balance>=0), created_at timestamptz not null default now()
);
create table if not exists public.orders(
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, customer_id uuid references public.customers(id) on delete set null,
 customer_name text, status text not null default 'Pending' check(status in ('Pending','Confirmed','Delivered','Cancelled')), total numeric not null default 0 check(total>=0), payment_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.order_items(
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null, product_name text not null, quantity integer not null check(quantity>0), unit_price numeric not null check(unit_price>=0), subtotal numeric not null check(subtotal>=0)
);
create table if not exists public.stock_movements(
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade, product_id uuid references public.products(id) on delete set null,
 quantity integer not null, reason text not null, purchase_date date, buy_price numeric, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create or replace function public.my_store_id() returns uuid language sql stable security definer set search_path=public as $$ select store_id from public.profiles where id=auth.uid() $$;
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='owner') $$;
grant execute on function public.my_store_id(), public.is_owner() to authenticated;

alter table public.stores enable row level security; alter table public.profiles enable row level security;
alter table public.products enable row level security; alter table public.customers enable row level security;
alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.stock_movements enable row level security;

-- Store staff can read their profile/store; owners manage profiles.
create policy "profile self or owner read" on public.profiles for select to authenticated using (id=auth.uid() or (store_id=public.my_store_id() and public.is_owner()));
create policy "owners manage profiles" on public.profiles for all to authenticated using (store_id=public.my_store_id() and public.is_owner()) with check (store_id=public.my_store_id() and public.is_owner());
create policy "staff read own store" on public.stores for select to authenticated using (id=public.my_store_id());
create policy "owner update store" on public.stores for update to authenticated using (id=public.my_store_id() and public.is_owner()) with check (id=public.my_store_id() and public.is_owner());

-- Product rows are visible within the store. Staff may change stock and selling fields, not cost fields or delete.
create policy "read store products" on public.products for select to authenticated using (store_id=public.my_store_id());
create policy "owner insert products" on public.products for insert to authenticated with check (store_id=public.my_store_id() and public.is_owner());
create policy "owner update products" on public.products for update to authenticated using (store_id=public.my_store_id() and public.is_owner()) with check (store_id=public.my_store_id() and public.is_owner());
create policy "staff update products" on public.products for update to authenticated using (store_id=public.my_store_id() and not public.is_owner()) with check (store_id=public.my_store_id() and not public.is_owner());
create policy "owner delete products" on public.products for delete to authenticated using (store_id=public.my_store_id() and public.is_owner());
-- Column-level grants: staff cannot read/write costs or purchase history, even though row access is allowed.
revoke all on public.products from anon, authenticated;
grant select(id,store_id,name,unit_size,unit_type,category,sku,sell_price,wholesale_price,stock,reorder_level,photo_url,created_at,updated_at) on public.products to authenticated;
grant insert(id,store_id,name,unit_size,unit_type,category,sku,buy_price,sell_price,wholesale_price,stock,reorder_level,photo_url,purchases) on public.products to authenticated;
grant update(name,unit_size,unit_type,category,sku,sell_price,wholesale_price,stock,reorder_level,photo_url,updated_at) on public.products to authenticated;
grant delete on public.products to authenticated;
-- Owner-only secured RPC for costs and product create/update (RLS remains active).
create or replace function public.owner_product_costs() returns table(id uuid,buy_price numeric,purchases jsonb) language plpgsql security definer set search_path=public as $$ begin if not public.is_owner() then raise exception 'Owner access required'; end if; return query select p.id,p.buy_price,p.purchases from public.products p where p.store_id=public.my_store_id(); end $$;
create or replace function public.owner_save_product(p_product jsonb) returns void language plpgsql security definer set search_path=public as $$ declare sid uuid:=public.my_store_id(); pid uuid:=(p_product->>'id')::uuid; begin if not public.is_owner() then raise exception 'Owner access required'; end if; insert into public.products(id,store_id,name,unit_size,unit_type,category,sku,buy_price,sell_price,wholesale_price,stock,reorder_level,photo_url,purchases) values(pid,sid,p_product->>'name',nullif(p_product->>'unit_size','')::numeric,p_product->>'unit_type',nullif(p_product->>'category',''),nullif(p_product->>'sku',''),coalesce(nullif(p_product->>'buy_price','')::numeric,0),(p_product->>'sell_price')::numeric,nullif(p_product->>'wholesale_price','')::numeric,coalesce((p_product->>'stock')::integer,0),coalesce((p_product->>'reorder_level')::integer,5),p_product->>'photo_url',coalesce(p_product->'purchases','[]'::jsonb)) on conflict(id) do update set name=excluded.name,unit_size=excluded.unit_size,unit_type=excluded.unit_type,category=excluded.category,sku=excluded.sku,buy_price=excluded.buy_price,sell_price=excluded.sell_price,wholesale_price=excluded.wholesale_price,stock=excluded.stock,reorder_level=excluded.reorder_level,photo_url=excluded.photo_url,purchases=excluded.purchases,updated_at=now() where products.store_id=sid; end $$;
grant execute on function public.owner_product_costs(), public.owner_save_product(jsonb) to authenticated;

create policy "store customers read" on public.customers for select to authenticated using (store_id=public.my_store_id());
create policy "staff can manage customers" on public.customers for insert to authenticated with check (store_id=public.my_store_id());
create policy "staff can update customers" on public.customers for update to authenticated using (store_id=public.my_store_id()) with check (store_id=public.my_store_id());
create policy "owner delete customers" on public.customers for delete to authenticated using (store_id=public.my_store_id() and public.is_owner());
create policy "store orders read" on public.orders for select to authenticated using (store_id=public.my_store_id());
create policy "staff create orders" on public.orders for insert to authenticated with check (store_id=public.my_store_id());
create policy "staff update orders" on public.orders for update to authenticated using (store_id=public.my_store_id()) with check (store_id=public.my_store_id());
create policy "owner delete orders" on public.orders for delete to authenticated using (store_id=public.my_store_id() and public.is_owner());
create policy "store order items access" on public.order_items for all to authenticated using (store_id=public.my_store_id()) with check (store_id=public.my_store_id());
create policy "store stock movements read" on public.stock_movements for select to authenticated using (store_id=public.my_store_id());
create policy "staff stock movements insert" on public.stock_movements for insert to authenticated with check (store_id=public.my_store_id());
create policy "owner manage stock movements" on public.stock_movements for all to authenticated using (store_id=public.my_store_id() and public.is_owner()) with check (store_id=public.my_store_id() and public.is_owner());

-- Staff-safe product view. App selects this view; cost columns are only exposed by the owner RPC.
create or replace view public.products_staff with (security_invoker=true) as select id,store_id,name,unit_size,unit_type,category,sku,sell_price,wholesale_price,stock,reorder_level,photo_url,created_at,updated_at from public.products;
grant select on public.products_staff to authenticated;
-- Enable realtime updates for shared records.
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.customers;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
