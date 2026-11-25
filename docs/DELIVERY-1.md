# Livraison 1 — de la maquette à la bêta (25 novembre 2026)

Demande du propriétaire (25 nov. 2026) : « Modulus a une barre en haut de la page disant que c'est une maquette : fais en sorte que
l'on fasse le nécessaire pour passer du stade de maquette au stade de beta. » Construite sur les réponses du questionnaire
(`docs/DECISIONS.md` § 2, relues le 25 nov. : D-1 à D-15, U-1, U-2) et sur les réponses par défaut des questions restées sans
réponse (D-16, D-17), comme Arche et Vector. Jeu de démonstration **entièrement fictif**. Branche `claude/quirky-brown-c7af5m`.

La maquette validée (`maquette/index.html`) reste dans le dépôt comme référence ; elle n'est plus servie. L'application n'a plus de
bandeau « maquette » : une marque « Bêta » discrète au pied de la barre latérale (`Tag` de la charte, jetons seulement).

## 1. Ce qui est construit

| Domaine | Où | Contenu |
| --- | --- | --- |
| Socle | `docs/SOCLE.md` | plateforme de Vector (elle-même de Clavis `main`), PostgreSQL seul, schéma `modulus`, rôle `modulus_app` ; connexion par Clavis et droits lus dans `clavis.pub_acces` (`MODULUS_ACCESS_FROM_CLAVIS=on`), « Voir en tant que » en démonstration (8 profils fictifs) ; journal d'audit en ajout seul ; configuration validée au démarrage ; i18n (anglais source, français par défaut, test de complétude) ; coque commune de Norma 2.1 ; CI |
| Schéma | `src/server/db/schema/catalogue.ts`, `commerce.ts`, `drizzle/0000`, `0001` | 38 tables, **134 contraintes CHECK** (codes `EMP-200`, `OPT-AUT-01`, `SPE-…`, `ART-…`, `AF-`/`DC-`/`CV-AAAA-NNNN`, `CPX-…/B01`, `GRILLE-AAAA`, pays ISO ; domaines d'états ; cohérences : cas 2 ⇔ filiale intermédiaire, cas 1 ⇔ besoin d'Arche, perdue/abandonnée ⇔ motif, offre envoyée ⇔ contenu figé, refus ⇔ motif, une version publiée par machine…) |
| Ce qui ne change plus | `drizzle/0001_frozen_and_append_only.sql` (test `src/server/db/frozen.test.ts`) | déclencheurs : version de machine publiée figée (seul publiée → retirée), BOM et caractéristiques modifiables sur un brouillon seulement, grille publiée figée et ses prix, **offre envoyée figée** (seul l'état et la référence Codex une fois), **configuration vendue immuable** (seul le projet Keystone, une fois), questionnaire publié figé ; journal d'audit, revues d'offre, fil des cotations et notes de savoir-faire en ajout seul |
| Règles pures | `src/domain/` (test `modulus.test.ts`) | configurateur (`configurator.ts` : obligatoire si, impose, exclut, une parmi ; règle citée), BOM calculée par deltas (`bom.ts`), budget saisi et calculé par poste avec l'écart, grille en vigueur, marge (`pricing.ts`, D-7, D-14), offre figée (`offer.ts`), revue d'offre (`review.ts`, D-8, D-4), niveaux de savoir-faire, propositions d'entrée au catalogue, options non vendues (`knowhow.ts`, D-12), jours ouvrés, échéance, retard, réponses manquantes, cas proches (`quotes.ts`, `working-days.ts`, D-11), pipeline pondéré et taux de transformation (`deals.ts`, D-2), délais et seuils réglables (`settings.ts`, D-11, D-12), droits (`rights.ts`, U-1, U-2, D-4, D-15) |
| Calculs | `src/server/commerce/world.ts` | tout est lu en un nombre fixe de requêtes puis **calculé à chaque lecture** : prix de vente de la grille en vigueur, budgets, BOM d'une configuration, niveaux de savoir-faire (par machine × option), montant d'une affaire ; rien n'est copié, sauf dans une offre envoyée ou une configuration vendue |
| Écritures | `src/features/commerce/actions.ts` (test `actions.test.ts`) | 42 Server Functions : catalogue (machine, version brouillon copiée, fiche, publication qui retire la précédente, BOM, options, règles, deltas), budgets et grilles (proposition, prix, validation par la direction commerciale, confirmation de la direction générale au-delà du seuil de remise), affaires (ouverture par cas de vente, prospect créé dans Modulus, équipe, lignes passées au configurateur, perte et abandon motivés), offres (brouillon, revue go / no-go, envoi qui fige, commande), configurations vendues (avenant, projet Keystone, retour du projet), cotations (ouverture, réponses, qualification refusée tant qu'il manque une réponse obligatoire, chiffrage, réponse qui crée l'option spécifique et l'ajoute à la ligne, annulation, fil), savoir-faire (note, « à éviter » motivé et sa levée), questionnaires (famille, brouillon, questions, publication), délais et seuils. Chacune valide ses entrées et le droit côté serveur, relit l'objet dans sa transaction et écrit son audit dans la même transaction |
| Écrans | `src/app/(app)/` | tous ceux de la maquette : Accueil, Affaires (+ fiche : lignes, offres, revue d'offre, journal), Configurateur, Demandes de cotation (+ fiche : questionnaire, qualification et cas proches, chiffrage, réponse et fil), Configurations vendues (+ fiche : versions, avenant, retour du projet), Machines standard (machines, options, grilles ; fiche : vue d'ensemble et versions, options, règles, BOM préfaite et deltas, budget, prix de vente), Carte du savoir-faire (+ preuves d'une case), Questionnaires types, Délais et seuils, Journal ; impressions `/print/offers/<affaire>/<lettre>` (l'offre en PDF par le navigateur, D-13) et `/print/questionnaire` (questionnaire pour un client sans accès, D-17) ; exports CSV `/export/deals`, `/export/knowhow` |
| Publications | `src/server/publications/definitions.ts` (testées) | requêtes de référence à donner à Matrix (M-2) : `modulus.pub_catalogue_machines` (contrat K-01 colonne pour colonne), `pub_catalogue_options`, `pub_cotations` (demandes d'Arche et réponses), `pub_configurations_vendues` — **jamais de budget ni de marge** — et `pub_budgets_configurations` (Keystone seulement). Aucune migration ne crée de vue `pub_` |
| Déploiement | `Dockerfile`, `deploy/start.sh`, `deploy/compose.shared.yaml`, `deploy/README.md` | un conteneur Coolify « Dockerfile » (`MODULUS_SINGLE_CONTAINER=on` : migration, worker, serveur sur 3800), `HEALTHCHECK` sur `/api/health` ; variante Compose sur le serveur commun |

### Les règles qui tiennent

- **Deux prix jamais mêlés** : budget (`cost_budgets`, `quote_estimates`) et prix de vente (`price_list_items`) dans des tables, des
  droits (`see_costs` : chiffreurs, direction commerciale, direction de portefeuille, direction générale — D-15) et des publications
  distincts ; l'écran masque le budget et la marge aux autres profils ; l'offre imprimée n'a jamais de budget.
- **Ce qui est vendu est figé** par déclencheur (ci-dessus) ; un avenant est une nouvelle version, motivée, tracée.
- **Calculé, jamais copié** : BOM, budgets calculés, prix, marges, niveaux de savoir-faire, échéances, indicateurs.
- **U-2** : la liste des affaires est visible de tous ; la fiche et les prix, de l'équipe de l'affaire et des directions (404 sinon).

## 2. Réponses du questionnaire appliquées

| Id | Application |
| --- | --- |
| D-1 | cotations et réponses aux besoins des CAPEX dans Modulus (`quote_requests`, `pub_cotations`) |
| D-2 | pipeline simple : état, probabilité, montant pondéré, motifs de perte |
| D-3 | cas de vente 1 / 2 / 3 portés par l'affaire, filiale intermédiaire du cas 2, besoin d'Arche du cas 1 (contraintes en base) |
| D-4 | grilles validées par la direction commerciale ; remise au-delà de 10 % (réglable) : la direction générale valide aussi (grille et revue d'offre) |
| D-5 | articles des BOM par leur code Keystone (`ART-…`) ; lecture de `keystone.pub_articles` à brancher (M-1) |
| D-6 | caractéristiques de départ par type (encombrement, puissance, air, eau), ajoutables par type (`characteristic_defs`) |
| D-7 | budget saisi par poste **et** calculé (BOM × derniers prix d'achat + heures × taux réglables), écart montré ; prix d'achat simulés jusqu'à la vue K-1 |
| D-8 | revue obligatoire au-delà de 150 k€ (réglable) ou avec une option « jamais fait » / « à éviter » ; l'envoi est refusé sans le go |
| D-9 | retour du projet à la clôture puis à la fin de garantie (`project_feedback.stage`) |
| D-10 | tronc commun + questionnaires par type × catégorie, versionnés, modifiables par l'ingénierie sans développement |
| D-11 | 5 / 15 / 30 jours ouvrés, **réglables** dans « Délais et seuils » ; le délai est figé dans la demande à sa réception |
| D-12 | seuils de la spec 04 § 2, **réglables** ; entrée au catalogue proposée après 2 ventes |
| D-13 | pas de portail client : offre imprimable (PDF par le navigateur), dépôt dans Codex par la file d'envoi (simulée) |
| D-14 | grilles en euros ; une autre devise au cours du jour, figé dans l'offre à l'envoi |
| D-15 | budget et marge : chiffreurs, direction commerciale, direction de portefeuille, direction générale |
| U-1 | rôles commercial, chiffreur, ingénierie, direction commerciale, lecture, administrateur — plus **direction générale** et **direction de portefeuille**, que D-4 et D-15 nomment (clés `Modulus.SalesDirector`… dans Clavis, demande C-1 mise à jour) |
| U-2 | affaire visible de son équipe et des directions ; les autres voient la liste sans les prix |
| D-16 (par défaut) | les clients se lisent dans Keystone (simulés : `customers.source = keystone`) ; un prospect se crée dans Modulus |
| D-17 (par défaut) | le commercial saisit l'affaire et les réponses ; Modulus imprime le questionnaire pour le client |

## 3. Ce qui est simulé ou attend un autre outil

| Sujet | Aujourd'hui | Passe en vrai quand |
| --- | --- | --- |
| Rôles Modulus dans Clavis | « Voir en tant que » (démonstration) | C-1 (rôles dans Clavis) et M-1 (lien de lecture `clavis.pub_acces`) |
| Clients, articles, prix d'achat de Keystone | tables de Modulus remplies par le jeu de démonstration | M-1 (liens de lecture), K-1 (vue des prix d'achat) |
| Coût réel et REX des projets | saisis par la direction de portefeuille (« Enregistrer le retour du projet ») ; démo marquée « Keystone (simulation) » | K-2 (vue du coût réel) |
| Dépôt des offres dans Codex | file `outbox`, la tâche `outbox` rend une référence `OFR-SIM-…` | connecteur Codex (`POST /api/documents`) |
| Demandes de cotation d'Arche | lignes du jeu de démonstration (origine `arche`) | `POST /api/v1/quote-requests` (livraison 4) et A-2 |
| Publications | requêtes de référence testées | M-2 (Matrix les définit et les applique) |
| Reprise du catalogue de Keystone | catalogue du jeu de démonstration | import journalisé de `keystone.pub_catalogue_machines` (livraison 2, transition spec 05 § 4) |

## 4. Vérifications

`npx next typegen && npm run typecheck && npm run lint && npm test` (28 fichiers, 146 tests, PostgreSQL : une base neuve par
fichier, laissée en place), `npm run norma:check`, `npm run build`, test de fumée `npm run test:smoke` (55 contrôles : chaque
écran, chaque onglet, les droits du commercial, du chiffreur et du lecteur, l'impression, les exports, la coque commune) sur
`next start --port 3810`. La CI rejoue tout cela et construit l'image.

## 5. Limites connues

- Pas d'API `/api/v1/quote-requests` pour Arche (livraison 4) ni de génération serveur du PDF (le navigateur enregistre la page).
- Jours ouvrés sans jours fériés (calendrier par pays à donner).
- Pas de modification d'une option ou d'une règle existante (ajout seulement) ; pas de retrait d'une option du catalogue.
- Les niveaux de savoir-faire se calculent par machine × option ; les caractéristiques ne sont pas encore des colonnes de la carte.
- Pas encore de parcours Playwright ni de contrôle d'accessibilité automatisé.
