import 'server-only';
// Shared pieces of the writing Server Functions: the viewer and its right, the yearly references, the result type and the
// form parsing. Every Server Function validates its input (zod) and the right server-side, re-reads what it changes inside its
// transaction (a deal through the team rule), applies the pure rules again, then writes in ONE transaction with its audit row.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { can, FORBIDDEN, type Right } from '@/domain/rights';
import { getDb } from '@/server/db/client';
import { writeAudit, type AuditInput } from '@/server/db/helpers';
import type { Tx } from '@/server/db/types';
import { businessToday } from '@/server/clock';
import { getViewer, type Viewer } from '@/server/session';
import { Refusal } from './refusal';

export { Refusal, nextRef } from './refusal';

export type ActionResult = { ok: true } | { ok: false; error: string };

export const ok = (): ActionResult => ({ ok: true });
export const refuse = (error: string): ActionResult => ({ ok: false, error });

/** The viewer when one of their roles carries the right, else a refusal. */
export async function viewerWith(right: Right): Promise<Viewer> {
  const v = await getViewer();
  if (!can(v.roles, right)) throw new Refusal(FORBIDDEN);
  return v;
}

/** Runs a Server Function body: refusals and validation errors become a result; anything else is logged and generic. */
export async function run(body: () => Promise<void>, paths: string[] = ['/']): Promise<ActionResult> {
  try {
    await body();
  } catch (e) {
    if (e instanceof Refusal) return refuse(e.message);
    if (e instanceof z.ZodError) return refuse(e.issues[0]?.message ?? 'Invalid input');
    const code = (e as { cause?: { code?: string }; code?: string })?.cause?.code ?? (e as { code?: string })?.code;
    if (code === '23514') return refuse('The database refused a value that breaks a rule');
    if (code === '23505') return refuse('This already exists');
    if (code === '23001') return refuse('This is frozen and cannot be changed');
    console.error('[action]', e);
    return refuse('The change could not be saved');
  }
  for (const p of paths) revalidatePath(p, p === '/' ? 'layout' : 'page');
  return ok();
}

/** An audit row of the viewer. */
export const audit = (t: Tx, v: Viewer, e: Omit<AuditInput, 'actorName' | 'actorUserId' | 'actorRole'>) =>
  writeAudit(t, { ...e, actorName: v.name, actorUserId: v.userId, actorRole: v.role });

export async function tx<T>(body: (tx: Tx, today: string) => Promise<T>): Promise<T> {
  const db = await getDb();
  const today = await businessToday();
  return db.transaction((t) => body(t, today));
}

// ── Form parsing ─────────────────────────────────────────────────────────────────────────────────────────────────────

const blank = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');
export const str = (fd: FormData, k: string) => blank(fd.get(k));
export const opt = (fd: FormData, k: string) => blank(fd.get(k)) || null;
export const num = (fd: FormData, k: string) => {
  const s = blank(fd.get(k)).replace(',', '.').replace(/\s/g, '');
  return s ? Number(s) : null;
};
export const all = (fd: FormData, k: string) => fd.getAll(k).map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
export const bool = (fd: FormData, k: string) => fd.get(k) === 'on' || fd.get(k) === 'true';
export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A date is expected');
export const reasonOf = (fd: FormData) => {
  const r = str(fd, 'reason');
  if (r.length < 3) throw new Refusal('A reason is required');
  return r.slice(0, 1000);
};
