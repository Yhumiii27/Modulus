'use client';
// The side-panel forms of Modulus (Norma § 7: never a form open in the page — a button opens a panel, closed on success). Each
// one only collects the input; its Server Function (./actions.ts) checks everything again. Labels are EN source strings.
import type { ReactNode } from 'react';
import { ActionButton, ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@norma/charte/ds/Field';
import { useI18n } from '@/i18n/client';
import {
  ANSWER_TYPES, ANSWER_TYPE_LABEL, BUDGET_POSTS, BUDGET_POST_LABEL, CONDITION_OPS, CURRENCIES, DEAL_ORIGINS, DEAL_ORIGIN_LABEL, DELTA_OPS, DELTA_OP_LABEL, ESTIMATE_CLASSES,
  ESTIMATE_CLASS_LABEL, FEASIBILITIES, FEASIBILITY_LABEL, KNOWHOW_LEVELS, KNOWHOW_LEVEL_LABEL, LOSS_REASONS, LOSS_REASON_LABEL, OPTION_CATEGORIES, OPTION_CATEGORY_LABEL,
  QUESTION_THEMES, QUESTION_THEME_LABEL, RULE_KINDS, RULE_KIND_LABEL, SALE_CASE_LABEL, TEAM_ROLES, TEAM_ROLE_LABEL, UNITS, isHourPost,
} from '@/domain/vocab';
import type { Settings } from '@/domain/settings';
import * as A from './actions';
import s from './forms.module.css';

export interface Option { value: string; label: string }

function useOpts() {
  const { t } = useI18n();
  return <K extends string>(keys: readonly K[], labels: Record<K, string>, empty?: string): Option[] => [
    ...(empty ? [{ value: '', label: t(empty) }] : []),
    ...keys.map((k) => ({ value: k, label: t(labels[k]) })),
  ];
}

const Row = ({ children }: { children: ReactNode }) => <div className={s.row}>{children}</div>;

function L({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const { t } = useI18n();
  return <Field label={t(label)} hint={hint ? t(hint) : undefined}>{children}</Field>;
}

const Hidden = ({ name, value }: { name: string; value: string | number }) => <input type="hidden" name={name} value={value} />;

function Checks({ name, options, defaults = [] }: { name: string; options: Option[]; defaults?: string[] }) {
  return (
    <div className={s.checks}>
      {options.map((o) => (
        <label key={o.value} className={s.check}>
          <input type="checkbox" name={name} value={o.value} defaultChecked={defaults.includes(o.value)} /> {o.label}
        </label>
      ))}
    </div>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  const { t } = useI18n();
  return <label className={s.check}><input type="checkbox" name={name} defaultChecked={defaultChecked} /> {t(label)}</label>;
}

// ── Catalogue ──────────────────────────────────────────────────────────────────────────────────────────────────────

export function NewMachineForm({ types, primary }: { types: Option[]; primary?: boolean }) {
  return (
    <Folded summary="New machine" variant={primary ? 'primary' : 'secondary'}>
      <ActionForm action={A.createMachineAction} submit="Create the draft" done="Machine created">
        <Row>
          <L label="Machine type"><Select name="type" options={types} /></L>
          <L label="Code" hint="The type, a dash, then capitals and digits"><Input name="code" placeholder="EMP-300" required /></L>
        </Row>
        <L label="Label"><Input name="label" required maxLength={120} /></L>
        <Row>
          <L label="Nominal capacity"><Input name="capacity" inputMode="decimal" required /></L>
          <L label="Unit"><Input name="unit" placeholder="t/h" required /></L>
          <L label="Standard lead time (weeks)"><Input name="lead" inputMode="numeric" required /></L>
        </Row>
        <L label="Description"><Textarea name="description" rows={3} /></L>
      </ActionForm>
    </Folded>
  );
}

export interface VersionDefaults { label: string; capacity: number; lead: number; note: string | null; datasheet: string | null; description: string | null; chars: { key: string; label: string; unit: string | null; value: string }[] }

export function EditVersionForm({ code, d }: { code: string; d: VersionDefaults }) {
  return (
    <Folded summary="Edit the draft">
      <ActionForm action={A.updateVersionAction} submit="Save" done="Draft saved">
        <Hidden name="code" value={code} />
        <L label="Label"><Input name="label" defaultValue={d.label} required /></L>
        <Row>
          <L label="Nominal capacity"><Input name="capacity" defaultValue={d.capacity} inputMode="decimal" required /></L>
          <L label="Standard lead time (weeks)"><Input name="lead" defaultValue={d.lead} inputMode="numeric" required /></L>
        </Row>
        {d.chars.map((c) => <L key={c.key} label={c.label}><Input name={`char_${c.key}`} defaultValue={c.value} placeholder={c.unit ?? ''} /></L>)}
        <L label="Datasheet (Codex reference)"><Input name="datasheet" defaultValue={d.datasheet ?? ''} /></L>
        <L label="Note of the version"><Input name="note" defaultValue={d.note ?? ''} /></L>
        <L label="Description"><Textarea name="description" rows={3} defaultValue={d.description ?? ''} /></L>
      </ActionForm>
    </Folded>
  );
}

export function BomLineForm({ code }: { code: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Add a BOM line">
      <ActionForm action={A.addBomLineAction} submit="Add" done="Line added">
        <Hidden name="code" value={code} />
        <Row>
          <L label="Sub-assembly"><Input name="subassembly" required /></L>
          <L label="Mark"><Input name="mark" required maxLength={12} /></L>
        </Row>
        <L label="Article (Keystone)" hint="Read in keystone.pub_articles (D-5)"><Input name="article" placeholder="ART-100210" required /></L>
        <L label="Designation"><Input name="designation" required /></L>
        <Row>
          <L label="Quantity"><Input name="quantity" inputMode="decimal" required /></L>
          <L label="Unit"><Select name="unit" options={UNITS.map((u) => ({ value: u, label: t(u) }))} /></L>
        </Row>
      </ActionForm>
    </Folded>
  );
}

export function NewOptionForm({ machines }: { machines: Option[] }) {
  const o = useOpts();
  return (
    <Folded summary="Add an option">
      <ActionForm action={A.createOptionAction} submit="Create the option" done="Option created">
        <Row>
          <L label="Code" hint="OPT-, three capitals, dash, two digits"><Input name="code" placeholder="OPT-AUT-04" required /></L>
          <L label="Category"><Select name="category" options={o(OPTION_CATEGORIES, OPTION_CATEGORY_LABEL)} /></L>
        </Row>
        <L label="Label"><Input name="label" required /></L>
        <L label="Extra lead time (weeks)"><Input name="weeks" inputMode="numeric" defaultValue={0} /></L>
        <L label="Machines it applies to"><Checks name="machines" options={machines} /></L>
        <L label="Description"><Textarea name="description" rows={2} /></L>
      </ActionForm>
    </Folded>
  );
}

export function RuleForm({ options }: { options: Option[] }) {
  const o = useOpts();
  const { t } = useI18n();
  return (
    <Folded summary="Add a rule">
      <ActionForm action={A.addRuleAction} submit="Add the rule" done="Rule added">
        <L label="Option"><Select name="option" options={options} /></L>
        <L label="Rule"><Select name="kind" options={o(RULE_KINDS, RULE_KIND_LABEL)} /></L>
        <L label="Target option" hint="excludes, requires, one of"><Select name="target" options={[{ value: '', label: '—' }, ...options]} /></L>
        <Row>
          <L label="Characteristic" hint="mandatory if"><Input name="key" placeholder="capacity" /></L>
          <L label="Operator"><Select name="op" options={[{ value: '', label: '—' }, ...CONDITION_OPS.map((x) => ({ value: x, label: x }))]} /></L>
          <L label="Value"><Input name="value" inputMode="decimal" /></L>
        </Row>
        <L label="Explanation"><Textarea name="explanation" rows={2} required placeholder={t('Shown when the rule applies')} /></L>
      </ActionForm>
    </Folded>
  );
}

export function DeltaForm({ options }: { options: Option[] }) {
  const o = useOpts();
  const { t } = useI18n();
  return (
    <Folded summary="Add a BOM delta">
      <ActionForm action={A.addDeltaAction} submit="Add" done="Delta added">
        <L label="Option"><Select name="option" options={options} /></L>
        <L label="Operation"><Select name="op" options={o(DELTA_OPS, DELTA_OP_LABEL)} /></L>
        <L label="Article (Keystone)"><Input name="article" placeholder="ART-700100" required /></L>
        <L label="Designation"><Input name="designation" required /></L>
        <Row>
          <L label="Quantity"><Input name="quantity" inputMode="decimal" /></L>
          <L label="Unit"><Select name="unit" options={[{ value: '', label: '—' }, ...UNITS.map((u) => ({ value: u, label: t(u) }))]} /></L>
        </Row>
        <L label="Article replaced" hint="replaces"><Input name="replaces" placeholder="ART-100344" /></L>
      </ActionForm>
    </Folded>
  );
}

export interface BudgetDefault { post: string; enteredKeur: number | null; hours: number | null; basis: string | null }

export function BudgetForm({ code, subject, versionId, option, rows }: { code: string; subject: 'version' | 'option'; versionId?: string; option?: string; rows: BudgetDefault[] }) {
  const { t } = useI18n();
  return (
    <Folded summary="Edit the budget" title={subject === 'option' ? `Budget · ${option}` : undefined}>
      <ActionForm action={A.setBudgetAction} submit="Save the budget" done="Budget saved">
        <Hidden name="code" value={code} />
        <Hidden name="subject" value={subject} />
        {versionId && <Hidden name="version" value={versionId} />}
        {option && <Hidden name="option" value={option} />}
        {BUDGET_POSTS.map((p) => {
          const d = rows.find((r) => r.post === p);
          return (
            <Row key={p}>
              <L label={`${BUDGET_POST_LABEL[p]} (k€)`}><Input name={`k_${p}`} inputMode="decimal" defaultValue={d?.enteredKeur ?? ''} /></L>
              {isHourPost(p) ? <L label="Standard hours"><Input name={`h_${p}`} inputMode="decimal" defaultValue={d?.hours ?? ''} /></L> : <span />}
              <L label="Basis"><Input name={`b_${p}`} defaultValue={d?.basis ?? ''} placeholder={t('What the figure rests on')} /></L>
            </Row>
          );
        })}
      </ActionForm>
    </Folded>
  );
}

export function NewPriceListForm({ year }: { year: number }) {
  return (
    <Folded summary="New price list">
      <ActionForm action={A.createPriceListAction} submit="Propose the price list" done="Price list proposed">
        <L label="Code"><Input name="code" defaultValue={`GRILLE-${year}`} required /></L>
        <Row>
          <L label="Valid from"><Input name="from" type="date" defaultValue={`${year}-01-01`} required /></L>
          <L label="Valid to"><Input name="to" type="date" defaultValue={`${year}-12-31`} required /></L>
        </Row>
        <Row>
          <L label="Factor on the list in force" hint="1.03 = +3 %"><Input name="factor" inputMode="decimal" defaultValue="1.03" /></L>
          <L label="Maximum discount (%)"><Input name="maxDiscount" inputMode="decimal" defaultValue="10" /></L>
        </Row>
      </ActionForm>
    </Folded>
  );
}

export function PriceForm({ list, items }: { list: string; items: Option[] }) {
  return (
    <Folded summary="Edit a price" title={`${list}`}>
      <ActionForm action={A.setPriceAction} submit="Save the price" done="Price saved">
        <Hidden name="list" value={list} />
        <L label="Machine or option"><Select name="item" options={items} /></L>
        <L label="Sale price (k€)"><Input name="sale" inputMode="decimal" required /></L>
      </ActionForm>
    </Folded>
  );
}

export function ValidatePriceListButton({ code, label }: { code: string; label: string }) {
  return <ActionButton run={A.validatePriceListAction.bind(null, code)} label={label} done="Price list validated" variant="primary" />;
}

export function NewVersionButton({ code }: { code: string }) {
  return <ActionButton run={A.newVersionAction.bind(null, code)} label="New version" done="Draft version created" />;
}

export function PublishVersionButton({ code, version }: { code: string; version: number }) {
  const { t } = useI18n();
  return <ActionButton run={A.publishVersionAction.bind(null, code)} label={`${t('Publish')} v${version}`} done="Version published" />;
}

export function RemoveBomLineButton({ code, id }: { code: string; id: string }) {
  return <ActionButton run={A.removeBomLineAction.bind(null, code, id)} label="Remove" done="Line removed" variant="ghost" />;
}

// ── Deals ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export function NewDealForm({ customers, subsidiaries, primary, capexNeed }: { customers: Option[]; subsidiaries: Option[]; primary?: boolean; capexNeed?: boolean }) {
  const o = useOpts();
  const { t } = useI18n();
  return (
    <Folded summary={capexNeed ? 'From an Arche need' : 'New deal'} variant={primary ? 'primary' : 'secondary'}>
      <ActionForm action={A.createDealAction} submit="Open the deal" done="Deal opened">
        <L label="Sale case" hint="D-3: case 1 comes from an Arche CAPEX; in cases 2 and 3 the customer has no access to the group's tools">
          <Select name="saleCase" defaultValue={capexNeed ? '1' : '3'} options={([1, 2, 3] as const).map((c) => ({ value: String(c), label: t(SALE_CASE_LABEL[c]) }))} />
        </L>
        <L label="Customer" hint="Read in Keystone (D-16); leave empty for a new prospect"><Select name="customer" options={[{ value: '', label: t('New prospect (below)') }, ...customers]} /></L>
        <Row>
          <L label="Prospect name"><Input name="prospectName" /></L>
          <L label="Country (ISO)"><Input name="prospectCountry" maxLength={2} /></L>
        </Row>
        <L label="Intermediary subsidiary" hint="Case 2"><Select name="intermediary" options={[{ value: '', label: '—' }, ...subsidiaries]} /></L>
        <L label="Machine need of the CAPEX" hint="Case 1: CPX-YYYY-NNN/BNN"><Input name="capexNeed" placeholder="CPX-2026-014/B01" /></L>
        <L label="Delivery site"><Input name="site" required /></L>
        {!capexNeed && <L label="Origin"><Select name="origin" options={o(DEAL_ORIGINS.filter((x) => x !== 'capex_need'), DEAL_ORIGIN_LABEL)} /></L>}
        <L label="Need expressed"><Textarea name="need" rows={4} required /></L>
        <Row>
          <L label="Wished date"><Input name="wished" placeholder={t('June 2027')} /></L>
          <L label="Customer budget (k€)"><Input name="budget" inputMode="decimal" /></L>
          <L label="Probability (%)"><Input name="probability" inputMode="numeric" defaultValue={20} /></L>
        </Row>
      </ActionForm>
    </Folded>
  );
}

export function EditDealForm({ dealRef, d }: { dealRef: string; d: { probability: number; site: string; wished: string | null; need: string } }) {
  return (
    <Folded summary="Edit the deal">
      <ActionForm action={A.updateDealAction} submit="Save" done="Deal saved">
        <Hidden name="ref" value={dealRef} />
        <Row>
          <L label="Probability (%)"><Input name="probability" inputMode="numeric" defaultValue={d.probability} /></L>
          <L label="Wished date"><Input name="wished" defaultValue={d.wished ?? ''} /></L>
        </Row>
        <L label="Delivery site"><Input name="site" defaultValue={d.site} required /></L>
        <L label="Need expressed"><Textarea name="need" rows={4} defaultValue={d.need} required /></L>
      </ActionForm>
    </Folded>
  );
}

export function MemberForm({ dealRef, people }: { dealRef: string; people: Option[] }) {
  const o = useOpts();
  return (
    <Folded summary="Add to the team">
      <ActionForm action={A.addMemberAction} submit="Add" done="Team updated">
        <Hidden name="ref" value={dealRef} />
        <L label="Person"><Select name="user" options={people} /></L>
        <L label="Role in the deal"><Select name="role" options={o(TEAM_ROLES, TEAM_ROLE_LABEL)} /></L>
      </ActionForm>
    </Folded>
  );
}

export function LineForm({ dealRef, machines }: { dealRef: string; machines: Option[] }) {
  return (
    <Folded summary="Add a line">
      <ActionForm action={A.saveLineAction} submit="Add the line" done="Line added">
        <Hidden name="ref" value={dealRef} />
        <L label="Standard machine" hint="Published version; the options are chosen in the configurator"><Select name="machine" options={machines} /></L>
        <L label="Quantity"><Input name="quantity" inputMode="numeric" defaultValue={1} /></L>
      </ActionForm>
    </Folded>
  );
}

export function RemoveLineButton({ dealRef, number }: { dealRef: string; number: number }) {
  return <ActionButton run={A.removeLineAction.bind(null, dealRef, number)} label="Remove the line" done="Line removed" variant="ghost" />;
}

export function CloseDealForm({ dealRef, to }: { dealRef: string; to: 'lost' | 'abandoned' }) {
  const o = useOpts();
  return (
    <Folded summary={to === 'lost' ? 'Mark as lost' : 'Abandon'}>
      <ActionForm action={A.closeDealAction} submit={to === 'lost' ? 'Mark as lost' : 'Abandon'} done="Deal closed" variant="secondary">
        <Hidden name="ref" value={dealRef} />
        <Hidden name="to" value={to} />
        <L label="Reason"><Select name="lossReason" options={o(LOSS_REASONS, LOSS_REASON_LABEL, 'Choose')} /></L>
        <L label="Detail"><Textarea name="note" rows={2} /></L>
      </ActionForm>
    </Folded>
  );
}

export function OfferForm({ dealRef, letter, d, primary }: { dealRef: string; letter?: string; d: { discount: number; validity: number; currency: string; assumptions: string | null; reservations: string | null }; primary?: boolean }) {
  return (
    <Folded summary={letter ? 'Edit the draft offer' : 'New offer'} variant={primary ? 'primary' : 'secondary'}>
      <ActionForm action={letter ? A.updateOfferAction : A.createOfferAction} submit={letter ? 'Save' : 'Create the draft offer'} done={letter ? 'Offer saved' : 'Draft offer created'}>
        <Hidden name="ref" value={dealRef} />
        {letter && <Hidden name="letter" value={letter} />}
        <Row>
          <L label="Discount (%)" hint="D-4: beyond the threshold, the general management validates too"><Input name="discount" inputMode="decimal" defaultValue={d.discount} /></L>
          <L label="Validity (days)"><Input name="validity" inputMode="numeric" defaultValue={d.validity} /></L>
          <L label="Currency" hint="D-14: the rate of the day is fixed when sent"><Select name="currency" defaultValue={d.currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} /></L>
        </Row>
        <L label="Assumptions of the estimate"><Textarea name="assumptions" rows={4} defaultValue={d.assumptions ?? ''} /></L>
        <L label="Reservations"><Textarea name="reservations" rows={3} defaultValue={d.reservations ?? ''} /></L>
      </ActionForm>
    </Folded>
  );
}

export function ReviewForm({ dealRef, letter, level }: { dealRef: string; letter: string; level: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Decide the review" variant="primary" title={`${t('Review of offer')} ${letter} · ${t(level)}`}>
      <ActionForm action={A.reviewOfferAction} submit="Record the decision" done="Decision recorded">
        <Hidden name="ref" value={dealRef} />
        <Hidden name="letter" value={letter} />
        <L label="Decision"><Select name="decision" options={[{ value: 'go', label: t('Go') }, { value: 'no_go', label: t('No-go') }]} /></L>
        <L label="Risks and comment" hint="Required for a no-go"><Textarea name="comment" rows={4} /></L>
      </ActionForm>
    </Folded>
  );
}

export function SendOfferForm({ dealRef, letter, currency }: { dealRef: string; letter: string; currency: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Send the offer" variant="primary" title={`${t('Send offer')} ${letter}`}>
      <ActionForm action={A.sendOfferAction} submit="Send and freeze" done="Offer sent">
        <Hidden name="ref" value={dealRef} />
        <Hidden name="letter" value={letter} />
        <p className={s.hint}>{t('Once sent, the offer is frozen: lines, BOM, prices, lead time, assumptions and reservations. Its PDF is filed in Codex.')}</p>
        {currency !== 'EUR' && <L label={`Rate of the day (${currency} for 1 EUR)`}><Input name="rate" inputMode="decimal" required /></L>}
      </ActionForm>
    </Folded>
  );
}

export function OrderForm({ dealRef, letters, today }: { dealRef: string; letters: string[]; today: string }) {
  return (
    <Folded summary="Record the order" variant="primary">
      <ActionForm action={A.recordOrderAction} submit="Record the order" done="Order recorded">
        <Hidden name="ref" value={dealRef} />
        <L label="Offer retained"><Select name="letter" options={letters.map((l) => ({ value: l, label: l }))} /></L>
        <Row>
          <L label="Order date"><Input name="orderedOn" type="date" defaultValue={today} required /></L>
          <L label="Customer's order reference"><Input name="customerRef" required /></L>
        </Row>
        <L label="Keystone project" hint="Optional: Keystone creates it from the sold configuration"><Input name="project" /></L>
      </ActionForm>
    </Folded>
  );
}

// ── Sold configurations ──────────────────────────────────────────────────────────────────────────────────────────

export function AmendForm({ soldRef, lines }: { soldRef: string; lines: { number: number; label: string; current: Option[]; addable: Option[] }[] }) {
  return (
    <Folded summary="New amendment" variant="primary">
      <ActionForm action={A.amendAction} submit="Record the amendment" done="Amendment recorded">
        <Hidden name="ref" value={soldRef} />
        <L label="Line"><Select name="line" options={lines.map((l) => ({ value: String(l.number), label: l.label }))} /></L>
        {lines.map((l) => (
          <div key={l.number} className={s.group}>
            <strong>{l.label}</strong>
            {l.addable.length > 0 && <L label="Options to add"><Checks name="add" options={l.addable} /></L>}
            {l.current.length > 0 && <L label="Options to remove"><Checks name="remove" options={l.current} /></L>}
          </div>
        ))}
        <L label="Reason"><Textarea name="reason" rows={3} required /></L>
      </ActionForm>
    </Folded>
  );
}

export function LinkProjectForm({ soldRef }: { soldRef: string }) {
  return (
    <Folded summary="Link the Keystone project">
      <ActionForm action={A.linkProjectAction} submit="Link" done="Project linked">
        <Hidden name="ref" value={soldRef} />
        <L label="Keystone project"><Input name="project" placeholder="PRJ-DEMO-120" required /></L>
      </ActionForm>
    </Folded>
  );
}

export function FeedbackForm({ soldRef, options }: { soldRef: string; options: Option[] }) {
  const { t } = useI18n();
  return (
    <Folded summary="Record the project's return" title="Project return (stand-in for Keystone's view K-2)">
      <ActionForm action={A.recordFeedbackAction} submit="Record" done="Return recorded">
        <Hidden name="ref" value={soldRef} />
        <L label="Stage"><Select name="stage" options={[{ value: 'closure', label: t('Project closure') }, { value: 'warranty_end', label: t('End of warranty') }]} /></L>
        <Row>
          <L label="Material (k€)"><Input name="material" inputMode="decimal" required /></L>
          <L label="Subcontracting (k€)"><Input name="subcontracting" inputMode="decimal" required /></L>
          <L label="Expenses (k€)"><Input name="expenses" inputMode="decimal" required /></L>
        </Row>
        <Row>
          <L label="Engineering (k€)"><Input name="engineering" inputMode="decimal" required /></L>
          <L label="Workshop (k€)"><Input name="workshop" inputMode="decimal" required /></L>
          <L label="Site (k€)"><Input name="site" inputMode="decimal" required /></L>
        </Row>
        <Row>
          <L label="Engineering hours"><Input name="engineeringHours" inputMode="decimal" required /></L>
          <L label="Workshop hours"><Input name="workshopHours" inputMode="decimal" required /></L>
          <L label="Site hours"><Input name="siteHours" inputMode="decimal" required /></L>
        </Row>
        <L label="Options delivered"><Checks name="delivered" options={options} defaults={options.map((o) => o.value)} /></L>
        {options.map((o) => <L key={o.value} label={`${t('Real cost')} · ${o.label} (k€)`}><Input name={`actual_${o.value}`} inputMode="decimal" /></L>)}
        <Row>
          <L label="REX (matrix.pub_rex_v2)"><Input name="rexRef" placeholder="REX-DEMO-040" /></L>
          <Check name="major" label="Major difficulty" />
        </Row>
        <L label="REX summary"><Textarea name="rexSummary" rows={2} /></L>
      </ActionForm>
    </Folded>
  );
}

// ── Quotation requests ──────────────────────────────────────────────────────────────────────────────────────────

export function NewQuoteForm({ deals, machines, primary, deal }: { deals: Option[]; machines: Option[]; primary?: boolean; deal?: string }) {
  const o = useOpts();
  return (
    <Folded summary={deal ? 'Option outside the catalogue' : 'New request'} variant={primary ? 'primary' : 'secondary'} title="New quotation request">
      <ActionForm action={A.createQuoteAction} submit="Open the request" done="Request opened">
        {deal ? <Hidden name="deal" value={deal} /> : <L label="Deal"><Select name="deal" options={deals} /></L>}
        <L label="What is asked"><Input name="title" required /></L>
        <Row>
          <L label="Machine"><Select name="machine" options={machines} /></L>
          <L label="Category"><Select name="category" options={o(OPTION_CATEGORIES, OPTION_CATEGORY_LABEL)} /></L>
        </Row>
        <L label="Estimate class" hint="D-11: target answer time by class, adjustable"><Select name="cls" defaultValue="quote" options={o(ESTIMATE_CLASSES, ESTIMATE_CLASS_LABEL)} /></L>
      </ActionForm>
    </Folded>
  );
}

export interface AnswerField { id: string; text: string; theme: string; type: string; unit: string | null; choices: string | null; required: boolean; value: string }

export function AnswersForm({ quoteRef, fields, primary }: { quoteRef: string; fields: AnswerField[]; primary?: boolean }) {
  const { t } = useI18n();
  return (
    <Folded summary="Enter the answers" variant={primary ? 'primary' : 'secondary'}>
      <ActionForm action={A.saveAnswersAction} submit="Save the answers" done="Answers saved">
        <Hidden name="ref" value={quoteRef} />
        {fields.map((f) => (
          <L key={f.id} label={`${f.text}${f.required ? ' *' : ''}${f.unit ? ` (${f.unit})` : ''}`}>
            {f.type === 'choice' && f.choices ? (
              <Select name={`q_${f.id}`} defaultValue={f.value} options={[{ value: '', label: '—' }, ...f.choices.split('·').map((c) => ({ value: c.trim(), label: c.trim() }))]} />
            ) : f.type === 'yes_no' ? (
              <Select name={`q_${f.id}`} defaultValue={f.value} options={[{ value: '', label: '—' }, { value: 'oui', label: t('Yes') }, { value: 'non', label: t('No') }]} />
            ) : f.type === 'text' || f.type === 'attachment' ? (
              <Textarea name={`q_${f.id}`} rows={2} defaultValue={f.value} placeholder={f.type === 'attachment' ? t('Codex references') : undefined} />
            ) : (
              <Input name={`q_${f.id}`} inputMode="decimal" defaultValue={f.value} />
            )}
          </L>
        ))}
      </ActionForm>
    </Folded>
  );
}

export function QualifyForm({ quoteRef, primary }: { quoteRef: string; primary?: boolean }) {
  const o = useOpts();
  return (
    <Folded summary="Qualify" variant={primary ? 'primary' : 'secondary'} title="Qualification by engineering">
      <ActionForm action={A.qualifyQuoteAction} submit="Record the qualification" done="Request qualified">
        <Hidden name="ref" value={quoteRef} />
        <L label="Decision"><Select name="feasibility" options={o(FEASIBILITIES, FEASIBILITY_LABEL)} /></L>
        <L label="Know-how level proposed"><Select name="level" defaultValue="never" options={o(KNOWHOW_LEVELS, KNOWHOW_LEVEL_LABEL)} /></L>
        <L label="Reason / remark" hint="Required for a refusal"><Textarea name="note" rows={4} /></L>
      </ActionForm>
    </Folded>
  );
}

export interface EstimateDefaults { material: number; subcontracting: number; engineeringHours: number; workshopHours: number; siteHours: number; expenses: number; sale: number | null; weeks: number; validity: number; assumptions: string | null; deltas: string }

export function EstimateForm({ quoteRef, d, primary }: { quoteRef: string; d: EstimateDefaults; primary?: boolean }) {
  return (
    <Folded summary="Edit the estimate" variant={primary ? 'primary' : 'secondary'}>
      <ActionForm action={A.saveEstimateAction} submit="Save the estimate" done="Estimate saved">
        <Hidden name="ref" value={quoteRef} />
        <Row>
          <L label="Material (k€)"><Input name="material" inputMode="decimal" defaultValue={d.material} /></L>
          <L label="Subcontracting (k€)"><Input name="subcontracting" inputMode="decimal" defaultValue={d.subcontracting} /></L>
          <L label="Expenses (k€)"><Input name="expenses" inputMode="decimal" defaultValue={d.expenses} /></L>
        </Row>
        <Row>
          <L label="Engineering hours"><Input name="engineeringHours" inputMode="decimal" defaultValue={d.engineeringHours} /></L>
          <L label="Workshop hours"><Input name="workshopHours" inputMode="decimal" defaultValue={d.workshopHours} /></L>
          <L label="Site hours"><Input name="siteHours" inputMode="decimal" defaultValue={d.siteHours} /></L>
        </Row>
        <Row>
          <L label="Sale price (k€)"><Input name="sale" inputMode="decimal" defaultValue={d.sale ?? ''} required /></L>
          <L label="Extra lead time (weeks)"><Input name="weeks" inputMode="numeric" defaultValue={d.weeks} /></L>
          <L label="Validity (days)"><Input name="validity" inputMode="numeric" defaultValue={d.validity} /></L>
        </Row>
        <L label="BOM delta" hint="One line per article: ART-…; designation; quantity; unit"><Textarea name="deltas" rows={4} defaultValue={d.deltas} /></L>
        <L label="Assumptions"><Textarea name="assumptions" rows={3} defaultValue={d.assumptions ?? ''} /></L>
      </ActionForm>
    </Folded>
  );
}

export function AnswerQuoteButton({ quoteRef }: { quoteRef: string }) {
  return <ActionButton run={A.answerQuoteAction.bind(null, quoteRef)} label="Publish the answer" done="Answer published" variant="primary" />;
}

export function CancelQuoteForm({ quoteRef }: { quoteRef: string }) {
  return (
    <Folded summary="Cancel the request">
      <ActionForm action={A.cancelQuoteAction} submit="Cancel the request" done="Request cancelled" variant="secondary">
        <Hidden name="ref" value={quoteRef} />
        <L label="Reason"><Textarea name="reason" rows={3} required /></L>
      </ActionForm>
    </Folded>
  );
}

export function MessageForm({ quoteRef }: { quoteRef: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="New message">
      <ActionForm action={A.postMessageAction} submit="Send" done="Message added">
        <Hidden name="ref" value={quoteRef} />
        <L label="Message"><Textarea name="body" rows={4} required placeholder={t('Question back to the requester…')} /></L>
      </ActionForm>
    </Folded>
  );
}

// ── Know-how, questionnaires, settings ───────────────────────────────────────────────────────────────────────────

export function KnowhowNoteForm({ options, machines, primary }: { options: Option[]; machines: Option[]; primary?: boolean }) {
  const { t } = useI18n();
  return (
    <Folded summary="Add a note or a mark" variant={primary ? 'primary' : 'secondary'}>
      <ActionForm action={A.knowhowNoteAction} submit="Record" done="Recorded">
        <L label="Option"><Select name="option" options={options} /></L>
        <L label="Machine" hint="Empty: every machine"><Select name="machine" options={[{ value: '', label: t('Every machine') }, ...machines]} /></L>
        <L label="Kind"><Select name="kind" options={[{ value: 'note', label: t('Note') }, { value: 'avoid', label: t('Mark “to avoid”') }, { value: 'clear_avoid', label: t('Lift the “to avoid” mark') }]} /></L>
        <L label="Text or reason"><Textarea name="body" rows={4} required /></L>
      </ActionForm>
    </Folded>
  );
}

export function NewFamilyForm({ types }: { types: Option[] }) {
  const o = useOpts();
  return (
    <Folded summary="New family">
      <ActionForm action={A.draftQuestionnaireAction} submit="Create the draft" done="Draft created">
        <Row>
          <L label="Machine type"><Select name="type" options={types} /></L>
          <L label="Category"><Select name="category" options={o(OPTION_CATEGORIES, OPTION_CATEGORY_LABEL)} /></L>
        </Row>
        <L label="Label"><Input name="label" required placeholder="MEMU × automatisme" /></L>
      </ActionForm>
    </Folded>
  );
}

export function DraftQuestionnaireForm({ family }: { family: string }) {
  return (
    <Folded summary="New draft version">
      <ActionForm action={A.draftQuestionnaireAction} submit="Create the draft" done="Draft created">
        <Hidden name="family" value={family} />
      </ActionForm>
    </Folded>
  );
}

export function QuestionForm({ questionnaireId }: { questionnaireId: string }) {
  const o = useOpts();
  return (
    <Folded summary="Add a question">
      <ActionForm action={A.addQuestionAction} submit="Add" done="Question added">
        <Hidden name="questionnaire" value={questionnaireId} />
        <L label="Theme"><Select name="theme" options={o(QUESTION_THEMES, QUESTION_THEME_LABEL)} /></L>
        <L label="Question"><Input name="text" required /></L>
        <Row>
          <L label="Answer type"><Select name="type" options={o(ANSWER_TYPES, ANSWER_TYPE_LABEL)} /></L>
          <L label="Unit"><Input name="unit" /></L>
        </Row>
        <L label="Choices" hint="Separated by ·"><Input name="choices" /></L>
        <Check name="required" label="Required" />
      </ActionForm>
    </Folded>
  );
}

export function ToggleRequiredButton({ id, required }: { id: string; required: boolean }) {
  return <ActionButton run={A.toggleRequiredAction.bind(null, id)} label={required ? 'Make optional' : 'Make required'} done="Question updated" variant="ghost" />;
}

export function RemoveQuestionButton({ id }: { id: string }) {
  return <ActionButton run={A.removeQuestionAction.bind(null, id)} label="Remove" done="Question removed" variant="ghost" />;
}

export function PublishQuestionnaireButton({ id }: { id: string }) {
  return <ActionButton run={A.publishQuestionnaireAction.bind(null, id)} label="Publish the draft" done="Questionnaire published" variant="primary" />;
}

export function SettingsForm({ d }: { d: Settings }) {
  return (
    <Folded summary="Edit the settings" variant="primary">
      <ActionForm action={A.saveSettingsAction} submit="Save" done="Settings saved">
        <Row>
          <L label="Target · indicative (working days)"><Input name="t_indicative" inputMode="numeric" defaultValue={d.targetDays.indicative} /></L>
          <L label="Target · quote"><Input name="t_quote" inputMode="numeric" defaultValue={d.targetDays.quote} /></L>
          <L label="Target · firm offer"><Input name="t_firm" inputMode="numeric" defaultValue={d.targetDays.firm} /></L>
        </Row>
        <Row>
          <L label="Reminder · indicative"><Input name="r_indicative" inputMode="numeric" defaultValue={d.reminderDays.indicative} /></L>
          <L label="Reminder · quote"><Input name="r_quote" inputMode="numeric" defaultValue={d.reminderDays.quote} /></L>
          <L label="Reminder · firm offer"><Input name="r_firm" inputMode="numeric" defaultValue={d.reminderDays.firm} /></L>
        </Row>
        <Row>
          <L label="Review beyond (k€)"><Input name="reviewAboveKeur" inputMode="decimal" defaultValue={d.reviewAboveKeur} /></L>
          <L label="Minimum margin (%)"><Input name="minMarginPct" inputMode="decimal" defaultValue={d.minMarginPct} /></L>
          <L label="General management beyond a discount of (%)"><Input name="discountGeneralPct" inputMode="decimal" defaultValue={d.discountGeneralPct} /></L>
        </Row>
        <Row>
          <L label="Alert before the end of a price list (days)"><Input name="priceListAlertDays" inputMode="numeric" defaultValue={d.priceListAlertDays} /></L>
          <L label="Offer validity (days)"><Input name="offerValidityDays" inputMode="numeric" defaultValue={d.offerValidityDays} /></L>
          <L label="Answer validity (days)"><Input name="quoteValidityDays" inputMode="numeric" defaultValue={d.quoteValidityDays} /></L>
        </Row>
        <Row>
          <L label="“Mastered”: deliveries at least"><Input name="masteredDeliveries" inputMode="numeric" defaultValue={d.masteredDeliveries} /></L>
          <L label="“Mastered”: gap at most (%)"><Input name="masteredGapPct" inputMode="decimal" defaultValue={d.masteredGapPct} /></L>
          <L label="“To avoid”: gap beyond (%)"><Input name="avoidGapPct" inputMode="decimal" defaultValue={d.avoidGapPct} /></L>
        </Row>
        <Row>
          <L label="Propose for the catalogue after (sales)"><Input name="proposeAfterSales" inputMode="numeric" defaultValue={d.proposeAfterSales} /></L>
          <L label="Flag an option unsold for (months)"><Input name="unsoldMonths" inputMode="numeric" defaultValue={d.unsoldMonths} /></L>
        </Row>
        <Row>
          <L label="Engineering rate (€/h)"><Input name="rate_engineering_hours" inputMode="decimal" defaultValue={d.rates.engineering_hours} /></L>
          <L label="Workshop rate (€/h)"><Input name="rate_workshop_hours" inputMode="decimal" defaultValue={d.rates.workshop_hours} /></L>
          <L label="Site rate (€/h)"><Input name="rate_site_hours" inputMode="decimal" defaultValue={d.rates.site_hours} /></L>
        </Row>
      </ActionForm>
    </Folded>
  );
}

export function ResetSettingsButton() {
  return <ActionButton run={A.resetSettingsAction} label="Default values" done="Default values restored" />;
}

/** The configurator's choice saved to a deal: a new line, or the line being configured. */
export function SaveConfigurationForm({ machine, quantity, options, deals, dealRef, line }: { machine: string; quantity: number; options: string[]; deals: Option[]; dealRef?: string; line?: number }) {
  return (
    <Folded summary={dealRef ? (line ? 'Save to the line' : 'Add to the deal') : 'Add to a deal'} variant="primary">
      <ActionForm action={A.saveLineAction} submit={line ? 'Save the line' : 'Add the line'} done="Configuration saved">
        <Hidden name="machine" value={machine} />
        <Hidden name="quantity" value={quantity} />
        {options.map((o) => <Hidden key={o} name="options" value={o} />)}
        {line && <Hidden name="line" value={line} />}
        {dealRef ? <Hidden name="ref" value={dealRef} /> : <L label="Deal"><Select name="ref" options={deals} /></L>}
      </ActionForm>
    </Folded>
  );
}
