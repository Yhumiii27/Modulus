// "View as" personas of the demo mode: one fictitious person per Modulus role (no real person; e-mail domain demo.example).
import type { RoleKey } from '@/config/roles';

export const DEMO_PERSONAS: readonly { role: RoleKey; name: string; email: string }[] = [
  { role: 'estimator', name: 'Camille Arnaud', email: 'camille.arnaud@demo.example' },
  { role: 'sales', name: 'Julien Faure', email: 'julien.faure@demo.example' },
  { role: 'engineering', name: 'Marc Lenoir', email: 'marc.lenoir@demo.example' },
  { role: 'sales_director', name: 'Sophie Vidal', email: 'sophie.vidal@demo.example' },
  { role: 'general_management', name: 'Henri Collet', email: 'henri.collet@demo.example' },
  { role: 'portfolio_management', name: 'Lucie Mercier', email: 'lucie.mercier@demo.example' },
  { role: 'reader', name: 'Anne Duval', email: 'anne.duval@demo.example' },
  { role: 'admin', name: 'Paul Vasseur', email: 'paul.vasseur@demo.example' },
];

/** Other people of the demonstration teams (no role of their own in "View as"). */
export const DEMO_COLLEAGUES: readonly { name: string; email: string }[] = [
  { name: 'Inès Barbier', email: 'ines.barbier@demo.example' },
  { name: 'Hugo Lemaire', email: 'hugo.lemaire@demo.example' },
];
