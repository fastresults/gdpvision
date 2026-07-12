## Grant super-admin to two users

Promote `fastresults@gmail.com` and `stachio@madebyopen.com` to the `admin` role in the existing `user_roles` table (the security-definer `has_role(_user_id, 'admin')` function already gates every admin-only server function and admin route, so inserting these rows is all that's needed — no schema or code changes).

### Steps

1. **Confirm both accounts exist.** Read `auth.users` for the two emails. If either has never signed up, stop and ask the user to have that person sign up first (an admin role can only attach to an existing auth user id).
2. **Insert admin rows.** For each found user, insert `(user_id, role='admin', country_code=NULL)` into `public.user_roles` with `ON CONFLICT (user_id, role, country_code) DO NOTHING`, so re-running is safe and no duplicates are created.
3. **Write an audit entry.** Append one row per grant to `public.audit_log` with `action='role.granted'`, `target_type='user'`, `target_id=<user_id>`, and metadata `{ email, role: 'admin', via: 'manual super-admin promotion' }` — matches the pattern the admin console uses.
4. **Verify.** Re-read `user_roles` joined to `auth.users` for those two emails and confirm both have an `admin` row.

### Technical notes

- Uses the `insert` tool (data change), not a migration — no schema edits.
- No new grants/policies needed: `user_roles` already has `SELECT` for `authenticated` and full access for `service_role`; `has_role` is `SECURITY DEFINER`.
- `country_code` stays `NULL` so this is a global (instance-wide) admin, matching how `assertAdmin` checks the role in `src/lib/admin.functions.ts`.
- No code changes, no redeploy — the two users get admin access on their next page load.
