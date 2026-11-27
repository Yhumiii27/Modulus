// Demonstration data set of the beta — entirely fictitious (the validated mockup, maquette/index.html): machine types EMP,
// MEMU, SPUR, six standard machines, eleven catalogue options with their rules and BOM deltas, budgets and dated price lists,
// "Filiale Exemple …", "Mine Exemple …", "Carrières Démo" customers, deals of the three sale cases (D-3), offers sent through the
// same rules as the application (src/server/commerce/core.ts), sold configurations and an amendment, quotation requests at every
// stage, project returns and a "to avoid" mark, so every level of the know-how map has something to show. Dated around
// DEMO_TODAY_ISO (Tue 24 Nov 2026). Typed text is in French (shown as typed). People of demo.example only.
import { eq } from 'drizzle-orm';
import { BUDGET_POSTS, type AnswerType, type BudgetPost, type QuestionTheme } from '@/domain/vocab';
import { amend, recordOrder, sendOffer, type Actor } from '@/server/commerce/core';
import { loadModulus } from '@/server/commerce/world';
import {
  articlePrices, bomLines, characteristicDefs, costBudgets, counters, customers, dealLineOptions, dealLines, dealMembers, deals, feedbackOptions, knowhowNotes,
  machineTypes, machineVersions, machines, offerReviews, offers, optionBomDeltas, optionMachines, optionRules, options, priceListItems, priceLists, projectFeedback,
  questionnaires, questions, quoteAnswers, quoteBomDeltas, quoteEstimates, quoteMessages, quoteRequests, soldConfigurations, users, versionCharacteristics,
} from '../schema';
import type { Tx } from '../types';
import { DEMO_COLLEAGUES, DEMO_PERSONAS } from './personas';
import { seedQuestionnaire, type QuestionSeed } from './reference';

type Id = string;
const at = (iso: string, hh = 9) => new Date(`${iso}T${String(hh).padStart(2, '0')}:00:00Z`);

// ── Catalogue ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const TYPES = [
  { code: 'EMP', label: 'Unité fixe de fabrication', d: 30, l: 60, a: 10 },
  { code: 'MEMU', label: 'Unité mobile de fabrication', d: 30, l: 60, a: 10 },
  { code: 'SPUR', label: 'Unité de stockage et de pompage', d: 40, l: 50, a: 10 },
] as const;

const CHAR_DEFS = [
  { key: 'footprint', label: 'Encombrement', unit: 'm' },
  { key: 'installed_power', label: 'Puissance installée', unit: 'kW' },
  { key: 'compressed_air', label: 'Air comprimé', unit: null },
  { key: 'water', label: 'Eau', unit: null },
] as const;

interface MachineSeed {
  code: string; type: string; label: string; cap: number; unit: string; lead: number; sale: number; budget: number; power: number; dims: string; air: string; water: string;
  /** Versions, oldest first: [published on, retired on | null, note]; the last may be a draft (published on null). */
  versions: [string | null, string | null, string][];
}

const MACHINES: readonly MachineSeed[] = [
  { code: 'EMP-200', type: 'EMP', label: 'Unité fixe 20 t/h', cap: 20, unit: 't/h', lead: 26, sale: 900, budget: 640, power: 250, dims: '12,0 × 3,0 × 4,2 m', air: '6 bar · 120 Nm³/h', water: '2 m³/h',
    versions: [['2024-02-02', '2025-06-09', 'Première version'], ['2025-06-09', '2026-03-15', 'Reprise du catalogue de Keystone (import journalisé)'], ['2026-03-15', null, 'Armoire de puissance revue, débitmètres DN50'], [null, null, 'Pompe 18,5 kW à la place de 15 kW (ordre de modification ECO-2026-031 de Vigie)']] },
  { code: 'EMP-400', type: 'EMP', label: 'Unité fixe 40 t/h', cap: 40, unit: 't/h', lead: 30, sale: 1350, budget: 960, power: 420, dims: '16,0 × 3,4 × 4,6 m', air: '6 bar · 200 Nm³/h', water: '3,5 m³/h',
    versions: [['2024-05-10', '2026-02-02', 'Première version'], ['2026-02-02', null, 'Mélangeur DN100, trémie 10 m³']] },
  { code: 'MEMU-50', type: 'MEMU', label: 'Unité mobile, charge utile 5 t', cap: 5, unit: 't', lead: 20, sale: 450, budget: 320, power: 45, dims: '8,5 × 2,5 × 3,4 m', air: 'autonome', water: '—',
    versions: [['2024-09-01', '2026-01-10', 'Première version'], ['2026-01-10', null, 'Châssis porteur 19 t']] },
  { code: 'MEMU-80', type: 'MEMU', label: 'Unité mobile, charge utile 8 t', cap: 8, unit: 't', lead: 22, sale: 600, budget: 430, power: 60, dims: '9,8 × 2,5 × 3,6 m', air: 'autonome', water: '—',
    versions: [['2025-05-04', null, 'Première version']] },
  { code: 'SPUR-30', type: 'SPUR', label: 'Stockage et pompage 30 m³', cap: 30, unit: 'm³', lead: 14, sale: 250, budget: 175, power: 22, dims: '7,0 × 2,6 × 3,2 m', air: '6 bar · 30 Nm³/h', water: '—',
    versions: [['2024-09-20', null, 'Première version']] },
  { code: 'MEMU-120', type: 'MEMU', label: 'Unité mobile, charge utile 12 t', cap: 12, unit: 't', lead: 26, sale: 780, budget: 560, power: 75, dims: '11,2 × 2,5 × 3,8 m', air: 'autonome', water: '—',
    versions: [[null, null, 'Nouvelle machine en préparation']] },
];

/** Base BOM of the type; each machine has its own articles (prefix digit), priced in proportion to its budget. */
const BOM = [
  { sub: 'Châssis', mark: '01', art: '00210', des: 'Châssis mécano-soudé', q: 1, u: 'u', price: 60 },
  { sub: 'Trémie', mark: '02', art: '00344', des: 'Trémie inox 8 m³', q: 1, u: 'u', price: 38 },
  { sub: 'Cuves', mark: '03', art: '00780', des: 'Cuve produit 10 m³', q: 2, u: 'u', price: 22 },
  { sub: 'Pompage', mark: '04', art: '01118', des: 'Pompe volumétrique 15 kW', q: 2, u: 'u', price: 18 },
  { sub: 'Mélange', mark: '05', art: '01402', des: 'Mélangeur statique DN80', q: 1, u: 'u', price: 12 },
  { sub: 'Automatisme', mark: '06', art: '02015', des: 'Automate et armoire de commande', q: 1, u: 'u', price: 70 },
  { sub: 'Électricité', mark: '07', art: '02220', des: 'Armoire de puissance', q: 1, u: 'u', price: 65 },
  { sub: 'Mesure', mark: '08', art: '02507', des: 'Débitmètre massique DN50', q: 3, u: 'u', price: 9 },
  { sub: 'Tuyauterie', mark: '09', art: '03100', des: 'Lot de tuyauterie inox', q: 1, u: 'lot', price: 25 },
  { sub: 'Sécurité', mark: '10', art: '04030', des: 'Arrêts d’urgence et barrières', q: 1, u: 'lot', price: 15 },
] as const;
/** The hopper and the guard rails are common parts of every machine (an option replaces them by article). */
const COMMON_PARTS = ['00344', '04030'];
const article = (machineIndex: number, base: string) => `ART-${COMMON_PARTS.includes(base) ? 1 : machineIndex + 1}${base}`;

