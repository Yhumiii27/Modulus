// Sidebar icons per screen (Phosphor). Kept apart from ./screens.ts so the registry imports no component.
import type { Icon } from '@phosphor-icons/react';
import { Book, ClipboardText, Cube, Gear, GridFour, Handshake, House, ListChecks, LockSimple, Package, Sliders } from '@phosphor-icons/react/dist/ssr';
import type { ScreenId } from './screens';

export const SCREEN_ICONS: Partial<Record<ScreenId, Icon>> = {
  home: House, deals: Handshake, deal: Handshake, configurator: Sliders, quotes: ClipboardText, quote: ClipboardText, sold: LockSimple,
  soldConfig: LockSimple, catalogue: Package, machine: Package, knowhow: GridFour, questionnaires: ListChecks, settings: Gear, journal: Book,
};
export const BRAND_ICON = Cube;
