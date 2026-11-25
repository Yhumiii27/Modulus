// Lead times and thresholds of Modulus (D-4, D-8, D-11, D-12, D-14), adjustable in the administration ("make it adjustable",
// owner's answers to D-11 and D-12). Pure: the defaults, the validation and the merge with what is stored (app_settings key
// `modulus.thresholds`). A change applies to the computations that follow, never to an offer already sent.
import { z } from 'zod';

export const SETTINGS_KEY = 'modulus.thresholds';

export const SettingsSchema = z.object({
  /** Target answer time of a quotation request per estimate class, in working days (D-11: 5 / 15 / 30). */
  targetDays: z.object({ indicative: z.number().int().min(1).max(120), quote: z.number().int().min(1).max(120), firm: z.number().int().min(1).max(120) }),
  /** Reminder after this many working days per class. */
  reminderDays: z.object({ indicative: z.number().int().min(1).max(120), quote: z.number().int().min(1).max(120), firm: z.number().int().min(1).max(120) }),
  /** Offer review mandatory beyond this amount, in k€ (D-8). */
  reviewAboveKeur: z.number().min(0).max(100000),
  /** Minimum margin of the review checklist, in %. */
  minMarginPct: z.number().min(0).max(90),
  /** A discount beyond this % is validated by the general management too (D-4). */
  discountGeneralPct: z.number().min(0).max(50),
  /** Alert before the end of a price list, in days. */
  priceListAlertDays: z.number().int().min(0).max(365),
  /** Default validity of an offer and of a quotation answer, in days. */
  offerValidityDays: z.number().int().min(1).max(365),
  quoteValidityDays: z.number().int().min(1).max(365),
  /** Know-how levels (D-12). */
  masteredDeliveries: z.number().int().min(1).max(50),
  masteredGapPct: z.number().min(0).max(100),
  avoidGapPct: z.number().min(0).max(500),
  proposeAfterSales: z.number().int().min(1).max(50),
  unsoldMonths: z.number().int().min(1).max(120),
  /** Hourly rates of the computed budget, in € per hour (D-7). */
  rates: z.object({ engineering_hours: z.number().min(0).max(1000), workshop_hours: z.number().min(0).max(1000), site_hours: z.number().min(0).max(1000) }),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  targetDays: { indicative: 5, quote: 15, firm: 30 },
  reminderDays: { indicative: 3, quote: 10, firm: 20 },
  reviewAboveKeur: 150,
  minMarginPct: 18,
  discountGeneralPct: 10,
  priceListAlertDays: 60,
  offerValidityDays: 90,
  quoteValidityDays: 90,
  masteredDeliveries: 3,
  masteredGapPct: 10,
  avoidGapPct: 30,
  proposeAfterSales: 2,
  unsoldMonths: 24,
  rates: { engineering_hours: 85, workshop_hours: 60, site_hours: 75 },
};

/** The stored value merged over the defaults (a missing or invalid stored value gives the defaults). */
export function settingsOf(stored: unknown): Settings {
  const s = (stored && typeof stored === 'object' ? stored : {}) as Partial<Settings>;
  const merged = {
    ...DEFAULT_SETTINGS, ...s,
    targetDays: { ...DEFAULT_SETTINGS.targetDays, ...(s.targetDays ?? {}) },
    reminderDays: { ...DEFAULT_SETTINGS.reminderDays, ...(s.reminderDays ?? {}) },
    rates: { ...DEFAULT_SETTINGS.rates, ...(s.rates ?? {}) },
  };
  const r = SettingsSchema.safeParse(merged);
  return r.success ? r.data : DEFAULT_SETTINGS;
}
