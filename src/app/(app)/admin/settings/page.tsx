// Lead times and thresholds (D-11, D-12 "make it adjustable", D-4, D-8, D-14): every change is journalled with its author and
// applies to the computations that follow, never to an offer already sent.
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { KeyValueList } from '@/components/app/KeyValueList';
import { can } from '@/domain/rights';
import { SettingsForm, ResetSettingsButton } from '@/features/commerce/forms';
import s from '@/features/commerce/pages.module.css';
import { Notice } from '@/features/commerce/view';
import { fmtKeur } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

export default async function SettingsPage() {
  const [{ t, lang }, viewer, today] = await Promise.all([getI18n(), getViewer(), businessToday()]);
  const w = await loadWorld(today);
  const st = w.settings;
  const may = can(viewer.roles, 'settings');
  return (
    <>
      <PageHeader screen="settings" crumbs={['Administration']} primary={may ? <SettingsForm d={st} /> : undefined} actions={may ? <ResetSettingsButton /> : undefined} />
      <div className={s.grid2}>
        <SectionCard title={t('Target answer time per estimate class')} hint={t('D-11: 5 / 15 / 30 working days by default, adjustable here')}>
          <KeyValueList items={[
            { k: t('Indicative'), v: `${st.targetDays.indicative} ${t('working days')} · ${t('reminder')} ${st.reminderDays.indicative}` },
            { k: t('Quote'), v: `${st.targetDays.quote} ${t('working days')} · ${t('reminder')} ${st.reminderDays.quote}` },
            { k: t('Firm offer'), v: `${st.targetDays.firm} ${t('working days')} · ${t('reminder')} ${st.reminderDays.firm}` },
          ]} />
        </SectionCard>
        <SectionCard title={t('Offer review')} hint="D-8, D-4">
          <KeyValueList items={[
            { k: t('Review required beyond'), v: fmtKeur(st.reviewAboveKeur, lang) },
            { k: t('Review required if an option is'), v: t('“never done” or “to avoid”') },
            { k: t('Minimum margin (review checklist)'), v: `${st.minMarginPct} %` },
            { k: t('Discount validated by the general management too beyond'), v: `${st.discountGeneralPct} %` },
          ]} />
        </SectionCard>
        <SectionCard title={t('Validity of prices')} hint={t('Dated price lists in euros (D-14)')}>
          <KeyValueList items={[
            { k: t('Alert before the end of a price list'), v: `${st.priceListAlertDays} ${t('days')}` },
            { k: t('Default validity of an offer'), v: `${st.offerValidityDays} ${t('days')}` },
            { k: t('Default validity of a quotation answer'), v: `${st.quoteValidityDays} ${t('days')}` },
          ]} />
        </SectionCard>
        <SectionCard title={t('Know-how levels')} hint={t('D-12, adjustable like D-11')}>
          <KeyValueList items={[
            { k: t('“Mastered”: deliveries at least'), v: `${st.masteredDeliveries}` },
            { k: t('“Mastered”: gap real / budget at most'), v: `${st.masteredGapPct} %` },
            { k: t('“To avoid”: gap beyond'), v: `${st.avoidGapPct} %` },
            { k: t('Propose for the catalogue after'), v: `${st.proposeAfterSales} ${t('sales')}` },
            { k: t('Flag an option unsold for'), v: `${st.unsoldMonths} ${t('months')}` },
          ]} />
        </SectionCard>
        <SectionCard title={t('Hourly rates of the computed budget')} hint="D-7">
          <KeyValueList items={[
            { k: t('Engineering'), v: `${st.rates.engineering_hours} €/h` }, { k: t('Workshop'), v: `${st.rates.workshop_hours} €/h` }, { k: t('Site'), v: `${st.rates.site_hours} €/h` },
          ]} />
        </SectionCard>
      </div>
      <Notice>{t('Every change of a setting is recorded in the journal (append-only) with its author; it applies to the computations that follow, never to an offer already sent.')}</Notice>
    </>
  );
}
