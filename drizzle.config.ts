import { defineConfig } from 'drizzle-kit';

// Modulus's tables live in the schema `modulus` (src/server/db/schema/_schema.ts); the journal is modulus.__drizzle_migrations.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema/index.ts',
  out: './drizzle',
  schemaFilter: ['modulus'],
  migrations: { schema: 'modulus', table: '__drizzle_migrations' },
});
