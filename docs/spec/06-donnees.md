# 06 — Modèle de données (premier jet)

Schéma `modulus`, rôle `modulus_app`. Chaque table porte ses contraintes de format (`norma/REGLES.md` § 4).

| Table | Rôle | Points clés |
| --- | --- | --- |
| `machine_types` | familles (EMP, MEMU…) | code, libellé, conditions de paiement types |
| `machines` / `machine_versions` | machine standard et versions | brouillon → publiée → retirée ; version publiée immuable (déclencheur) |
| `machine_characteristics` | caractéristiques techniques par version | liste par type (D-6), valeur + unité |
| `options` / `option_versions` | options du catalogue et spécifiques | `origin` = catalogue \| specifique, `quote_request_id` |
| `option_rules` | exclut, impose, obligatoire si, une parmi | refus d'une configuration qui viole une règle |
| `bom_lines` | BOM de base d'une version de machine | article, quantité, unité, sous-ensemble |
| `option_bom_deltas` | ajout / retrait / remplacement par option | jamais de copie de BOM |
| `price_lists` / `price_list_items` | grilles datées, devise, statut de validation | prix de vente |
| `cost_budgets` | budget par poste (machine ou option, version) | droits « coûts » |
| `customers` | clients (si D-3 = dans Modulus) | sinon identifiant externe seulement |
| `deals` | affaires `AF-AAAA-NNNN` | statut, motif de perte, probabilité |
| `deal_lines` | lignes de configuration d'une affaire | machine × quantité + options |
| `offers` / `offer_snapshots` | offres A, B… et leur contenu figé | immuable à l'envoi, référence Codex du PDF |
| `offer_reviews` | revue d'offre, go / no-go | décideur, date, motifs |
| `orders` / `sold_configurations` | commande et versions vendues | immuable, projet Keystone lié |
| `quote_requests` / `quote_answers` | demandes de cotation et réponses | origine Arche ou affaire, questionnaire et réponses |
| `questionnaires` / `questions` | questionnaires types par famille, versionnés | types de réponse, obligatoire |
| `project_feedback` | retour de Keystone par configuration vendue et par option | coût réel, écarts, REX |
| `knowhow_notes` | notes et marquages « à éviter » | motif obligatoire |
| `audit_entries` | journal en ajout seul | déclencheur |

Calculés, jamais stockés : BOM d'une configuration, budget calculé, marge, niveau de savoir-faire, cas proches,
indicateurs commerciaux.
