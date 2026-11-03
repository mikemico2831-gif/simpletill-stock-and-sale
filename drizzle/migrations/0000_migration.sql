create type public.app_role as enum ('admin', 'cashier');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- First user becomes admin; everyone else cashier
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'cashier');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created_role after insert on auth.users
  for each row execute function public.handle_new_user_role();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  category text,
  price numeric(12,2) not null default 0,
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "staff read products" on public.products for select to authenticated using (true);
create policy "admin insert products" on public.products for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "admin update products" on public.products for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin delete products" on public.products for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null,
  total numeric(12,2) not null,
  paid numeric(12,2) not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.sales to authenticated;
grant all on public.sales to service_role;
alter table public.sales enable row level security;
create policy "read sales" on public.sales for select to authenticated
  using (cashier_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Checkout: validates stock, computes total from DB prices, records sale atomically
create or replace function public.checkout(_items jsonb, _paid numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  it jsonb; p record; q int; tot numeric := 0; lines jsonb := '[]'::jsonb; sid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Cart is empty'; end if;
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'qty')::int;
    if q <= 0 then raise exception 'Invalid quantity'; end if;
    select * into p from public.products where id = (it->>'product_id')::uuid for update;
    if not found then raise exception 'Product not found'; end if;
    if p.stock < q then raise exception 'Not enough stock for %', p.name; end if;
    update public.products set stock = stock - q, updated_at = now() where id = p.id;
    tot := tot + p.price * q;
    lines := lines || jsonb_build_object('product_id', p.id, 'name', p.name, 'price', p.price, 'qty', q);
  end loop;
  if _paid < tot then raise exception 'Payment is less than total'; end if;
  insert into public.sales(cashier_id, total, paid, items) values (auth.uid(), tot, _paid, lines) returning id into sid;
  return sid;
end; $$;
revoke execute on function public.checkout(jsonb, numeric) from public, anon;
grant execute on function public.checkout(jsonb, numeric) to authenticated;

insert into public.products(name, sku, category, price, stock) values
 ('Iced Coffee', 'BEV-001', 'Drinks', 120, 50),
 ('Hot Latte', 'BEV-002', 'Drinks', 140, 50),
 ('Bottled Water', 'BEV-003', 'Drinks', 25, 100),
 ('Ham Sandwich', 'FD-001', 'Food', 95, 30),
 ('Chocolate Muffin', 'FD-002', 'Food', 75, 40),
 ('Ensaymada', 'FD-003', 'Food', 45, 40);