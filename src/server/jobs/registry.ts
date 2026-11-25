import 'server-only';
// Modulus's scheduled jobs: the schema backup (when MODULUS_BACKUP_DIR is set), the outbox to Codex (simulated), and the daily schema declaration to Matrix (when
// MATRIX_URL or MATRIX_DECLARATIONS_DIR is set). Business jobs (reminders, late reviews, snapshots) come with their deliveries.
import path from 'node:path';
import { backupSchema } from '@/server/backup';
import { getConfig } from '@/server/config';
import { declareModulusSchema } from '@/server/integrations/matrix';
import { matrixDeclarationEnabled } from '@/server/integrations/matrix/declare-schema';
import type { PostgresHandle } from '@/server/db/postgres';
import type { Job } from './runner';

export function modulusJobs(h: PostgresHandle): Job[] {
  const cfg = getConfig();
  return [
    {
      name: 'backup',
      everyMin: cfg.backup.everyMin,
      enabled: !!cfg.backup.dir && !!cfg.database,
      async run() {
        const r = await backupSchema({ databaseUrl: cfg.database!.url, dir: cfg.backup.dir!, retentionDays: cfg.backup.retentionDays });
        return `${path.basename(r.file)}${r.deleted.length ? `, ${r.deleted.length} expired removed` : ''}`;
      },
    },
    {
      // The outbox to Codex (simulated connector: docs/spec/05, nothing leaves the server).
      name: 'outbox',
      everyMin: 5,
      enabled: !!cfg.database,
      async run() {
        const { runOutbox } = await import('@/server/integrations/codex/outbox');
        const n = await runOutbox(h.db);
        return `${n} message${n === 1 ? '' : 's'} handled`;
      },
    },
    {
      name: 'matrix-declare',
      everyMin: 1440,
      enabled: matrixDeclarationEnabled(process.env),
      async run() {
        await declareModulusSchema((q) => h.pool.query(q).then((r) => r.rows as Record<string, unknown>[]));
      },
    },
  ];
}
