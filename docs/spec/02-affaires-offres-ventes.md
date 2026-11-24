# 02 — Affaires, offres, configuration vendue

## 1. Affaire

- **Cas de vente** (réponse D-3, `docs/DECISIONS.md` § 3) : 1 = la filiale achète et exploite (vient d'un CAPEX d'Arche) ;
  2 = le site minier achète, la filiale sert d'intermédiaire (filiale intermédiaire portée par l'affaire) ; 3 = client direct
  d'EPC2i. Seul le cas 1 passe par Arche ; dans les cas 2 et 3, le client n'a accès à aucun outil du groupe (D-17).

- Numéro `AF-AAAA-NNNN`, client (D-3), site de livraison, chargé d'affaires, équipe, origine : demande d'un client
  externe, **besoin machine d'un CAPEX d'Arche** (référence du besoin `CPX-…/B01`), appel d'offres, renouvellement.
- Besoin exprimé (texte saisi, affiché tel quel), date souhaitée, budget du client s'il est connu.
- Statut : `ouverte` → `en_chiffrage` → `offre_remise` → `gagnee` | `perdue` (motif obligatoire : prix, délai, technique,
  concurrent, projet abandonné, autre) | `abandonnee`.
- Probabilité et montant pondéré pour le pipeline (D-2).

## 2. Configuration et offre

- Une affaire porte une ou plusieurs **lignes** : machine standard (code + version) × quantité + options du catalogue +
  options spécifiques (cotations, spec 03). Plusieurs machines différentes sur une même affaire (ex. une EMP et trois
  MEMU : note R-185 de Keystone).
- Une **offre** (A, B, C…) fige au moment de l'envoi : lignes, BOM calculée, budget et prix de vente par ligne et au
  total, remise, délai, validité, conditions (paiement : acompte / livraison / recette, repris du type de machine),
  **hypothèses du chiffrage**, réserves, niveau de savoir-faire de chaque option (spec 04). Le PDF de l'offre est déposé
  dans Codex ; Modulus garde sa référence.
- **Revue d'offre** avant envoi (D-8) : liste de contrôle (marge ≥ seuil, options « jamais fait » ou « à éviter »
  signalées, délai compatible avec la charge de l'ingénierie, risques), décision go / no-go tracée, validation du prix
  au-delà du seuil.

## 3. Commande et configuration vendue

- La commande (date, référence client, offre retenue) crée la **configuration vendue** v1 : copie figée de l'offre
  retenue (immuable, déclencheur en base) et lien vers le projet Keystone créé à partir d'elle (contrat K-10 repris).
- Un **avenant** crée la version suivante (v2…) avec ce qui change (ajout, retrait, prix), son motif et sa date ; les
  versions précédentes restent lisibles.
- Pour un CAPEX d'Arche, la commande correspond au G2 Go du CAPEX ; Arche lit l'état « commandée » de la réponse.

## 4. Retour du projet

En fin de projet (ou à chaque jalon convenu, D-9), Keystone publie pour le projet lié :
- coût réel par poste (mêmes postes que le budget), écart au budget ;
- heures réelles d'ingénierie, d'atelier, de chantier ;
- difficultés et REX (référence à `pub_rex_v2`), réserves de recette, PV ;
- options réellement livrées (une option vendue non livrée est signalée).

Modulus rattache ce retour à la configuration vendue et à chacune de ses options ; c'est la matière de la spec 04.

## 5. Indicateurs (calculés, jamais stockés)

Pipeline pondéré, taux de transformation (par type de machine, par commercial, par origine), motifs de perte, délai moyen
de chiffrage, prix gagnés / perdus par type, écart budget / réel par machine et par option, marge prévue / réelle.
