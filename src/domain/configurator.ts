// The configurator (docs/spec/01 § 2): the rules between options applied to a choice — `mandatory if` (a condition on a
// characteristic of the machine) and `requires` add options, `excludes` and `one of` forbid pairs. Pure. A configuration that
// still breaks a rule is refused, with the rule cited (`violations`).
import type { ConditionOp, RuleKind } from './vocab';

export interface CfgOption {
  id: string;
  code: string;
  label: string;
}

export interface CfgRule {
  id: string;
  optionId: string;
  kind: RuleKind;
  targetOptionId: string | null;
  conditionKey: string | null;
  conditionOp: ConditionOp | null;
  conditionValue: number | null;
  explanation: string;
}

/** Numeric characteristics of the machine version (`capacity` = the nominal capacity). */
export type Characteristics = Record<string, number | null | undefined>;

export interface OptionState {
  /** Added by a rule: cannot be removed. */
  locked?: boolean;
  /** Forbidden by a chosen option. */
  disabled?: boolean;
  /** Rule kind and the option (code) that causes it, for the message. */
  because?: { kind: RuleKind; by: string | null; explanation: string };
}

export interface Violation {
  ruleId: string;
  kind: RuleKind;
  /** "OPT-ENV-01 excludes OPT-ENV-02: …" (codes and typed explanation; the kind is translated by the caller). */
  option: string;
  target: string | null;
  explanation: string;
}

const conditionHolds = (r: CfgRule, c: Characteristics): boolean => {
  const v = r.conditionKey ? c[r.conditionKey] : null;
  if (v == null || r.conditionValue == null) return false;
  return r.conditionOp === '>=' ? v >= r.conditionValue : r.conditionOp === '<=' ? v <= r.conditionValue : v === r.conditionValue;
};

/**
 * Applies the rules to a choice of options available on the machine: adds the mandatory and required options (to a fixed
 * point), then marks the options a chosen one excludes. Options not available are dropped.
 */
export function evaluate(available: readonly CfgOption[], rules: readonly CfgRule[], chosen: Iterable<string>, chars: Characteristics) {
  const avail = new Map(available.map((o) => [o.id, o]));
  const code = (id: string | null) => (id ? avail.get(id)?.code ?? null : null);
  const relevant = rules.filter((r) => avail.has(r.optionId) && (r.targetOptionId == null || avail.has(r.targetOptionId)));
  const selected = new Set([...chosen].filter((id) => avail.has(id)));
  const state: Record<string, OptionState> = {};
  for (const r of relevant.filter((x) => x.kind === 'mandatory_if' && conditionHolds(x, chars))) {
    selected.add(r.optionId);
    state[r.optionId] = { locked: true, because: { kind: r.kind, by: null, explanation: r.explanation } };
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const r of relevant.filter((x) => x.kind === 'requires')) {
      if (selected.has(r.optionId) && !selected.has(r.targetOptionId!)) {
        selected.add(r.targetOptionId!);
        state[r.targetOptionId!] = { locked: true, because: { kind: r.kind, by: code(r.optionId), explanation: r.explanation } };
        changed = true;
      } else if (selected.has(r.optionId) && !state[r.targetOptionId!]?.locked) {
        state[r.targetOptionId!] = { locked: true, because: { kind: r.kind, by: code(r.optionId), explanation: r.explanation } };
      }
    }
  }
  const violations: Violation[] = [];
  for (const r of relevant.filter((x) => x.kind === 'excludes' || x.kind === 'one_of')) {
    const a = r.optionId;
    const b = r.targetOptionId!;
    if (selected.has(a) && selected.has(b)) violations.push({ ruleId: r.id, kind: r.kind, option: code(a)!, target: code(b), explanation: r.explanation });
    else if (selected.has(a) && !state[b]?.locked) state[b] = { disabled: r.kind === 'excludes', because: { kind: r.kind, by: code(a), explanation: r.explanation } };
    else if (selected.has(b) && !state[a]?.locked) state[a] = { disabled: r.kind === 'excludes', because: { kind: r.kind, by: code(b), explanation: r.explanation } };
  }
  return { selected: available.filter((o) => selected.has(o.id)).map((o) => o.id), state, violations };
}
