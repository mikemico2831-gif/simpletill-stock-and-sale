drop policy "staff read products" on public.products;
create policy "staff read products" on public.products for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'cashier'));