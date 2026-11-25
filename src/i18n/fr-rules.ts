// Parameterised French renderings of the English sentences Modulus builds with values (a count, a code, a currency). The first
// rule that matches applies. Keep each rule anchored (^…$) and its captures to values.
export const FR_RULES: [RegExp, string][] = [
  [/^(\d+) entries$/, '$1 entrée(s)'],
  [/^Rule broken: (\S+) excludes (\S+) — (.*)$/, 'Règle enfreinte : $1 exclut $2 — $3'],
  [/^Rule broken: (\S+) is in the same group as (\S+) — (.*)$/, 'Règle enfreinte : $1 est dans le même groupe que $2 — $3'],
  [/^A number is expected: (.*)$/, 'Un nombre est attendu : $1'],
  [/^Rate of the day \(([A-Z]{3}) for 1 EUR\)$/, 'Cours du jour ($1 pour 1 EUR)'],
  [/^Budget · (\S+)$/, 'Budget · $1'],
];
