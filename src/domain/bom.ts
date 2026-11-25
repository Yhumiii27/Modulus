// The BOM of a configuration (docs/spec/01 § 3): the base BOM of the machine version plus the deltas of the options chosen
// (add, remove, replace) — computed, never copied; frozen only into a sent offer or a sold configuration. Pure.
import type { DeltaOp } from './vocab';

export interface BomLine {
  article: string;
  designation: string;
  quantity: number;
  unit: string;
  subassembly?: string;
  mark?: string;
}

export interface BomDelta {
  option: string;
  op: DeltaOp;
  article: string;
  designation: string;
  quantity: number | null;
  unit: string | null;
  replaces: string | null;
}

export interface ComputedBomLine extends BomLine {
  /** null = base BOM; else the option code that added or replaced the line. */
  origin: string | null;
}

/** Base + deltas, quantities × `quantity` machines; `errors` names a delta whose target line is not in the BOM. */
export function computeBom(base: readonly BomLine[], deltas: readonly BomDelta[], quantity = 1): { lines: ComputedBomLine[]; errors: string[] } {
  const lines: ComputedBomLine[] = base.map((l) => ({ ...l, origin: null }));
  const errors: string[] = [];
  for (const d of deltas) {
    if (d.op === 'add') {
      const same = lines.find((l) => l.article === d.article);
      if (same) same.quantity += d.quantity ?? 0;
      else lines.push({ article: d.article, designation: d.designation, quantity: d.quantity ?? 0, unit: d.unit ?? 'u', origin: d.option });
      continue;
    }
    const target = d.op === 'remove' ? d.article : d.replaces!;
    const i = lines.findIndex((l) => l.article === target);
    if (i < 0) {
      errors.push(`${d.option}: ${target}`);
      continue;
    }
    if (d.op === 'remove') lines.splice(i, 1);
    else lines[i] = { article: d.article, designation: d.designation, quantity: d.quantity ?? 0, unit: d.unit ?? lines[i].unit, subassembly: lines[i].subassembly, mark: lines[i].mark, origin: d.option };
  }
  return { lines: lines.map((l) => ({ ...l, quantity: Math.round(l.quantity * quantity * 1000) / 1000 })), errors };
}