/** Budget per post of EMP-200 (k€; hours × the default rates), scaled for the other machines. */
const BUDGET_EMP200: Record<BudgetPost, { k: number; h?: number; basis: string }> = {
  material: { k: 380, basis: 'BOM × derniers prix d’achat (Keystone)' },
  subcontracting: { k: 70, basis: 'galvanisation, transport' },
  engineering_hours: { k: 51, h: 600, basis: '600 h' },
  workshop_hours: { k: 90, h: 1600, basis: '1 500 h saisies, 1 600 h au standard' },
  site_hours: { k: 30, h: 400, basis: '400 h' },
  expenses: { k: 19, basis: 'déplacements, essais' },
};

interface OptionSeed {
  code: string; label: string; cat: string; sale: number; budget: number; weeks: number; on: string[];
  deltas: { op: 'add' | 'remove' | 'replace'; art: string; des: string; q?: number; u?: string; old?: string }[];
}

const OPTIONS: readonly OptionSeed[] = [
  { code: 'OPT-CAP-01', label: 'Trémie élargie 12 m³', cat: 'capacity', sale: 60, budget: 41, weeks: 3, on: ['EMP-200', 'EMP-400'],
    deltas: [{ op: 'replace', art: 'ART-700346', des: 'Trémie inox 12 m³', q: 1, u: 'u', old: '00344' }, { op: 'add', art: 'ART-700520', des: 'Renfort de châssis', q: 1, u: 'lot' }] },
  { code: 'OPT-AUT-01', label: 'Supervision à distance', cat: 'automation', sale: 45, budget: 29, weeks: 2, on: ['EMP-200', 'EMP-400', 'MEMU-50', 'MEMU-80'],
    deltas: [{ op: 'add', art: 'ART-700640', des: 'Passerelle de télésurveillance', q: 1, u: 'u' }, { op: 'add', art: 'ART-700641', des: 'Licence de supervision (5 ans)', q: 1, u: 'u' }] },
  { code: 'OPT-AUT-02', label: 'Interface Profinet vers l’automate client', cat: 'automation', sale: 18, budget: 11, weeks: 1, on: ['EMP-200', 'EMP-400'],
    deltas: [{ op: 'add', art: 'ART-700710', des: 'Coupleur Profinet', q: 1, u: 'u' }] },
  { code: 'OPT-AUT-03', label: 'Interface Modbus TCP', cat: 'automation', sale: 15, budget: 10, weeks: 1, on: ['EMP-200', 'EMP-400'],
    deltas: [{ op: 'add', art: 'ART-700712', des: 'Passerelle Modbus TCP', q: 1, u: 'u' }] },
  { code: 'OPT-SEC-01', label: 'Détection incendie renforcée', cat: 'safety', sale: 35, budget: 24, weeks: 2, on: ['EMP-200', 'EMP-400', 'SPUR-30'],
    deltas: [{ op: 'add', art: 'ART-800110', des: 'Détecteur de flamme', q: 4, u: 'u' }, { op: 'add', art: 'ART-800120', des: 'Centrale incendie', q: 1, u: 'u' }] },
  { code: 'OPT-SEC-02', label: 'Garde-corps et passerelles renforcés', cat: 'safety', sale: 22, budget: 15, weeks: 1, on: ['EMP-200', 'EMP-400'],
    deltas: [{ op: 'replace', art: 'ART-800032', des: 'Garde-corps et passerelles renforcés', q: 1, u: 'lot', old: '04030' }] },
  { code: 'OPT-ENV-01', label: 'Kit grand froid (−30 °C)', cat: 'environment', sale: 70, budget: 52, weeks: 4, on: ['EMP-200', 'EMP-400', 'MEMU-50', 'MEMU-80'],
    deltas: [{ op: 'add', art: 'ART-800210', des: 'Traçage électrique', q: 1, u: 'lot' }, { op: 'add', art: 'ART-800220', des: 'Isolation de cuve', q: 2, u: 'u' }] },
  { code: 'OPT-ENV-02', label: 'Kit climat tropical', cat: 'environment', sale: 55, budget: 38, weeks: 3, on: ['EMP-200', 'EMP-400', 'MEMU-50', 'MEMU-80'],
    deltas: [{ op: 'add', art: 'ART-800250', des: 'Groupe froid 15 kW', q: 1, u: 'u' }] },
  { code: 'OPT-CNF-01', label: 'Cabine de commande climatisée', cat: 'comfort', sale: 28, budget: 19, weeks: 2, on: ['EMP-200', 'EMP-400', 'MEMU-80'],
    deltas: [{ op: 'add', art: 'ART-800315', des: 'Cabine climatisée', q: 1, u: 'u' }] },
  { code: 'OPT-SRV-01', label: 'Pack pièces de rechange 2 ans', cat: 'service', sale: 40, budget: 30, weeks: 0, on: ['EMP-200', 'EMP-400', 'MEMU-50', 'MEMU-80', 'SPUR-30'],
    deltas: [{ op: 'add', art: 'ART-900001', des: 'Lot de pièces de rechange 2 ans', q: 1, u: 'lot' }] },
  { code: 'OPT-SRV-02', label: 'Formation opérateurs étendue (5 j)', cat: 'service', sale: 12, budget: 8, weeks: 0, on: ['EMP-200', 'EMP-400', 'MEMU-50', 'MEMU-80', 'SPUR-30'], deltas: [] },
];

const YEAR_FACTOR: Record<string, number> = { 'GRILLE-2024': 0.94, 'GRILLE-2025': 0.97, 'GRILLE-2026': 1, 'GRILLE-2027': 1.03 };

// ── Questionnaires per family (D-10) ───────────────────────────────────────────────────────────────────────────────────

