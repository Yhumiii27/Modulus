// State tags (Nocturne: severity is accent intensity, never a hard-coded colour). Server-compatible.
import { Tag, type TagTone } from '@norma/charte/ds/Tag';
import {
  DEAL_STATE_LABEL, KNOWHOW_LEVEL_LABEL, OFFER_STATE_LABEL, PRICE_LIST_STATE_LABEL, QUOTE_STATE_LABEL, VERSION_STATE_LABEL,
  type DealState, type KnowhowLevel, type OfferState, type PriceListState, type QuoteState, type VersionState,
} from '@/domain/vocab';
import type { T } from '@/i18n/translate';
import s from './pages.module.css';

const DEAL_TONE: Record<DealState, TagTone> = { open: 'neutral', quoting: 'accent', offer_sent: 'accent-2', won: 'outline', lost: 'neutral', abandoned: 'neutral' };
export const DealTag = ({ state, t }: { state: string; t: T }) => <Tag tone={DEAL_TONE[state as DealState] ?? 'neutral'}>{t(DEAL_STATE_LABEL[state as DealState] ?? state)}</Tag>;

export const VersionTag = ({ state, t }: { state: string; t: T }) => <Tag tone={state === 'published' ? 'accent' : state === 'draft' ? 'outline' : 'neutral'}>{t(VERSION_STATE_LABEL[state as VersionState] ?? state)}</Tag>;

export const OfferTag = ({ state, t }: { state: string; t: T }) => <Tag tone={state === 'sent' ? 'accent' : state === 'accepted' ? 'outline' : state === 'draft' ? 'accent-2' : 'neutral'}>{t(OFFER_STATE_LABEL[state as OfferState] ?? state)}</Tag>;

export const QuoteTag = ({ state, incomplete, t }: { state: string; incomplete?: boolean; t: T }) =>
  incomplete && state === 'qualification' ? <Tag tone="outline">{t('incomplete')}</Tag> : <Tag tone={state === 'estimating' ? 'accent' : state === 'qualification' ? 'accent-2' : state === 'answered' ? 'outline' : 'neutral'}>{t(QUOTE_STATE_LABEL[state as QuoteState] ?? state)}</Tag>;

export const PriceListTag = ({ state, t }: { state: string; t: T }) => <Tag tone={state === 'published' ? 'accent' : state === 'to_validate' ? 'outline' : 'neutral'}>{t(PRICE_LIST_STATE_LABEL[state as PriceListState] ?? state)}</Tag>;

/** A know-how level, coloured by the tokens of the level (pages.module.css `.lv-*`). */
export const LevelTag = ({ level, t }: { level: KnowhowLevel; t: T }) => <span className={`${s.cell} ${s.lvTag} ${s[`lv-${level}`]}`}>{t(KNOWHOW_LEVEL_LABEL[level])}</span>;

export const LateTag = ({ days, t }: { days: number; t: T }) => (days > 0 ? <Tag tone="accent-2">{t('late')} +{days} {t('wd')}</Tag> : null);
