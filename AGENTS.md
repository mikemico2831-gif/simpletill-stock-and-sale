<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

- Roles live in `public.user_roles` (admin/cashier); first signup becomes admin via trigger — never store roles on user metadata.
- Checkout goes through the `public.checkout` database function so totals and stock are computed server-side, not trusted from the browser.
- Signed-in pages live under `src/routes/_authenticated/`; admin page also checks the admin role in `beforeLoad`, and RLS enforces it.
