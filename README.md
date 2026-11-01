# AgriShield

**Crop Disease Intelligence and Agricultural Insurance Management System**
DBMS Experiential Learning, Level 3 project (two-member team)

AgriShield connects a farmer's land parcel to its insurance policy, the crop damage the farmer reports, the diseases that match those symptoms, the inspector's confirmation, the insurance claim, and the final payout, in one traceable chain.

| Data | Stored in | Why |
|---|---|---|
| Users, farmers, parcels, policies, reports, claims, payouts, audit trail | **PostgreSQL** | Fixed structure, money, strict rules, joins and transactions |
| Field sensor / weather / drone readings | **MongoDB** | Every device sends different fields; high-volume time series |
| Disease and symptom embeddings | **pgvector** (inside PostgreSQL) | Search by meaning, not exact words |

Full design, ER diagram, data dictionary and test results: [`docs/PROJECT_REPORT.md`](docs/PROJECT_REPORT.md).

---

## 1. What you need

- **Node.js 20+**
- **PostgreSQL 15+ with the pgvector extension.** Easiest options:
  - Docker: `docker run -d --name agri-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 pgvector/pgvector:pg16`
  - or a free cloud database (Neon / Supabase both include pgvector)
- **MongoDB 5.0+** (the aggregations use `$dateTrunc`).
  - Docker: `docker run -d --name agri-mongo -p 27017:27017 mongo:7`
  - or a free MongoDB Atlas cluster

## 2. Setup

```bash
git clone <your-repo-url> agrishield
cd agrishield
npm install

cp .env.example .env.local        # then edit the values
```

Create the database once (Docker example):

```bash
docker exec -it agri-pg psql -U postgres -c "CREATE DATABASE agrishield;"
```

Set in `.env.local`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agrishield
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=agrishield
AUTH_SECRET=<output of: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
```

Then load everything:

```bash
npm run db:setup      # PostgreSQL: tables, triggers, functions, indexes, views, sample data
npm run db:test       # 21 integrity tests (all should PASS; changes are rolled back)
npm run mongo:setup   # MongoDB: collection + validator + indexes + 30 days of simulated telemetry
npm run embed         # downloads all-MiniLM-L6-v2 (~25 MB, first time only) and fills every vector
npm run dev           # http://localhost:3000
```

`npm run setup` runs `db:setup`, `mongo:setup` and `embed` in one go.

## 3. Demo logins

All passwords: `Agri@1234`

| Role | Email | Lands on |
|---|---|---|
| Farmer | ravi@example.com, lakshmi@example.com, manjunath@example.com, fatima@example.com | Overview |
| Agricultural inspector | inspector@agrishield.in | Reports to review |
| Insurance administrator | admin@agrishield.in | Claims to decide |

New farmers can also sign up at `/register`. Inspector and admin accounts are not self-service.

## 4. Demo script (about 8 minutes)

1. **Farmer** (ravi) → *Report crop damage* → parcel *North paddy field*, crop *Rice*, symptoms: “grey patches on the stem near the water, spreading upwards”. The top matches appear with similarity scores (pgvector).
2. *Disease library* → type “yellow powder in lines on leaves”. Compare the meaning-based results with the keyword results (vector search vs full-text search).
3. *My claims* → pick the new report → the policy list shows only eligible policies → file a claim. Try an amount above the cover to show the trigger rejecting it.
4. **Inspector** → *Reports to review* → open the report → see suggested diseases and similar reports from other farms → confirm a disease.
5. **Admin** → *Claims to decide* → open the claim → approve with payment reference `DBT-2026-000101` (already used) → error, and the claim is still *Pending* (transaction rolled back). Approve again with the suggested reference → approved and paid. Show the history timeline written by the trigger.
6. *Analytics* → claims by status/crop (GROUP BY, HAVING), district hotspots (view), policy cover used, sensor risk signals (MongoDB aggregation).
7. Terminal: `npm run db:test` and `npm run mongo:demo`. In psql, run `db/postgres/07_transaction_demo.sql`.

## 5. Project structure

```
db/postgres/
  01_schema.sql              CREATE TABLE, PK/FK, CHECK, UNIQUE, EXCLUDE constraints
  02_functions_triggers.sql  5 triggers + stored functions (approve/reject, vector match, eligibility)
  03_indexes.sql             B-tree, composite, partial, expression, HNSW (vector), GIN (full-text)
  04_views.sql               4 dashboard views
  05_seed.sql                sample data
  06_queries.sql             JOIN / GROUP BY / HAVING / subqueries / window / vector / FTS / DML
  07_transaction_demo.sql    COMMIT, ROLLBACK, SAVEPOINT demonstrations
  08_alter_drop_demo.sql     ALTER / DROP demonstrations
  09_integrity_tests.sql     21 automated constraint tests
scripts/                     setup, embedding and MongoDB scripts (npm run ...)
src/lib/                     db pool + transactions, MongoDB client, session, validation, embeddings
src/app/api/                 REST API (Next.js Route Handlers), every route checks the role
src/app/                     pages (farmer, inspector, admin)
docs/                        project report and test cases
```

## 6. Security notes

- Passwords are bcrypt-hashed (cost 12); the database rejects anything that doesn't look like a bcrypt hash.
- Sessions are signed JWTs in an `httpOnly`, `sameSite=lax` cookie.
- Every SQL statement is parameterised (`$1, $2…`); no user input is concatenated into SQL.
- Roles are checked twice: in `middleware.js` for pages and inside every API route.
- All credentials come from environment variables. `.env*` files are git-ignored. Never commit them.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `type "vector" does not exist` | Your Postgres has no pgvector. Use the `pgvector/pgvector` Docker image, Neon, or Supabase. |
| `$dateTrunc` error | MongoDB is older than 5.0. Use `mongo:7`. |
| Search page shows “Run npm run embed” | Vectors are empty. Run `npm run embed`. |
| `npm run embed` can't download | Needs internet access to huggingface.co the first time; afterwards it's cached. |
| Analytics says telemetry unavailable | MongoDB isn't running or `MONGODB_URI` is wrong. The rest of the app still works. |
