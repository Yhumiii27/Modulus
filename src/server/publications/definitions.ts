// Modulus's publications (docs/spec/05 § 1). Matrix defines and applies the `pub_` views (decision M-18): these are the reference
// queries given to Matrix (request M-2), executed as they are by ./definitions.test.ts. A column is never removed or renamed;
// a new one goes at the end; an incompatible change is a `_v2`. Two prices never mixed (CLAUDE.md): the views read by Arche
// never carry a budget or a margin; the budgets go to Keystone only (pub_budgets_configurations).

/** The published price list in force today (the latest start when two overlap). */
const LIST_IN_FORCE = `(SELECT pl.id FROM modulus.price_lists pl WHERE pl.state = 'published' AND pl.valid_from <= current_date AND pl.valid_to >= current_date
   ORDER BY pl.valid_from DESC LIMIT 1)`;

/**
 * modulus.pub_catalogue_machines — contract K-01 of keystone.pub_catalogue_machines kept column for column (Arche switches its
 * reading to Modulus, transition docs/spec/05 § 4): one row per machine and version, published and retired (never a draft),
 * the indicative sale price of the list in force. No budget, no margin.
 */
export const PUB_CATALOGUE_MACHINES = `SELECT m.code,
       v.version,
       m.type_code                                         AS type_code,
       t.label                                             AS type_libelle,
       v.variant                                           AS variante,
       v.label                                             AS libelle,
       v.description,
       coalesce((SELECT jsonb_agg(jsonb_build_object('code', o.code, 'libelle', o.label, 'prix_indicatif_keur',
                  (SELECT i.sale_keur FROM modulus.price_list_items i WHERE i.option_id = o.id AND i.price_list_id = ${LIST_IN_FORCE})) ORDER BY o.code)
                 FROM modulus.option_machines om JOIN modulus.options o ON o.id = om.option_id
                 WHERE om.machine_id = m.id AND o.origin = 'catalogue' AND o.active), '[]'::jsonb) AS options,
       v.nominal_capacity                                  AS capacite_nominale,
       v.capacity_unit                                     AS unite_capacite,
       (SELECT i.sale_keur FROM modulus.price_list_items i WHERE i.machine_id = m.id AND i.price_list_id = ${LIST_IN_FORCE}) AS prix_indicatif_keur,
       v.lead_weeks                                        AS delai_type_semaines,
       CASE v.state WHEN 'published' THEN 'publie' ELSE 'retire' END AS statut,
       greatest(v.updated_at, m.updated_at)                AS maj_le
FROM modulus.machine_versions v
JOIN modulus.machines m ON m.id = v.machine_id
JOIN modulus.machine_types t ON t.code = m.type_code
WHERE v.state IN ('published', 'retired')`;

/** modulus.pub_catalogue_options — catalogue options per machine, their rules, indicative sale price and extra lead time. No budget. */
export const PUB_CATALOGUE_OPTIONS = `SELECT o.code                                    AS option_code,
       o.label                                             AS libelle,
       o.category                                          AS categorie,
       m.code                                              AS machine_code,
       (SELECT i.sale_keur FROM modulus.price_list_items i WHERE i.option_id = o.id AND i.price_list_id = ${LIST_IN_FORCE}) AS prix_indicatif_keur,
       o.extra_weeks                                       AS delai_additionnel_semaines,
       coalesce((SELECT jsonb_agg(jsonb_build_object('regle', r.kind, 'cible', tg.code, 'condition',
                  CASE WHEN r.kind = 'mandatory_if' THEN r.condition_key || ' ' || r.condition_op || ' ' || r.condition_value END, 'explication', r.explanation) ORDER BY r.kind, tg.code)
                 FROM modulus.option_rules r LEFT JOIN modulus.options tg ON tg.id = r.target_option_id WHERE r.option_id = o.id), '[]'::jsonb) AS regles,
       o.updated_at                                        AS maj_le
FROM modulus.options o
JOIN modulus.option_machines om ON om.option_id = o.id
JOIN modulus.machines m ON m.id = om.machine_id
WHERE o.origin = 'catalogue' AND o.active`;

/**
 * modulus.pub_cotations — the quotation requests of a CAPEX machine need (Arche, contract K-02 taken over) and their answer:
 * qualification, sale price, extra lead time, validity. No budget.
 */
