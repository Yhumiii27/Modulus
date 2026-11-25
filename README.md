# Modulus

Outil du service commercial et chiffrage de la suite EPC2I : catalogue des machines standard et de leurs options, BOM
préfaites, prix (budget et vente), affaires et offres, configurations vendues, cotation des options hors catalogue,
carte du savoir-faire.

État : **bêta** (livraison 1, `docs/DELIVERY-1.md`), sur un jeu de démonstration fictif. Lire `docs/spec/00-vue-ensemble.md`,
puis `docs/DECISIONS.md` et `docs/PLAN.md`. Règles communes de la suite : `norma/REGLES.md` (copie de Norma, contrôlée par
`npm run norma:check`).

```bash
npm ci && npm run db:local && npm run db:migrate   # .env.local : voir .env.example (PostgreSQL seul)
npx next typegen && npm run typecheck && npm run lint && npm test
npm run dev                                         # http://localhost:3800 (démonstration : « Voir en tant que »)
```

Déploiement : `deploy/README.md`.
