# 03 — Cotation des options hors catalogue

## 1. Déclenchement

- Depuis une affaire de Modulus : le commercial ajoute une option qui n'est pas au catalogue.
- Depuis **Arche**, à l'ouverture d'un CAPEX : la filiale choisit une machine standard et ses options ; une option
  absente du catalogue ouvre la demande de cotation. Arche l'envoie par l'**API de Modulus**
  (`POST /api/v1/quote-requests`, signée, rattachée au besoin machine du CAPEX) ; Arche ne stocke que le numéro de la
  demande et lit la réponse par une vue `pub_`.

## 2. Questionnaire type

Un questionnaire par **famille** (type de machine × catégorie d'option, D-10), versionné comme le catalogue, tenu par
l'ingénierie. Questions de base, communes à toutes les familles :

| Thème | Questions |
| --- | --- |
| Besoin | Que doit faire l'option ? Quel problème résout-elle ? Qu'est-ce qui se passe aujourd'hui sans elle ? |
| Produit | Produit traité, état (liquide, poudre, pièces…), dimensions, masse, cadence, variantes |
| Performances | Capacité, précision, temps de cycle, disponibilité attendues ; critères d'acceptation |
| Environnement | Site, intérieur / extérieur, température, poussière, ATEX, contraintes d'implantation, utilités disponibles |
| Normes et sécurité | Normes client, marquage, exigences HSE particulières |
| Interfaces | Machines amont / aval, automatisme et protocole, données à échanger |
| Délai et budget | Date souhaitée, budget envisagé, caractère bloquant pour le CAPEX |
| Pièces | Plans, photos, cahier des charges (déposés dans Codex) |

Chaque question a un type (texte, nombre + unité, choix, oui / non, pièce) et peut être obligatoire. Une demande
incomplète est refusée avec la liste des réponses manquantes.

## 3. Traitement

1. **Qualification** par l'ingénierie : faisable / à étudier / refusée (motif), avec le niveau de savoir-faire proposé
   (spec 04) et les **cas proches** (options similaires déjà cotées, vendues, livrées, et leur coût réel).
2. **Chiffrage** par le chiffreur : BOM delta, budget par poste, prix de vente, délai additionnel, classe d'estimation
   (comme `need_answers.estimate_class` de Keystone : indicatif, devis, offre ferme), hypothèses, validité.
3. **Réponse** : publiée à Arche (vue) ou ajoutée à l'offre de l'affaire ; questions de retour possibles au demandeur
   (fil de la demande).
4. Suivi : délai de réponse cible par classe (D-11), relances, échéance au chiffreur.

## 4. Ce que devient l'option

Une option cotée reste **spécifique** (rattachée à son affaire) ; vendue, elle entre dans la configuration vendue ; elle
nourrit le savoir-faire (spec 04), qui peut proposer de la faire entrer au catalogue.
