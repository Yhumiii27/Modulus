@norma/REGLES.md

Les règles ci-dessus sont celles de toute la suite (copie versionnée de `Yhumiii27/Norma`, `norma/VERSION`) : elles se
changent dans Norma, jamais ici. Ce qui suit est propre à Modulus.

# Modulus — instructions for Claude sessions

Modulus is the group's tool for the **sales and estimating department**: the standard machine catalogue (versions,
options, compatibility rules), the ready-made BOM of each standard machine and option, the prices (cost budget for
Keystone, sale price for Arche and the customers), the deals and their offers, the **configuration sold** in each project
(frozen at the order) and the options developed for it, and the **know-how map** built from all of this (what we know how
to do, have done once, have only quoted, never did, or should avoid).

## Where the project stands

- **Delivery 0 (framing) is in progress** (24 Nov 2026, owner's request): `docs/spec/00`–`06`, `docs/DECISIONS.md`
  (questions with a default answer), `docs/PLAN.md`, `docs/DEMANDES.md` (requests to Clavis, Matrix, Keystone, Arche).
  Nothing is built until the owner has read the framing and answered or accepted the defaults.
- **Owner's answers**: questionnaire "Décisions Modulus", https://claude.ai/artifact/DW6ZKnFFgCdUBvD5G5946t — read its
  database (ArtifactData, collection `answers`, one document per question id: `choice` = default | altN | other | discuss,
  `note`) before each delivery and apply the answers to `docs/DECISIONS.md`; keep `scripts/questionnaire/questions.json` in
  step and rebuild the page with `node norma/outils/questionnaire/build.mjs` (Norma's standard questionnaire, settings in `scripts/questionnaire/config.json`).
- The machine catalogue and machine standards now live in Keystone (`machine_catalogue_entries`, `machine_types` and
  related tables, view `keystone.pub_catalogue_machines`, contract K-01; answers to CAPEX machine needs `need_answers`,
  contract K-02). They move to Modulus (owner, 24 Nov 2026) through the transition of `docs/spec/05-echanges.md` § 4.

## Rules specific to Modulus

- **Two prices, never mixed.** The cost budget (internal) and the sale price are separate columns, separate rights and
  separate publications: Arche and any subsidiary-facing view never read a cost or a margin.
- **What was sold is frozen.** An offer version, once sent, and a configuration sold, once ordered, are immutable (database
  trigger); a change is a new version (amendment), traced.
- **Computed, never copied.** The BOM of a configuration, its prices and the know-how levels are computed from the
  catalogue, the BOM templates, the price lists and the project feedback; they are frozen only into an offer or a sale.
- Platform: copied from Clavis / Crucible as adapted (record the origin commit in `docs/SOCLE.md`); charte from
  `norma/charte` (import `@norma/charte/...`), never a local copy.
- Ports on the owner's Mac: **3800** (Modulus) and **3810** (tests).
- Commit messages in English.
