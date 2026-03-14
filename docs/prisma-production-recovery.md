# Prisma production recovery

This backend no longer runs `prisma migrate deploy` during the Vercel build. Build success should not depend on the target database already being in a clean migration state.

## Current production issue

The target database has a failed Prisma migration recorded:

- Migration: `20260309071033_v2`
- Error surface: `P3009`
- SQL in that migration:

```sql
ALTER TABLE `users` ADD COLUMN `elo` INTEGER NULL DEFAULT 750;
```

When Prisma sees a failed row in `_prisma_migrations`, it blocks every later `migrate deploy` until the failure is resolved.

## Why this commonly happens

This specific migration usually fails because the `users.elo` column already exists in the target database, either from a manual schema change or a partially applied earlier deploy.

## Recovery steps

Run these commands from `backend/` against the production database.

1. Verify whether the column already exists:

```sql
SHOW COLUMNS FROM `users` LIKE 'elo';
```

2. If the column exists, mark the failed migration as applied:

```bash
npx prisma migrate resolve --applied 20260309071033_v2
```

3. If the column does not exist, mark the failed migration as rolled back:

```bash
npx prisma migrate resolve --rolled-back 20260309071033_v2
```

4. After that, apply pending migrations normally:

```bash
npm run db:migrate:deploy
```

## Notes

- Do not delete rows from `_prisma_migrations` manually unless you have no safer option and understand the consequences.
- Do not switch to `prisma db push` in production to bypass migration history. That hides the state problem instead of resolving it.
- If step 4 fails on a later migration, inspect that migration's SQL and the live schema before resolving it.