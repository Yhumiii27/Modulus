// Working days (Monday to Friday) on ISO dates, for the target answer time of a quotation request (D-11). Pure. Public holidays
// are not counted yet (their calendar per country is not given).
import { addDaysIso, dowOfIso } from '@/lib/dates';

const isWorking = (iso: string) => {
  const d = dowOfIso(iso);
  return d !== 0 && d !== 6;
};

/** The date `n` working days after `iso` (n ≥ 0; 0 gives the next working day when `iso` falls on a weekend). */
export function addWorkingDays(iso: string, n: number): string {
  let d = iso;
  while (!isWorking(d)) d = addDaysIso(d, 1);
  for (let i = 0; i < n; i++) {
    d = addDaysIso(d, 1);
    while (!isWorking(d)) d = addDaysIso(d, 1);
  }
  return d;
}

/** Working days from `a` (excluded) to `b` (included); negative when `b` is before `a`. */
export function workingDaysBetween(a: string, b: string): number {
  if (a === b) return 0;
  const sign = a < b ? 1 : -1;
  let [from, to] = sign > 0 ? [a, b] : [b, a];
  let n = 0;
  while (from < to) {
    from = addDaysIso(from, 1);
    if (isWorking(from)) n++;
  }
  to = from;
  return sign * n;
}
