// Modulus's PostgreSQL schema. Every table is declared in it (`modulus.table(…)`, never `pgTable(…)`), so the migrations and
// the queries name `"modulus".` explicitly. This object is deliberately NOT re-exported by ./index.ts: drizzle-kit would then
// start a migration with CREATE SCHEMA, which modulus_app may not run (the schema is created by Matrix, or by `npm run db:local`).
import { pgSchema } from 'drizzle-orm/pg-core';
import { SERVER_SCHEMA } from '../server-schema';

export const modulus = pgSchema(SERVER_SCHEMA);
