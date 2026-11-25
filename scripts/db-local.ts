// npm run db:local — creates Modulus's database on a developer's PostgreSQL server: database `modulus_dev` (MODULUS_LOCAL_DATABASE),
// role modulus_app (password MODULUS_LOCAL_PASSWORD, default "modulus-dev") and schema `modulus`, the layout of the shared EPC2I
// server (Matrix). Connects with MODULUS_ADMIN_URL (a superuser; default postgres://postgres:postgres@127.0.0.1:5432/postgres)
// and prints the DATABASE_URL to put in .env.local. Then: npm run db:migrate. Never run it against the shared server: there,
// Matrix's base layer creates the role and the schema.
import pg from 'pg';
import { loadEnvFiles } from '@/server/config/env-files';
import { appUrlOf, provisionDatabase, provisionSchema, withDatabase } from '@/server/db/provision';

async function main(): Promise<void> {
  loadEnvFiles(process.cwd());
  const adminUrl = process.env.MODULUS_ADMIN_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres';
  const database = process.env.MODULUS_LOCAL_DATABASE || 'modulus_dev';
  const password = process.env.MODULUS_LOCAL_PASSWORD || 'modulus-dev';
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await provisionDatabase(admin, { database, password });
  } finally {
    await admin.end();
  }
  const inDb = new pg.Client({ connectionString: withDatabase(adminUrl, database) });
  await inDb.connect();
  try {
    await provisionSchema(inDb);
  } finally {
    await inDb.end();
  }
  console.log(`Database "${database}" ready (role modulus_app, schema modulus).\nDATABASE_URL=${appUrlOf(adminUrl, database, password)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
