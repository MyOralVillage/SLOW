# OIM Backend (NestJS + PostgreSQL)

## Requirements
- Node 20+
- PostgreSQL (via docker-compose in repo root or your own instance)

## Setup
1. Copy env:

```bash
cp .env.example .env
```

2. Install deps:

```bash
npm install
```

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Apply migrations (requires Postgres running):

```bash
npm run prisma:migrate
```

5. Run:

```bash
npm run dev
```

Server listens at `http://127.0.0.1:3001/api`.

