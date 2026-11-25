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

- **Delivery 0 (framing) is done** (24 Nov 2026): `docs/spec/00`–`06`, `docs/DECISIONS.md`, `docs/PLAN.md`, `docs/DEMANDES.md`
  (requests to Clavis, Matrix, Keystone, Arche — drafts until the owner's « validé »), `docs/DONNEES.md`.
- **Delivery 1 (platform and beta) is built** (25 Nov 2026, owner: « passer du stade de maquette au stade de beta »;
  `docs/DELIVERY-1.md`, `docs/SOCLE.md`): platform from Vector (itself Clavis `main`), PostgreSQL only, schema `modulus`
  (`src/server/db/schema/catalogue.ts`, `commerce.ts`; every column constrained); triggers of `drizzle/0001` keep a published
  machine version, a published price list, a **sent offer** and a **sold configuration** frozen and the journals append-only;
  pure rules in `src/domain/` (`configurator.ts`, `bom.ts`, `pricing.ts`, `offer.ts`, `review.ts`, `knowhow.ts`, `quotes.ts`,
  `working-days.ts`, `deals.ts`, `settings.ts`, `rights.ts`); everything computed on read by `src/server/commerce/world.ts`
  (`loadModulus`; pages through `src/server/dal/world.ts`), shared writes `src/server/commerce/core.ts` (send an offer, order,
  amendment — also used by the demo seed); Server Functions `src/features/commerce/actions.ts`, side-panel forms `forms.tsx`;
  every screen of the mockup in `src/app/(app)/`; reference queries of the publications `src/server/publications/definitions.ts`
  (no `pub_` view in a migration); demo data set `MODULUS_SEED=demo` (`src/server/db/seed/demo.ts`, fictitious only).
  The mockup `maquette/index.html` stays as the validated reference, no longer served; the app shows a discreet « Bêta » mark.
- **Deployment** (`deploy/README.md`): one Coolify « Dockerfile » container behind Coolify's basic auth, `deploy/start.sh` with
  `MODULUS_SINGLE_CONTAINER=on` (migration, worker, server on 3800), `HEALTHCHECK` on `/api/health`; shared server: database
  `epc2i`, schema `modulus`, role `modulus_app` (still NOLOGIN until its password is set), host `epc2i-postgres`;
  `deploy/compose.shared.yaml` for the direct install.
- Roles (`src/config/roles.ts`, U-1 + D-4 + D-15): sales, estimator, engineering, sales_director, general_management,
  portfolio_management, reader, admin — Clavis keys `Modulus.SalesDirector`… (request C-1). Budget and margin: `canSeeCosts`
  (D-15); a deal's sheet and prices: its team and the directions (`dealAccess`, U-2).
- Tests never drop a database (`src/test/db.ts` leaves its uniquely named database); never run `DROP DATABASE`.
- **Owner's answers**: questionnaire "Décisions Modulus", https://claude.ai/artifact/DW6ZKnFFgCdUBvD5G5946t — read its
  database (ArtifactData, collection `answers`, one document per question id: `choice` = default | altN | other | discuss,
  `note`) before each delivery and apply the answers to `docs/DECISIONS.md`; keep `scripts/questionnaire/questions.json` in
  step and rebuild the page with `node norma/outils/questionnaire/build.mjs` (Norma's standard questionnaire, settings in `scripts/questionnaire/config.json`).
- The machine catalogue and machine standards now live in Keystone (`machine_catalogue_entries`, `machine_types` and
  related tables, view `keystone.pub_catalogue_machines`, contract K-01; answers to CAPEX machine needs `need_answers`,
  contract K-02). They move to Modulus (owner, 24 Nov 2026) through the transition of `docs/spec/05-echanges.md` § 4.

## Rules specific to Modulus

- Next.js 16 (read `node_modules/next/dist/docs/` before writing code), Drizzle, PostgreSQL only, Vitest. Checks:
  `npx next typegen && npm run typecheck && npm run lint && npm test && npm run norma:check`, `npm run build`, `npm run test:smoke`.
- **Two prices, never mixed.** The cost budget (internal) and the sale price are separate columns, separate rights and
  separate publications: Arche and any subsidiary-facing view never read a cost or a margin.
- **What was sold is frozen.** An offer version, once sent, and a configuration sold, once ordered, are immutable (database
  trigger); a change is a new version (amendment), traced.
- **Computed, never copied.** The BOM of a configuration, its prices and the know-how levels are computed from the
  catalogue, the BOM templates, the price lists and the project feedback; they are frozen only into an offer or a sale.
- Platform: copied from Clavis / Crucible as adapted (record the origin commit in `docs/SOCLE.md`); charte from
  `norma/charte` (import `@norma/charte/...`), never a local copy.
- **Logo, Norma 2.3.0** (owner, 25 Nov 2026; `norma/charte/COQUE.md` § 8 bis): the brand of the sidebar and of the top bar is the
  charter's `ToolLogo code="modulus"` (`@norma/charte/ds/ToolLogo`, 26 px, 20 px in the top bar), also on the pages outside the shell
  (sign-in…); the favicon is `src/app/icon.svg`, a copy of `norma/charte/logos/modulus.svg` (checked by `src/app/icon.test.ts`).
- Ports on the owner's Mac: **3800** (Modulus) and **3810** (tests).
- Commit messages in English.
