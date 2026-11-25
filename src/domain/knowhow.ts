// What we know how to do (docs/spec/04, D-12): a level per machine × option computed from the traces — quotations, offers,
// sales, deliveries with their real cost — never entered. Engineering may add a note and, with a reason, mark an option "to
// avoid". Also the catalogue's life: specific options to bring into the catalogue, catalogue options unsold for a long time.
// Pure; thresholds from the settings (adjustable).
import type { Settings } from './settings';
import type { KnowhowLevel } from './vocab';

export interface Delivery {
  /** Real cost / budget − 1 (0.08 = +8 %); null when the real cost of the option is unknown. */
  gap: number | null;
  soldRef: string;
}

export interface Trace {
  inCatalogue: boolean;
  /** Quotation answers and sent offers that hold the option. */
  quoted: number;
  /** Sold configurations that hold it. */
  sold: number;
  deliveries: Delivery[];
  /** Marked "to avoid" by engineering (the latest mark). */
  avoidMarked: boolean;
  majorDifficulty: boolean;
}

export const EMPTY_TRACE: Trace = { inCatalogue: false, quoted: 0, sold: 0, deliveries: [], avoidMarked: false, majorDifficulty: false };

export const meanGap = (d: readonly Delivery[]): number | null => {
  const g = d.map((x) => x.gap).filter((x): x is number => x != null);
  return g.length ? Math.round((g.reduce((a, b) => a + b, 0) / g.length) * 1000) / 1000 : null;
};

/** The level of a trace (docs/spec/04 § 2, thresholds D-12). */
export function levelOf(t: Trace, s: Settings): KnowhowLevel {
  if (t.avoidMarked || t.majorDifficulty || t.deliveries.some((d) => d.gap != null && d.gap > s.avoidGapPct / 100)) return 'avoid';
  const mean = meanGap(t.deliveries);
  if (t.inCatalogue && t.deliveries.length >= s.masteredDeliveries && mean != null && Math.abs(mean) <= s.masteredGapPct / 100) return 'mastered';
  if (t.deliveries.length) return 'done';
  if (t.sold) return 'sold';
  if (t.quoted) return 'quoted';
  return 'never';
}

/** Merges the traces of an option over several machines (the option's level, whatever the machine). */
export function mergeTraces(ts: readonly Trace[]): Trace {
  return ts.reduce<Trace>((a, t) => ({
    inCatalogue: a.inCatalogue || t.inCatalogue, quoted: a.quoted + t.quoted, sold: a.sold + t.sold, deliveries: [...a.deliveries, ...t.deliveries],
    avoidMarked: a.avoidMarked || t.avoidMarked, majorDifficulty: a.majorDifficulty || t.majorDifficulty,
  }), { ...EMPTY_TRACE });
}

/** A specific option sold N times with a controlled gap: proposed to engineering for the catalogue (D-12: N = 2). */
export function proposeForCatalogue(t: Trace, s: Settings): boolean {
  const mean = meanGap(t.deliveries);
  return !t.inCatalogue && t.sold >= s.proposeAfterSales && mean != null && Math.abs(mean) <= s.masteredGapPct / 100;
}

/** A catalogue option never sold over the last `unsoldMonths` months (its last sale before the limit, or none). */
export function unsoldSince(lastSoldOn: string | null, createdOn: string, today: string, s: Settings): boolean {
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCMonth(limit.getUTCMonth() - s.unsoldMonths);
  const iso = limit.toISOString().slice(0, 10);
  return createdOn <= iso && (!lastSoldOn || lastSoldOn < iso);
}