const q = (theme: QuestionTheme, text: string, type: AnswerType, o: Partial<QuestionSeed> = {}): QuestionSeed => ({ theme, text, type, ...o });
const FAMILIES: { family: string; label: string; questions: QuestionSeed[]; draft?: QuestionSeed[] }[] = [
  { family: 'EMP:automation', label: 'EMP × automatisme', questions: [
    q('interfaces', 'Marque et modèle de l’automate du site', 'text', { required: true }),
    q('interfaces', 'Protocole de l’automate client', 'choice', { choices: 'Profinet · Modbus TCP · EtherNet/IP · autre', required: true }),
    q('interfaces', 'Données à échanger (liste)', 'text'),
    q('performance', 'Dosage : plage et précision', 'text', { unit: 'kg/t · %', required: true }),
    q('environment', 'Armoire en local climatisé ?', 'yes_no'),
    q('standards', 'Arrêt d’urgence câblé vers le client ?', 'yes_no', { required: true }),
  ] },
  { family: 'EMP:environment', label: 'EMP × environnement', questions: [
    q('environment', 'Altitude du site', 'number', { unit: 'm', required: true }), q('environment', 'Niveau sonore exigé en limite de propriété', 'number', { unit: 'dB(A)' }),
    q('environment', 'Exposition aux poussières', 'choice', { choices: 'faible · moyenne · forte' }), q('environment', 'Vent et neige à prendre en compte', 'text'),
    q('standards', 'Exigences du permis d’exploiter', 'text'),
  ] },
  { family: 'EMP:capacity', label: 'EMP × capacité', questions: [
    q('performance', 'Cadence de pointe', 'number', { unit: 't/h', required: true }), q('product', 'Densité du produit', 'number', { unit: 't/m³' }),
    q('performance', 'Autonomie de stockage souhaitée', 'number', { unit: 'h' }), q('interfaces', 'Mode de remplissage', 'choice', { choices: 'camion · convoyeur · big-bag' }),
  ] },
  { family: 'MEMU:capacity', label: 'MEMU × capacité', questions: [
    q('performance', 'Charge utile visée', 'number', { unit: 't', required: true }), q('environment', 'État des pistes', 'choice', { choices: 'bonnes · moyennes · difficiles' }),
    q('performance', 'Nombre de trous par tournée', 'number'), q('interfaces', 'Châssis imposé par le client', 'text'),
  ] },
  { family: 'MEMU:environment', label: 'MEMU × environnement', questions: [
    q('environment', 'Températures de fonctionnement', 'text', { unit: '°C', required: true }), q('environment', 'Altitude des fosses', 'number', { unit: 'm' }),
    q('environment', 'Poussières et boue', 'choice', { choices: 'faible · moyenne · forte' }), q('standards', 'Exigences de la mine pour les véhicules', 'text'),
  ], draft: [
    q('environment', 'Températures de fonctionnement', 'text', { unit: '°C', required: true }), q('environment', 'Altitude des fosses', 'number', { unit: 'm' }),
    q('environment', 'Poussières et boue', 'choice', { choices: 'faible · moyenne · forte' }), q('standards', 'Exigences de la mine pour les véhicules', 'text'),
    q('environment', 'Pente maximale des pistes', 'number', { unit: '%' }),
  ] },
  { family: 'SPUR:environment', label: 'SPUR × environnement', questions: [
    q('environment', 'Niveau sonore exigé', 'number', { unit: 'dB(A)', required: true }), q('environment', 'Rétention exigée', 'yes_no'), q('standards', 'Distance aux habitations', 'number', { unit: 'm' }),
  ] },
];

/** Answers of DC-2026-0017 (common core + EMP × automation). */
const DC17: Record<string, string> = {
  'Que doit faire l’option ?': 'Doser un additif de fluidité au démarrage, quand la température de la matrice est sous 5 °C, pendant les 20 premières minutes.',
  'Quel problème résout-elle ?': 'Les démarrages d’hiver sont lents (45 min de préchauffage) et la première tonne est souvent rebutée.',
  'Que se passe-t-il aujourd’hui sans elle ?': 'Préchauffage manuel au poste de commande, ajout d’additif au seau.',
  'Produit traité et état': 'émulsion',
  'Cadence visée': '20',
  'Précision attendue': '2',
  'Critères d’acceptation': 'Première tonne conforme dès 10 min après démarrage à 0 °C ; dosage tracé dans la supervision.',
  'Intérieur ou extérieur': 'abri',
  'Températures mini / maxi': '−15 °C / +35 °C',
  'Zone ATEX': 'non',
  'Utilités disponibles': 'Air 6 bar, 400 V triphasé',
  'Normes du client à respecter': 'Règles HSE de la filiale (référence Codex CDX-HSE-2025-0102)',
  'Machines amont / aval': 'Cuves de nitrate (amont), chargement camion (aval)',
  'Automatisme et protocole': 'Profinet',
  'Date souhaitée': 'avec la machine (juin 2027)',
  'Budget envisagé': '40',
  'Bloquant pour le CAPEX ?': 'non',
  'Plans, photos, cahier des charges (Codex)': 'CDX-PLN-2026-0412 · plan d’implantation ; CDX-PHO-2026-0088 · photos du poste actuel',
  'Marque et modèle de l’automate du site': 'Automate de la gamme du fournisseur habituel (série 1500)',
  'Protocole de l’automate client': 'Profinet',
  'Données à échanger (liste)': 'Température matrice, débit additif, alarmes',
  'Dosage : plage et précision': '0,5 à 3 kg/t · ± 2 %',
  'Armoire en local climatisé ?': 'oui',
  'Arrêt d’urgence câblé vers le client ?': 'oui',
};

