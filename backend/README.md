# Elysia with Bun runtime

## Getting Started
To get started with this template, simply paste this command into your terminal:
```bash
bun create elysia ./elysia-example
```

## Development
To start the development server run:
```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.

## Prisma migrations

This backend uses Prisma migrations from `prisma/migrations`.

```bash
bun run generate
bun run migrate:dev --name <migration_name>
bun run migrate:deploy
bun run migrate:status
bun run seed
```

For an existing database that already matches `prisma/schema.prisma`, mark the initial migration as applied before deploying new migrations:

```bash
bunx prisma migrate resolve --applied 00000000000000_init
```
