# 01 — Catalogue, BOM préfaites, prix

## 1. Machine standard

Reprend la fiche du catalogue de Keystone (contrat K-01) et le type de machine :

- **Type** (`EMP`, `MEMU`, `SPUR`…) : famille, description, modèle de projet côté Keystone.
- **Machine standard** : code (`EMP-40T`), version, variante, libellé, description, capacité nominale et unité,
  caractéristiques techniques (encombrement, puissance, utilités — liste par type, D-6), délai type (semaines), photos et
  fiche technique (références Codex).
- **Cycle de vie** (comme dans Keystone) : brouillon → publiée → retirée ; une version publiée est figée ; « nouvelle
  version » copie la dernière en brouillon ; publier la version n retire la précédente ; une affaire ou un CAPEX qui a
  choisi une version la garde.

## 2. Options

- Une option a un code, un libellé, une description, une **catégorie** (capacité, automatisme, sécurité, environnement,
  confort, service…) et s'applique à une ou plusieurs machines standard.
- **Règles entre options** (configurateur) : `exclut`, `impose`, `obligatoire si` (condition sur une caractéristique, ex.
  capacité ≥ 40 t), `une parmi` (groupe exclusif). Une configuration qui viole une règle est refusée, avec la règle citée.
- Une option a, comme la machine, une BOM préfaite, un budget et un prix de vente, un délai additionnel.
- Une option **hors catalogue** (spécifique) naît d'une demande de cotation (spec 03) ; elle peut entrer au catalogue
  ensuite (spec 04).

## 3. BOM préfaite

- Une BOM par version de machine standard : lignes (article, quantité, unité, sous-ensemble, repère), articles pris dans
  le référentiel d'articles (D-5 : celui de Keystone, lu par `keystone.pub_articles`, ou un référentiel propre).
- Une option modifie la BOM : **ajoute**, **retire** ou **remplace** des lignes (delta), jamais une copie entière.
- La BOM d'une configuration = BOM de base + deltas des options choisies, **calculée** ; elle est figée seulement dans une
  offre envoyée ou une configuration vendue. Keystone part de cette BOM figée pour la BOM du projet.
- Contrôles : quantité > 0, article existant et actif, delta « retire » sur une ligne qui existe, pas de cycle de
  sous-ensembles.

## 4. Prix

- **Budget** (coût de revient prévisionnel, par poste : matière, sous-traitance, heures d'ingénierie, d'atelier, de
  chantier, frais) et **prix de vente** sont deux grandeurs distinctes, aux droits distincts.
- Le budget se calcule (D-7) : à partir de la BOM valorisée aux derniers prix d'achat (Keystone `pub_…` des prix) + les
  heures standard × taux, ou se saisit par poste ; le calcul montre l'écart avec la saisie.
- Le prix de vente vient d'une **grille de prix datée** (validité du… au…, devise, indexation matières optionnelle) ou
  d'un coefficient sur le budget ; marge affichée seulement à qui voit le budget.
- Une grille ou un prix de vente se **publie après validation** de la direction commerciale (D-4) ; une remise au-delà du
  seuil se valide aussi.
- Devises : prix tenus en euros ; une offre peut être émise dans la devise du client au cours du jour (taux noté dans
  l'offre).

## 5. Publication

- Vers Arche (filiales) : machines publiées, options, règles, **prix de vente indicatif** et délai (contrat K-01 v2,
  jamais de budget).
- Vers Keystone : la même chose **avec le budget** et la BOM (contrat de lecture propre, réservé à `keystone_app`).
- Les vues sont définies et appliquées par Matrix (M-18) ; Modulus fournit les requêtes de référence et les tests.