export const PUB_COTATIONS = `SELECT q.ref                                     AS demande_ref,
       q.capex_need                                        AS besoin_ref,
       q.title                                             AS titre,
       m.code                                              AS machine_code,
       q.category                                          AS categorie,
       q.estimate_class                                    AS classe_estimation,
       q.received_on                                       AS recue_le,
       q.target_days                                       AS delai_cible_jours_ouvres,
       q.state                                             AS statut,
       q.feasibility                                       AS faisabilite,
       CASE WHEN q.state = 'answered' THEN e.sale_keur END AS prix_vente_keur,
       CASE WHEN q.state = 'answered' THEN e.extra_weeks END AS delai_additionnel_semaines,
       CASE WHEN q.state = 'answered' THEN e.validity_days END AS validite_jours,
       q.answered_on                                       AS repondue_le,
       (SELECT o.code FROM modulus.options o WHERE o.quote_request_id = q.id) AS option_code,
       q.updated_at                                        AS maj_le
FROM modulus.quote_requests q
JOIN modulus.machines m ON m.id = q.machine_id
LEFT JOIN modulus.quote_estimates e ON e.request_id = q.id
WHERE q.capex_need IS NOT NULL`;

/** modulus.pub_budgets_configurations — for keystone_app only: budget per line and the BOM frozen of each sold configuration version. */
export const PUB_BUDGETS_CONFIGURATIONS = `SELECT c.ref                                AS configuration_ref,
       c.version,
       (l.value ->> 'number')::int                         AS ligne,
       l.value ->> 'machine'                               AS machine_code,
       (l.value ->> 'version')::int                        AS version_machine,
       (l.value ->> 'quantity')::int                       AS quantite,
       (l.value ->> 'unitBudgetKeur')::numeric             AS budget_unitaire_keur,
       (l.value ->> 'unitSaleKeur')::numeric               AS prix_unitaire_keur,
       l.value -> 'bom'                                    AS bom,
       c.total_budget_keur                                 AS budget_total_keur,
       c.created_at                                        AS maj_le
FROM modulus.sold_configurations c
CROSS JOIN LATERAL jsonb_array_elements(c.content -> 'lines') l`;

/**
 * modulus.pub_configurations_vendues — Keystone creates the project from it; Arche reads "ordered" (G2 Go of the CAPEX). One row
 * per version; the lines without budget.
 */
export const PUB_CONFIGURATIONS_VENDUES = `SELECT c.ref                                AS configuration_ref,
       c.version,
       c.version = (SELECT max(x.version) FROM modulus.sold_configurations x WHERE x.ref = c.ref) AS en_vigueur,
       d.ref                                               AS affaire_ref,
       d.sale_case                                         AS cas_vente,
       cu.name                                             AS client,
       d.capex_need                                        AS besoin_ref,
       c.ordered_on                                        AS commandee_le,
       c.customer_order_ref                                AS ref_commande_client,
       c.keystone_project                                  AS projet_code,
       c.total_sale_keur                                   AS prix_vente_keur,
       c.lead_weeks                                        AS delai_semaines,
       (SELECT jsonb_agg(jsonb_build_object('ligne', l.value -> 'number', 'machine', l.value -> 'machine', 'version', l.value -> 'version', 'quantite', l.value -> 'quantity',
                 'options', (SELECT jsonb_agg(op.value -> 'code') FROM jsonb_array_elements(l.value -> 'options') op)))
          FROM jsonb_array_elements(c.content -> 'lines') l) AS lignes,
       c.amendment_reason                                  AS motif_avenant,
       c.created_at                                        AS maj_le
FROM modulus.sold_configurations c
JOIN modulus.deals d ON d.id = c.deal_id
JOIN modulus.customers cu ON cu.id = d.customer_id`;

export const PUBLICATIONS = {
  pub_catalogue_machines: PUB_CATALOGUE_MACHINES, pub_catalogue_options: PUB_CATALOGUE_OPTIONS, pub_cotations: PUB_COTATIONS,
  pub_budgets_configurations: PUB_BUDGETS_CONFIGURATIONS, pub_configurations_vendues: PUB_CONFIGURATIONS_VENDUES,
} as const;

/** Columns of the K-01 contract (keystone.pub_catalogue_machines), in order: modulus.pub_catalogue_machines starts with them. */
export const K01_COLUMNS = [
  'code', 'version', 'type_code', 'type_libelle', 'variante', 'libelle', 'description', 'options', 'capacite_nominale', 'unite_capacite', 'prix_indicatif_keur',
  'delai_type_semaines', 'statut', 'maj_le',
] as const;