export async function seedDemo(tx: Tx): Promise<void> {
  // People
  const userId: Record<string, Id> = {};
  for (const p of [...DEMO_PERSONAS, ...DEMO_COLLEAGUES]) {
    const [u] = await tx.insert(users).values({ email: p.email, name: p.name }).returning({ id: users.id });
    userId[p.name] = u.id;
  }
  const actor = (name: string, role: string | null = null): Actor => ({ userId: userId[name], name, role });

  // Types and characteristics
  for (const t of TYPES) {
    await tx.insert(machineTypes).values({ code: t.code, label: t.label, depositPct: t.d, deliveryPct: t.l, acceptancePct: t.a });
    let n = 0;
    for (const c of CHAR_DEFS) await tx.insert(characteristicDefs).values({ typeCode: t.code, key: c.key, label: c.label, unit: c.unit, position: ++n });
  }

  // Article prices (simulation of Keystone's view K-1)
  const priced = new Map<string, number>();
  MACHINES.forEach((m, i) => BOM.forEach((b) => { if (!priced.has(article(i, b.art))) priced.set(article(i, b.art), Math.round(b.price * (COMMON_PARTS.includes(b.art) ? 1 : m.budget / 640) * 10) / 10); }));
  const deltaPrices: Record<string, number> = {
    'ART-700346': 35, 'ART-700520': 4, 'ART-700640': 11, 'ART-700641': 6, 'ART-700710': 5, 'ART-700712': 5, 'ART-800110': 2.5, 'ART-800120': 6, 'ART-800032': 22,
    'ART-800210': 15, 'ART-800220': 7, 'ART-800250': 21, 'ART-800315': 12, 'ART-900001': 22, 'ART-910330': 6, 'ART-910902': 4.5, 'ART-910508': 1.5, 'ART-920010': 9, 'ART-920020': 6,
  };
  for (const [a, p] of Object.entries(deltaPrices)) priced.set(a, p);
  for (const [a, p] of priced) await tx.insert(articlePrices).values({ article: a, unitPriceKeur: p, on: '2026-11-02', source: 'simulation' });

  // Machines, versions, BOM, characteristics, budgets
  const machineId: Record<string, Id> = {};
  const versionId: Record<string, Id> = {};
  for (const [i, m] of MACHINES.entries()) {
    const [row] = await tx.insert(machines).values({ code: m.code, typeCode: m.type }).returning({ id: machines.id });
    machineId[m.code] = row.id;
    const fk = m.budget / 640;
    for (const [n, [pub, , note]] of m.versions.entries()) {
      const [v] = await tx.insert(machineVersions).values({
        machineId: row.id, version: n + 1, label: m.label, nominalCapacity: m.cap, capacityUnit: m.unit, leadWeeks: m.lead, note, createdByName: 'Marc Lenoir',
        description: `${m.label}, version ${n + 1}.`, datasheetRef: pub ? `CDX-FT-${m.code}-V${n + 1}` : null, createdAt: at(pub ?? '2026-11-18'),
      }).returning({ id: machineVersions.id });
      versionId[`${m.code} v${n + 1}`] = v.id;
      for (const b of BOM) {
        const des = b.art === '01118' && m.code === 'EMP-200' && n === 3 ? 'Pompe volumétrique 18,5 kW' : b.des;
        await tx.insert(bomLines).values({ versionId: v.id, subassembly: b.sub, mark: b.mark, article: article(i, b.art), designation: des, quantity: b.q, unit: b.u });
      }
      for (const [key, value] of [['footprint', m.dims], ['installed_power', String(m.power)], ['compressed_air', m.air], ['water', m.water]] as const)
        await tx.insert(versionCharacteristics).values({ versionId: v.id, key, value });
      for (const post of BUDGET_POSTS) {
        const b = BUDGET_EMP200[post];
        await tx.insert(costBudgets).values({ machineVersionId: v.id, post, enteredKeur: Math.round(b.k * fk), hours: b.h != null ? Math.round(b.h * fk) : null, basis: b.basis, updatedByName: 'Camille Arnaud' });
      }
    }
    // Publish and retire in the order of history (a published version is frozen from here on).
    for (const [n, [pub, ret]] of m.versions.entries()) {
      if (!pub) continue;
      await tx.update(machineVersions).set({ state: 'published', publishedAt: at(pub) }).where(eq(machineVersions.id, versionId[`${m.code} v${n + 1}`]));
      if (ret) await tx.update(machineVersions).set({ state: 'retired', retiredAt: at(ret) }).where(eq(machineVersions.id, versionId[`${m.code} v${n + 1}`]));
    }
  }

  // Options, rules, deltas, budgets
  const optionId: Record<string, Id> = {};
  for (const o of OPTIONS) {
    const [row] = await tx.insert(options).values({ code: o.code, label: o.label, category: o.cat, extraWeeks: o.weeks, createdAt: at('2024-02-02') }).returning({ id: options.id });
    optionId[o.code] = row.id;
    for (const m of o.on) await tx.insert(optionMachines).values({ optionId: row.id, machineId: machineId[m] });
    for (const d of o.deltas)
      await tx.insert(optionBomDeltas).values({ optionId: row.id, op: d.op, article: d.art, designation: d.des, quantity: d.op === 'remove' ? null : d.q ?? 1, unit: d.op === 'remove' ? null : d.u ?? 'u', replaces: d.old ? article(0, d.old) : null });
    const material = Math.round(o.budget * 0.6);
    const workshop = Math.round(o.budget * 0.25);
    const eng = o.budget - material - workshop;
    await tx.insert(costBudgets).values([
      { optionId: row.id, post: 'material', enteredKeur: material, basis: 'deltas de BOM × prix d’achat', updatedByName: 'Camille Arnaud' },
      { optionId: row.id, post: 'workshop_hours', enteredKeur: workshop, hours: Math.round((workshop * 1000) / 60), basis: 'montage atelier', updatedByName: 'Camille Arnaud' },
      { optionId: row.id, post: 'engineering_hours', enteredKeur: eng, hours: Math.round((eng * 1000) / 85), basis: 'études et programme', updatedByName: 'Camille Arnaud' },
    ]);
  }
  const rule = (a: string, kind: 'excludes' | 'requires' | 'one_of' | 'mandatory_if', b: string | null, explanation: string, cond?: [string, '>=' | '<=' | '=', number]) =>
    tx.insert(optionRules).values({ optionId: optionId[a], kind, targetOptionId: b ? optionId[b] : null, conditionKey: cond?.[0] ?? null, conditionOp: cond?.[1] ?? null, conditionValue: cond?.[2] ?? null, explanation, createdByName: 'Marc Lenoir' });
  await rule('OPT-ENV-01', 'excludes', 'OPT-ENV-02', 'Les deux kits climatiques sont incompatibles');
  await rule('OPT-CAP-01', 'requires', 'OPT-SEC-02', 'La trémie élargie demande des passerelles renforcées pour l’accès au remplissage');
  await rule('OPT-AUT-02', 'one_of', 'OPT-AUT-03', 'Groupe « Protocole automate » : une seule interface');
  await rule('OPT-SEC-01', 'mandatory_if', null, 'Exigence HSE du groupe au-delà de 40 t/h', ['capacity', '>=', 40]);

  // Price lists (D-4, D-14)
  const listId: Record<string, Id> = {};
  for (const [code, from, to] of [['GRILLE-2024', '2024-01-01', '2024-12-31'], ['GRILLE-2025', '2025-01-01', '2025-12-31'], ['GRILLE-2026', '2026-01-01', '2026-12-31'], ['GRILLE-2027', '2027-01-01', '2027-12-31']] as const) {
    const [l] = await tx.insert(priceLists).values({ code, validFrom: from, validTo: to, proposedByName: 'Camille Arnaud', maxDiscountPct: 10, createdAt: at(code === 'GRILLE-2027' ? '2026-11-20' : `${+from.slice(0, 4) - 1}-11-20`) }).returning({ id: priceLists.id });
    listId[code] = l.id;
    const f = YEAR_FACTOR[code];
    for (const m of MACHINES) await tx.insert(priceListItems).values({ priceListId: l.id, machineId: machineId[m.code], saleKeur: Math.round(m.sale * f) });
    for (const o of OPTIONS) await tx.insert(priceListItems).values({ priceListId: l.id, optionId: optionId[o.code], saleKeur: Math.round(o.sale * f) });
    if (code === 'GRILLE-2027') await tx.update(priceLists).set({ state: 'to_validate' }).where(eq(priceLists.id, l.id));
    else await tx.update(priceLists).set({ state: 'published', validatedByName: 'Sophie Vidal', validatedAt: at(`${+from.slice(0, 4) - 1}-12-12`) }).where(eq(priceLists.id, l.id));
  }

  // Questionnaires (the common core comes from the reference seed)
  const [common] = await tx.select().from(questionnaires).where(eq(questionnaires.family, 'common'));
  const familyId: Record<string, Id> = {};
  for (const f of FAMILIES) {
    familyId[f.family] = await seedQuestionnaire(tx, { family: f.family, label: f.label, version: 1, questions: f.questions, publishedAt: at('2026-09-12') });
    if (f.draft) await seedQuestionnaire(tx, { family: f.family, label: f.label, version: 2, questions: f.draft, draft: true });
  }

  // Customers (D-16: read in Keystone; a prospect is created in Modulus)
  const customerId: Record<string, Id> = {};
  for (const [code, name, kind, country, source] of [
    ['FIL-NORD', 'Filiale Exemple Nord', 'subsidiary', 'CA', 'keystone'], ['FIL-SUD', 'Filiale Exemple Sud', 'subsidiary', 'ZA', 'keystone'],
    ['FIL-OUEST', 'Filiale Exemple Ouest', 'subsidiary', 'CI', 'keystone'], ['FIL-EST', 'Filiale Exemple Est', 'subsidiary', 'AU', 'keystone'],
    ['MINE-SAHEL', 'Mine Exemple Sahel', 'mining_site', 'ML', 'modulus'], ['MINE-EXEMPLE', 'Mine Exemple SA', 'mining_site', 'ZA', 'keystone'],
    ['CARR-DEMO', 'Carrières Démo SARL', 'external', 'FR', 'keystone'], ['MINE-ANDES', 'Mine Fictive Andes', 'external', 'PE', 'modulus'], ['EXPLO-DEMO', 'Explo Démo Ltd', 'external', 'GH', 'modulus'],
  ] as const) {
    const [c] = await tx.insert(customers).values({ code, name, kind, country, source }).returning({ id: customers.id });
    customerId[code] = c.id;
  }

  // Deals
  const dealId: Record<string, Id> = {};
  const deal = async (o: { ref: string; cas: 1 | 2 | 3; customer: string; inter?: string; capex?: string; site: string; origin: 'customer_request' | 'capex_need' | 'tender' | 'renewal'; owner: string;
    need: string; wished?: string; prob: number; created: string; team: [string, 'sales' | 'estimator' | 'engineering'][] }) => {
    const [d] = await tx.insert(deals).values({
      ref: o.ref, saleCase: o.cas, customerId: customerId[o.customer], intermediaryId: o.inter ? customerId[o.inter] : null, capexNeed: o.capex ?? null, deliverySite: o.site, origin: o.origin,
      ownerId: userId[o.owner], ownerName: o.owner, need: o.need, wishedFor: o.wished ?? null, probability: o.prob, createdAt: at(o.created),
    }).returning({ id: deals.id });
    dealId[o.ref] = d.id;
    for (const [name, role] of [[o.owner, 'sales'] as [string, 'sales'], ...o.team]) await tx.insert(dealMembers).values({ dealId: d.id, userId: userId[name], userName: name, role }).onConflictDoNothing();
    return d.id;
  };
  const line = async (deal: Id, n: number, version: string, qty: number, opts: string[]) => {
    const [l] = await tx.insert(dealLines).values({ dealId: deal, number: n, machineVersionId: versionId[version], quantity: qty }).returning({ id: dealLines.id });
    for (const o of opts) await tx.insert(dealLineOptions).values({ lineId: l.id, optionId: optionId[o] ?? o });
    return l.id;
  };
  const offer = async (deal: Id, letter: string, o: { discount?: number; assumptions?: string; reservations?: string; note?: string; created: string }) => {
    const [x] = await tx.insert(offers).values({ dealId: deal, letter, discountPct: o.discount ?? 0, validityDays: 90, assumptions: o.assumptions ?? null, reservations: o.reservations ?? null, note: o.note ?? null, createdAt: at(o.created) }).returning();
    return x;
  };
  const send = async (offerRow: typeof offers.$inferSelect, on: string, by: string, review?: string) => {
    if (review) await tx.insert(offerReviews).values({ offerId: offerRow.id, level: 'sales_director', decision: 'go', comment: null, checks: [], decidedById: userId['Sophie Vidal'], decidedByName: 'Sophie Vidal', decidedAt: at(review, 15) });
    const w = await loadModulus(tx, on);
    await sendOffer(tx, w, w.rows.offerRows.find((x) => x.id === offerRow.id)!, actor(by, 'sales'), { rate: null, on });
  };
  const order = async (offerId: Id, on: string, by: string, customerRef: string, project: string | null) => {
    const w = await loadModulus(tx, on);
    return recordOrder(tx, w, w.rows.offerRows.find((x) => x.id === offerId)!, actor(by, 'sales'), { orderedOn: on, customerOrderRef: customerRef, keystoneProject: project });
  };
  const quote = async (o: { ref: string; title: string; deal?: string; capex?: string; machine: string; cat: string; cls: 'indicative' | 'quote' | 'firm'; received: string; by: string;
    answers: Record<string, string>; family?: string }) => {
    const target = { indicative: 5, quote: 15, firm: 30 }[o.cls];
    const [r] = await tx.insert(quoteRequests).values({
      ref: o.ref, title: o.title, origin: o.capex ? 'arche' : 'deal', dealId: o.deal ? dealId[o.deal] : null, capexNeed: o.capex ?? null, machineId: machineId[o.machine], category: o.cat,
      estimateClass: o.cls, receivedOn: o.received, targetDays: target, followedById: userId[o.by], followedByName: o.by, commonQuestionnaireId: common.id,
      familyQuestionnaireId: o.family ? familyId[o.family] ?? null : null, createdAt: at(o.received),
    }).returning({ id: quoteRequests.id });
    const qs = await tx.select().from(questions);
    for (const [text, value] of Object.entries(o.answers)) {
      const question = qs.find((x) => x.text === text && (x.questionnaireId === common.id || x.questionnaireId === (o.family ? familyId[o.family] : '')));
      if (question && value) await tx.insert(quoteAnswers).values({ requestId: r.id, questionId: question.id, value, enteredByName: o.by });
    }
    return r.id;
  };
  const qualify = (id: Id, feasibility: 'feasible' | 'to_study' | 'refused', note: string, level: string, on: string, state: 'qualification' | 'estimating' | 'refused' = feasibility === 'refused' ? 'refused' : 'estimating') =>
    tx.update(quoteRequests).set({ feasibility, qualificationNote: note, proposedLevel: level, qualifiedByName: 'Marc Lenoir', qualifiedOn: on, state }).where(eq(quoteRequests.id, id));
  const estimate = (id: Id, e: { m: number; s: number; eh: number; wh: number; sh: number; x: number; sale: number; weeks: number; assumptions: string; deltas: [string, string, number, string][] }) =>
    tx.insert(quoteEstimates).values({ requestId: id, materialKeur: e.m, subcontractingKeur: e.s, engineeringHours: e.eh, workshopHours: e.wh, siteHours: e.sh, expensesKeur: e.x, saleKeur: e.sale, extraWeeks: e.weeks, validityDays: 90, assumptions: e.assumptions, estimatedByName: 'Camille Arnaud' })
      .then(() => (e.deltas.length ? tx.insert(quoteBomDeltas).values(e.deltas.map(([art, des, qty, unit]) => ({ requestId: id, op: 'add', article: art, designation: des, quantity: qty, unit }))) : undefined));
  /** Publishes the answer: the request answered and its specific option created (docs/spec/03 § 4). */
  const answer = async (id: Id, ref: string, label: string, cat: string, machine: string, on: string, weeks: number) => {
    await tx.update(quoteRequests).set({ state: 'answered', answeredOn: on, answeredByName: 'Camille Arnaud' }).where(eq(quoteRequests.id, id));
    const [o] = await tx.insert(options).values({ code: `SPE-${ref.slice(3)}`, label, category: cat, origin: 'specific', quoteRequestId: id, extraWeeks: weeks, createdAt: at(on) }).returning({ id: options.id });
    await tx.insert(optionMachines).values({ optionId: o.id, machineId: machineId[machine] });
    optionId[`SPE-${ref.slice(3)}`] = o.id;
    return o.id;
  };
  const feedback = async (soldRef: string, on: string, real: [number, number, number, number, number, number], hours: [number, number, number], opts: Record<string, number | 'not_delivered'>, rex: [string, string] | null, major = false) => {
    const [cur] = (await tx.select().from(soldConfigurations).where(eq(soldConfigurations.ref, soldRef))).sort((a, b) => b.version - a.version);
    const [f] = await tx.insert(projectFeedback).values({
      soldRef, stage: 'closure', receivedOn: on, materialKeur: real[0], subcontractingKeur: real[1], engineeringKeur: real[2], workshopKeur: real[3], siteKeur: real[4], expensesKeur: real[5],
      engineeringHours: hours[0], workshopHours: hours[1], siteHours: hours[2], rexRef: rex?.[0] ?? null, rexSummary: rex?.[1] ?? null, majorDifficulty: major, source: 'keystone', recordedByName: 'Keystone (simulation)',
      createdAt: at(on),
    }).returning({ id: projectFeedback.id });
    for (const l of cur.content.lines)
      for (const x of l.options) {
        const g = opts[x.code];
        if (g === undefined) continue;
        const budget = (x.budgetKeur ?? 0) * l.quantity;
        await tx.insert(feedbackOptions).values({ feedbackId: f.id, optionId: optionId[x.code], delivered: g !== 'not_delivered', budgetKeur: budget, actualKeur: g === 'not_delivered' ? null : Math.round(budget * (1 + g) * 10) / 10 });
      }
  };

  // History: 2024–2025 sales delivered (the know-how comes from them).
  const d1 = await deal({ ref: 'AF-2024-0008', cas: 1, customer: 'FIL-EST', site: 'Site Est-1', origin: 'customer_request', owner: 'Julien Faure', need: 'Une unité fixe pour la carrière Est-1.', prob: 60, created: '2024-03-04', team: [['Camille Arnaud', 'estimator']] });
  await line(d1, 1, 'EMP-200 v1', 1, ['OPT-AUT-01', 'OPT-SEC-01', 'OPT-SRV-01', 'OPT-SRV-02']);
  const o1 = await offer(d1, 'A', { created: '2024-04-02' });
  await send(o1, '2024-04-10', 'Julien Faure', '2024-04-09');
  await order(o1.id, '2024-05-15', 'Julien Faure', 'BC-FEE-2024-031', 'PRJ-DEMO-061');

  const d2 = await deal({ ref: 'AF-2024-0015', cas: 1, customer: 'FIL-OUEST', site: 'Site Ouest-1', origin: 'customer_request', owner: 'Julien Faure', need: 'Une unité fixe 40 t/h, démarrages d’hiver à améliorer.', prob: 60, created: '2024-10-01', team: [['Camille Arnaud', 'estimator'], ['Marc Lenoir', 'engineering']] });
  const r31 = await quote({ ref: 'DC-2025-0031', title: 'Préchauffage de l’émulsion au démarrage', deal: 'AF-2024-0015', machine: 'EMP-400', cat: 'automation', cls: 'quote', received: '2025-01-13', by: 'Camille Arnaud', answers: { 'Que doit faire l’option ?': 'Préchauffer la matrice avant le démarrage.', 'Quel problème résout-elle ?': 'Démarrages lents en hiver.' }, family: 'EMP:automation' });
  await qualify(r31, 'feasible', 'Faisable avec un réchauffeur en ligne.', 'never', '2025-01-15');
  await estimate(r31, { m: 18, s: 2, eh: 60, wh: 70, sh: 20, x: 1, sale: 40, weeks: 3, assumptions: 'Alimentation 400 V disponible.', deltas: [['ART-920010', 'Réchauffeur en ligne 30 kW', 1, 'u'], ['ART-920020', 'Calorifuge de tuyauterie', 1, 'lot']] });
  await answer(r31, 'DC-2025-0031', 'Préchauffage émulsion', 'automation', 'EMP-400', '2025-01-30', 3);
  await tx.insert(optionMachines).values({ optionId: optionId['SPE-2025-0031'], machineId: machineId['EMP-200'] });
  await line(d2, 1, 'EMP-400 v1', 1, ['OPT-AUT-01', 'OPT-SEC-01', 'OPT-SEC-02', 'OPT-CAP-01', 'SPE-2025-0031']);
  const o2 = await offer(d2, 'A', { created: '2025-02-03' });
  await send(o2, '2025-02-10', 'Julien Faure', '2025-02-07');
  await order(o2.id, '2025-03-03', 'Julien Faure', 'BC-FEO-2025-007', 'PRJ-DEMO-072');

  const d3 = await deal({ ref: 'AF-2025-0019', cas: 1, customer: 'FIL-NORD', capex: 'CPX-2025-009/B01', site: 'Site Nord-1', origin: 'capex_need', owner: 'Julien Faure', need: 'Unité fixe 20 t/h pour le site Nord-1, hivers rigoureux.', prob: 70, created: '2025-02-20', team: [['Camille Arnaud', 'estimator'], ['Marc Lenoir', 'engineering']] });
  await line(d3, 1, 'EMP-200 v2', 1, ['OPT-AUT-01', 'OPT-ENV-01', 'OPT-CNF-01', 'SPE-2025-0031']);
  const o3a = await offer(d3, 'A', { created: '2025-03-10' });
  await send(o3a, '2025-03-14', 'Julien Faure', '2025-03-13');
  const o3b = await offer(d3, 'B', { discount: 4, created: '2025-03-28', note: 'remise commerciale de 4 %' });
  await send(o3b, '2025-04-02', 'Julien Faure', '2025-04-01');
  await order(o3b.id, '2025-04-14', 'Julien Faure', 'BC-FEN-2025-118', 'PRJ-DEMO-087');

  const d5 = await deal({ ref: 'AF-2025-0022', cas: 1, customer: 'FIL-EST', capex: 'CPX-2025-012/B01', site: 'Site Est-3', origin: 'capex_need', owner: 'Julien Faure', need: 'Deuxième unité fixe pour la carrière Est-3.', prob: 70, created: '2025-05-12', team: [['Camille Arnaud', 'estimator']] });
  await line(d5, 1, 'EMP-200 v2', 1, ['OPT-AUT-01', 'OPT-SEC-01', 'OPT-SRV-02']);
  const o5 = await offer(d5, 'A', { created: '2025-06-10' });
  await send(o5, '2025-06-16', 'Julien Faure', '2025-06-13');
  await order(o5.id, '2025-07-07', 'Julien Faure', 'BC-FEE-2025-044', 'PRJ-DEMO-091');

  const d4 = await deal({ ref: 'AF-2025-0027', cas: 1, customer: 'FIL-SUD', capex: 'CPX-2025-017/B01', site: 'Site Sud-2', origin: 'capex_need', owner: 'Julien Faure', need: 'Deux unités mobiles pour desservir les fosses du site Sud-2.', prob: 60, created: '2025-11-12', team: [['Camille Arnaud', 'estimator']] });
  await line(d4, 1, 'MEMU-50 v2', 2, ['OPT-AUT-01', 'OPT-ENV-02', 'OPT-SRV-01', 'OPT-SRV-02']);
  const o4 = await offer(d4, 'A', { created: '2026-01-20' });
  await send(o4, '2026-01-26', 'Julien Faure', '2026-01-23');
  await order(o4.id, '2026-02-19', 'Julien Faure', 'BC-FES-2026-004', 'PRJ-DEMO-104');

  // Returns of the closed projects (D-9: at closure).
  await feedback('CV-2024-0001', '2025-06-30', [400, 72, 55, 95, 34, 20], [640, 1580, 450], { 'OPT-AUT-01': 0.02, 'OPT-SEC-01': 0.04, 'OPT-SRV-01': 0, 'OPT-SRV-02': 0.05 }, ['REX-DEMO-018', 'Mise en service sans réserve.']);
  await feedback('CV-2025-0001', '2026-04-30', [590, 104, 82, 140, 50, 30], [960, 2380, 670], { 'OPT-AUT-01': 0.03, 'OPT-SEC-01': 0.05, 'OPT-SEC-02': 0.02, 'OPT-CAP-01': 0.07, 'SPE-2025-0031': 0.02 }, ['REX-DEMO-026', 'Trémie élargie livrée à temps.']);
  await feedback('CV-2025-0002', '2026-09-30', [488, 81, 74, 109, 66, 24], [870, 1820, 880], { 'OPT-AUT-01': 0.03, 'OPT-ENV-01': 0.06, 'OPT-CNF-01': 0.34, 'SPE-2025-0031': 0.14 }, ['REX-DEMO-031', 'Cabine livrée en pièces, montage sur site non prévu : à revoir avec le fournisseur.'], true);
  await feedback('CV-2025-0003', '2026-06-30', [372, 70, 50, 92, 30, 18], [590, 1550, 400], { 'OPT-AUT-01': 0.04, 'OPT-SEC-01': 0.03, 'OPT-SRV-02': 0 }, ['REX-DEMO-029', 'Mise en service dans les temps.']);
  await tx.insert(knowhowNotes).values({ optionId: optionId['OPT-CNF-01'], kind: 'avoid', body: 'Écart de +34 % sur PRJ-DEMO-087 : cabine livrée en pièces, montage sur site non prévu. Revoir le fournisseur avant toute nouvelle vente.', authorName: 'Marc Lenoir', createdAt: at('2026-10-05') });
  await tx.insert(knowhowNotes).values({ optionId: optionId['OPT-ENV-01'], kind: 'note', body: 'Traçage électrique : prévoir l’armoire en local chauffé.', authorName: 'Marc Lenoir', createdAt: at('2026-10-06') });

  // 2026 deals of the mockup
  const d35 = await deal({ ref: 'AF-2026-0035', cas: 3, customer: 'CARR-DEMO', site: 'Carrière Démo', origin: 'customer_request', owner: 'Hugo Lemaire', need: 'Deux unités de stockage et de pompage pour la carrière.', prob: 60, created: '2026-04-02', team: [['Camille Arnaud', 'estimator']] });
  await line(d35, 1, 'SPUR-30 v1', 2, []);
  const o35 = await offer(d35, 'A', { created: '2026-05-04' });
  await send(o35, '2026-05-12', 'Hugo Lemaire', '2026-05-11');
  const cv8 = await order(o35.id, '2026-06-02', 'Hugo Lemaire', 'CMD-CD-2026-07', 'PRJ-DEMO-118');
  const r14 = await quote({ ref: 'DC-2026-0014', title: 'Kit d’insonorisation 75 dB(A)', deal: 'AF-2026-0035', machine: 'SPUR-30', cat: 'environment', cls: 'quote', received: '2026-08-03', by: 'Camille Arnaud', family: 'SPUR:environment',
    answers: { 'Que doit faire l’option ?': 'Ramener le bruit à 75 dB(A) en limite de propriété.', 'Quel problème résout-elle ?': 'Exigence du permis d’exploiter du client.', 'Niveau sonore exigé': '75' } });
  await qualify(r14, 'feasible', 'Capotage des pompes et silencieux.', 'never', '2026-08-05');
  await estimate(r14, { m: 16, s: 3, eh: 20, wh: 80, sh: 16, x: 1, sale: 38, weeks: 2, assumptions: 'Mesure acoustique fournie par le client.', deltas: [['ART-910330', 'Capotage acoustique de pompe', 2, 'u'], ['ART-910902', 'Silencieux d’échappement', 1, 'u']] });
  await answer(r14, 'DC-2026-0014', 'Kit d’insonorisation 75 dB(A)', 'environment', 'SPUR-30', '2026-08-21', 2);
  {
    const w = await loadModulus(tx, '2026-09-09');
    await amend(tx, w, cv8, actor('Hugo Lemaire', 'sales'), { line: 1, add: ['SPE-2026-0014'], remove: [], reason: 'Exigence du permis d’exploiter du client (bruit en limite de propriété).', on: '2026-09-09' });
  }

  const d42 = await deal({ ref: 'AF-2026-0042', cas: 1, customer: 'FIL-NORD', capex: 'CPX-2026-014/B01', site: 'Site Nord-1', origin: 'capex_need', owner: 'Julien Faure', wished: 'juin 2027',
    need: 'Une unité fixe pour le site Nord-1 (20 t/h, hivers à −15 °C) et trois unités mobiles pour desservir les fosses. Démarrages d’hiver à améliorer.', prob: 60, created: '2026-10-02',
    team: [['Camille Arnaud', 'estimator'], ['Marc Lenoir', 'engineering']] });
  const l42 = await line(d42, 1, 'EMP-200 v3', 1, ['OPT-AUT-01', 'OPT-AUT-02']);
  await line(d42, 2, 'MEMU-50 v2', 3, ['OPT-SRV-02']);
  const o42a = await offer(d42, 'A', { created: '2026-10-05', assumptions: 'Génie civil et dalle à la charge de la filiale. Air comprimé 6 bar disponible au pied de l’unité.' });
  await send(o42a, '2026-10-12', 'Julien Faure', '2026-10-10');
  for (const o of ['OPT-CAP-01', 'OPT-SEC-02']) await tx.insert(dealLineOptions).values({ lineId: l42, optionId: optionId[o] });
  const o42b = await offer(d42, 'B', { discount: 6, created: '2026-11-21', note: 'ajout trémie élargie et passerelles',
    assumptions: 'Génie civil et dalle à la charge de la filiale. Air comprimé 6 bar disponible au pied de l’unité. Option spécifique DC-2026-0017 au prix de la réponse de cotation (classe devis). Transport maritime jusqu’au port.',
    reservations: 'Option « Additif démarrage à froid » jamais faite : délai +4 sem. possible. Validité soumise à la grille 2026 (fin le 31 déc. 2026).' });
  void o42b;
  await tx.update(deals).set({ state: 'quoting' }).where(eq(deals.id, d42));
  const r17 = await quote({ ref: 'DC-2026-0017', title: 'Dosage d’additif pour démarrage à froid', deal: 'AF-2026-0042', capex: 'CPX-2026-014/B01', machine: 'EMP-200', cat: 'automation', cls: 'quote', received: '2026-11-03', by: 'Camille Arnaud', family: 'EMP:automation', answers: DC17 });
  await qualify(r17, 'feasible', 'Faisable avec le doseur de la gamme additifs ; essai en atelier conseillé. Proche du préchauffage émulsion livré en 2025.', 'never', '2026-11-10');
  await estimate(r17, { m: 14, s: 0, eh: 80, wh: 60, sh: 16, x: 1, sale: 38, weeks: 4, assumptions: 'Automate du site compatible Profinet. Additif fourni par la filiale. Pas de zone ATEX.', deltas: [['ART-910330', 'Doseur volumétrique additif 0,5–3 kg/t', 1, 'u'], ['ART-910902', 'Cuve additif calorifugée 1 m³', 1, 'u'], ['ART-910508', 'Sonde de température matrice', 2, 'u']] });
  for (const [name, body, on] of [
    ['Marc Lenoir', 'Qualifiée faisable. Question au demandeur : l’additif est-il fourni par la filiale ou par le groupe ?', '2026-11-10'],
    ['Filiale Exemple Nord (via Arche)', 'Fourni par la filiale, livré en IBC de 1 m³.', '2026-11-12'],
    ['Camille Arnaud', 'Chiffrage en cours, réponse prévue le 24 nov. (classe devis).', '2026-11-21'],
  ] as const) await tx.insert(quoteMessages).values({ requestId: r17, authorName: name, body, createdAt: at(on, 10) });

  const d49 = await deal({ ref: 'AF-2026-0049', cas: 2, customer: 'MINE-SAHEL', inter: 'FIL-SUD', site: 'Mine Sahel, fosse 2', origin: 'customer_request', owner: 'Inès Barbier', wished: 'sept. 2027',
    need: 'Deux unités fixes pour la fosse 2, alimentation électrique du site instable.', prob: 40, created: '2026-10-20', team: [['Camille Arnaud', 'estimator'], ['Marc Lenoir', 'engineering']] });
  await line(d49, 1, 'EMP-200 v3', 2, ['OPT-AUT-01', 'OPT-SRV-01']);
  await offer(d49, 'A', { created: '2026-11-18' });
  await tx.update(deals).set({ state: 'quoting' }).where(eq(deals.id, d49));
  const r21 = await quote({ ref: 'DC-2026-0021', title: 'Double alimentation électrique secourue', deal: 'AF-2026-0049', machine: 'EMP-200', cat: 'safety', cls: 'quote', received: '2026-11-20', by: 'Marc Lenoir',
    answers: { 'Que doit faire l’option ?': 'Basculer sur une seconde alimentation en cas de coupure.', 'Quel problème résout-elle ?': 'Coupures fréquentes du réseau de la mine.', 'Produit traité et état': 'émulsion', 'Cadence visée': '20', 'Critères d’acceptation': 'Bascule sans arrêt de production.', 'Intérieur ou extérieur': 'extérieur', 'Températures mini / maxi': '+10 °C / +48 °C', 'Zone ATEX': 'non', 'Date souhaitée': 'sept. 2027' } });
  void r21;

  const d47 = await deal({ ref: 'AF-2026-0047', cas: 1, customer: 'FIL-OUEST', capex: 'CPX-2026-021/B02', site: 'Site Ouest-3', origin: 'capex_need', owner: 'Julien Faure', wished: 'déc. 2027', need: 'Deux unités mobiles grande capacité pour le site Ouest-3.', prob: 30, created: '2026-11-10', team: [['Marc Lenoir', 'engineering']] });
  await line(d47, 1, 'MEMU-80 v1', 2, ['OPT-AUT-01']);
  await quote({ ref: 'DC-2026-0019', title: 'Benne de transfert grande capacité', deal: 'AF-2026-0047', capex: 'CPX-2026-021/B02', machine: 'MEMU-80', cat: 'capacity', cls: 'indicative', received: '2026-11-13', by: 'Marc Lenoir', family: 'MEMU:capacity',
    answers: { 'Que doit faire l’option ?': 'Transférer 3 t de nitrate entre deux tournées.', 'Quel problème résout-elle ?': 'Trop d’allers-retours au dépôt.', 'Produit traité et état': 'poudre', 'Cadence visée': '8', 'Critères d’acceptation': 'Transfert en moins de 10 min.', 'Intérieur ou extérieur': 'extérieur', 'Températures mini / maxi': '0 °C / +40 °C', 'Zone ATEX': 'non', 'Date souhaitée': 'déc. 2027', 'Charge utile visée': '8' } });

  const d38 = await deal({ ref: 'AF-2026-0038', cas: 2, customer: 'MINE-EXEMPLE', inter: 'FIL-SUD', site: 'Mine Exemple, zone B', origin: 'tender', owner: 'Inès Barbier', wished: 'mars 2027', need: 'Appel d’offres : une unité fixe 40 t/h, liaison avec le SCADA du site.', prob: 50, created: '2026-09-01', team: [['Camille Arnaud', 'estimator']] });
  await line(d38, 1, 'EMP-400 v2', 1, ['OPT-AUT-01', 'OPT-SEC-01', 'OPT-SRV-01']);
  const o38 = await offer(d38, 'A', { created: '2026-10-20' });
  await send(o38, '2026-10-28', 'Inès Barbier', '2026-10-27');
  await quote({ ref: 'DC-2026-0020', title: 'Passerelle Modbus vers le SCADA du site', deal: 'AF-2026-0038', machine: 'EMP-400', cat: 'automation', cls: 'firm', received: '2026-11-18', by: 'Inès Barbier', family: 'EMP:automation',
    answers: Object.fromEntries(Object.entries({ ...DC17, 'Que doit faire l’option ?': 'Remonter l’état de l’unité et les quantités produites vers le SCADA du site minier.' }).filter(([k]) => !['Critères d’acceptation', 'Températures mini / maxi', 'Marque et modèle de l’automate du site', 'Zone ATEX', 'Arrêt d’urgence câblé vers le client ?', 'Date souhaitée'].includes(k))) });

  const d31 = await deal({ ref: 'AF-2026-0031', cas: 3, customer: 'MINE-ANDES', site: 'Mine Andes', origin: 'tender', owner: 'Hugo Lemaire', wished: 'janv. 2027', need: 'Unité fixe pour une mine à 4 500 m d’altitude.', prob: 40, created: '2026-06-15', team: [['Camille Arnaud', 'estimator'], ['Marc Lenoir', 'engineering']] });
  await line(d31, 1, 'EMP-200 v3', 1, ['OPT-ENV-01']);
  const r12 = await quote({ ref: 'DC-2026-0012', title: 'Fonctionnement à 4 500 m d’altitude', deal: 'AF-2026-0031', machine: 'EMP-200', cat: 'environment', cls: 'indicative', received: '2026-07-02', by: 'Marc Lenoir', family: 'EMP:environment', answers: { 'Que doit faire l’option ?': 'Garantir la production à 4 500 m.', 'Altitude du site': '4500' } });
  await qualify(r12, 'refused', 'Hors de notre savoir-faire : déclassement des moteurs et de la pompe non qualifié au-delà de 3 000 m.', 'avoid', '2026-07-06');
  const o31 = await offer(d31, 'A', { created: '2026-07-10' });
  await send(o31, '2026-07-15', 'Hugo Lemaire', '2026-07-14');
  await tx.update(deals).set({ state: 'lost', probability: 0, lossReason: 'price', lossNote: 'prix · concurrent' }).where(eq(deals.id, d31));
  await tx.update(offers).set({ state: 'declined' }).where(eq(offers.id, o31.id));

  const d29 = await deal({ ref: 'AF-2026-0029', cas: 1, customer: 'FIL-EST', capex: 'CPX-2026-006/B01', site: 'Site Est-2', origin: 'capex_need', owner: 'Julien Faure', need: 'Une unité mobile pour le site Est-2.', prob: 30, created: '2026-05-20', team: [] });
  await line(d29, 1, 'MEMU-50 v2', 1, ['OPT-SRV-02']);
  await tx.update(deals).set({ state: 'abandoned', probability: 0, lossReason: 'project_abandoned', lossNote: 'CAPEX arrêté en G1' }).where(eq(deals.id, d29));

  const d51 = await deal({ ref: 'AF-2026-0051', cas: 3, customer: 'EXPLO-DEMO', site: 'à préciser', origin: 'renewal', owner: 'Hugo Lemaire', wished: '2028', need: 'Renouvellement d’une unité fixe en fin de vie.', prob: 20, created: '2026-11-19', team: [] });
  await line(d51, 1, 'EMP-200 v3', 1, []);

  // Reviews still to decide: AF-2026-0049 A and AF-2026-0042 B (above 150 k€).

  // Counters after the explicit references of the data set.
  for (const [prefix, year, value] of [['AF', 2026, 51], ['AF', 2025, 27], ['AF', 2024, 15], ['DC', 2026, 21], ['DC', 2025, 31]] as const)
    await tx.insert(counters).values({ prefix, year, value }).onConflictDoUpdate({ target: [counters.prefix, counters.year], set: { value } });
}
