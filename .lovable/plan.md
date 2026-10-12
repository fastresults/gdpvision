# Remove duplicate admin grants for stachio@madebyopen.com

## Why it happened
The roles table should block the same role from being given twice. It checks the combination person + role + country. A global admin role has no country (it is blank). The database treats every blank as different from every other blank, so the duplicate check never triggers for global roles. Each time the admin role was granted (three saves within 43 seconds, 12:20:51, 12:21:29, 12:21:34), a new row was added instead of the existing one being reused. The grant screen ran correctly; the gap is in how the database checks for duplicates.

## Steps
1. Delete the 2nd and 3rd rows (ids `1b39ea62-…` and `c002be2c-…`) and keep the first grant from 12:20:51.
2. Check every other user for the same kind of duplicate global role and remove those too, keeping the earliest row.
3. Fix the cause: replace the duplicate check with one that treats a blank country as a single value, so granting a global role twice updates the existing row instead of adding another.
4. Confirm that stachio has exactly one admin row and still has admin access.

## Technical details
- Data cleanup via run_sql: `delete from user_roles where id in ('1b39ea62-ebbd-4503-8743-f703eb7fc910','c002be2c-ded1-404b-bdf5-5c2709fc2480')`, plus a generic dedupe keeping min(created_at) per (user_id, role, country_code) where country_code is null.
- Migration: drop constraint `user_roles_user_id_role_country_code_key` and recreate as `UNIQUE NULLS NOT DISTINCT (user_id, role, country_code)`. The existing upserts (`onConflict: "user_id,role,country_code"`) in `country-admin.functions.ts` then work correctly for global roles.
