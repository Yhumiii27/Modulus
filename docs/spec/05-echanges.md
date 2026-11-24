# 05 — Échanges avec les autres outils

Règles : `norma/REGLES.md` § 5 (lecture par vues `pub_` définies par Matrix, écriture par API ou fonction `pub_`, liens
déclarés à Matrix).

## 1. Ce que Modulus publie (vues définies par Matrix, requêtes de référence fournies par Modulus)

| Vue | Lecteur | Contenu | Jamais |
| --- | --- | --- | --- |
| `modulus.pub_catalogue_machines` | `arche_app`, `keystone_app` | contrat **K-01**, mêmes colonnes que `keystone.pub_catalogue_machines` (reprise), colonnes nouvelles en fin | budget, marge |
| `modulus.pub_catalogue_options` | `arche_app`, `keystone_app` | options, catégories, règles, prix de vente indicatif, délai additionnel | budget |
| `modulus.pub_cotations` | `arche_app` | demandes de cotation venues d'Arche et leurs réponses (contrat **K-02** repris : nature, qualification, prix de vente, délai, validité, référence Codex) | budget |
| `modulus.pub_budgets_configurations` | `keystone_app` | budget par poste et BOM figée des configurations vendues | — |
| `modulus.pub_configurations_vendues` | `keystone_app`, `arche_app` (sans budget) | configuration vendue, versions, affaire, projet lié | budget pour Arche |

## 2. Ce que Modulus lit

| Objet | Pourquoi |
| --- | --- |
| `clavis.pub_acces`, `clavis.pub_personnes` | droits et personnes (connexion par Clavis) |
| `arche.pub_besoins_machines` | besoins machines des CAPEX (affaire ouverte depuis un besoin) |
| `keystone.pub_projets` | projet créé depuis une configuration vendue |
| `keystone.pub_articles`, prix d'achat (vue à demander) | BOM préfaites, budget calculé (D-5, D-7) |
| `keystone.pub_couts_projet` (à demander) | coût réel par poste en fin de projet |
| `matrix.pub_rex_v2` | REX des projets |
| `codex.pub_documents` | état des documents cités (offres, fiches, plans) |
| `vigie.pub_ordres_modification` | modifications techniques qui touchent une BOM standard |
| `matrix.pub_sites`, `matrix.pub_filiales` | sites et filiales |

## 3. Écritures

- **Arche → Modulus** : demande de cotation par `POST /api/v1/quote-requests` (clé d'API, écriture signée, comme l'API
  d'Arche, `docs/API.md` d'Arche) ; Arche garde le numéro.
- **Modulus → Codex** : dépôt des offres PDF et des pièces par `POST /api/documents` de Codex.
- **Modulus → Keystone** : la commande ; Keystone crée le projet depuis `pub_configurations_vendues` (lecture, pas
  d'écriture chez Keystone).

## 4. Transition depuis Keystone

1. Modulus reprend les données du catalogue de Keystone (types, fiches et versions, options) par une lecture de
   `keystone.pub_catalogue_machines` (import unique, journalisé) ; les budgets de référence par type par une vue à
   demander.
2. Matrix publie `modulus.pub_catalogue_machines` (mêmes colonnes que K-01).
3. Arche bascule sa lecture vers Modulus (PR dans Arche) ; puis les réponses aux besoins (K-02) passent dans Modulus.
4. Keystone lit le catalogue dans Modulus, retire l'écran de saisie du catalogue (lecture seule, lien vers Modulus) ;
   `keystone.pub_catalogue_machines` reste tant qu'un lecteur en dépend, puis Matrix la retire.
5. Pendant la transition, une seule source fait foi par objet : le catalogue dans Modulus dès l'étape 2.

Demandes correspondantes : `docs/DEMANDES.md`.
