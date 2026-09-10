# Database migrations

Forward-only SQL migrations applied by a tiny runner (`src/db/migrate.js`) — no
ORM migration tooling, no DDL from the application/startup path.

## Files

- `0000_baseline_schema.sql` — the complete schema as of adoption, consolidated
  from the old `src/scripts/setup.js`, `db.js` `ensureIndexes()`, and the
  hand-written `001`/`002` migrations. Every statement is `IF NOT EXISTS` /
  `CREATE OR REPLACE`, so it is a no-op on a database that already has the schema.
- `NNNN_description.sql` — each later change, zero-padded and ordered. Files are
  applied in filename order, each in its own transaction, and recorded in the
  `schema_migrations` table so they run exactly once.
- `seeds/` — reserved for seed **data** SQL. Demo/reference data is currently
  seeded by `npm run seed` (`src/scripts/seed.js`), not from here.

## Commands

```bash
npm run migrate            # apply every pending migration
npm run migrate:status     # show applied vs pending
npm run migrate:baseline   # record all current files as applied WITHOUT running
                           # them — run once when adopting the runner on a DB
                           # that already has the schema (e.g. production)
```

## Adopting on an existing database (production / existing dev)

The schema is already there, so record the baseline instead of executing it:

```bash
npm run migrate:baseline
```

## A fresh database

```bash
npm run migrate      # builds the schema from 0000_baseline_schema.sql
npm run seed         # demo data (optional)
```

## Adding a change

1. Create `migrations/0001_add_doctor_id_to_patients.sql` (next number).
2. Write plain SQL. Keep it idempotent where practical.
3. `npm run migrate:status` to confirm it is picked up, then `npm run migrate`.
4. Commit the file. CI applies migrations against a throwaway Postgres to prove
   they build from scratch and are safe to re-run.

## Deployment

Run `npm run migrate` against the target database as a release step **before**
the new server code goes live. It is not run automatically by the app.
