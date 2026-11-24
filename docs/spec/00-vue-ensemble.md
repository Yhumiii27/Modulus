# 00 — Vue d'ensemble de Modulus

## 1. Pourquoi

Le propriétaire (24 novembre 2026) sort de Keystone la partie « machines standard et catalogue » pour en faire un outil à
part, **support du service commercial et chiffrage**. Keystone reste l'outil d'exécution des projets ; Arche reste l'outil
des CAPEX des filiales. Modulus tient tout ce qui précède la commande et ce qui a été vendu :

1. le **catalogue** des machines standard, de leurs options et des règles entre options ;
2. une **BOM préfaite** par machine standard et par option ;
3. les **prix** : budget (coût de revient, pour Keystone) et prix de vente (pour Arche et les clients) ;
4. la **cotation des options hors catalogue**, à partir d'un questionnaire type qui fait comprendre le besoin ;
5. les **affaires**, leurs offres successives et la **configuration vendue**, figée à la commande ;
6. la **capitalisation** : ce qui a été vendu dans chaque projet, les options développées pour chacun, leur coût réel et
   leur retour d'expérience, pour savoir ce que l'on sait faire et ce que l'on ne sait pas faire.

## 2. Qui l'utilise

| Profil | Ce qu'il fait dans Modulus |
| --- | --- |
| Commercial (chargé d'affaires) | ouvre une affaire, configure, demande une cotation, émet les offres, enregistre la commande |
| Chiffreur / estimateur | chiffre les options hors catalogue et les offres, tient les grilles de prix |
| Ingénierie (responsable technique) | tient les machines standard, les options, les BOM préfaites, les règles entre options ; juge la faisabilité |
| Direction commerciale | valide les prix de vente et les remises au-delà d'un seuil, suit le pipeline |
| Direction de portefeuille (Keystone) | lit le budget d'une configuration vendue, reçoit la commande, renvoie le coût réel et le REX |
| Filiale (via Arche) | choisit une machine et ses options, demande une cotation, lit le prix de vente et le délai |
| Administration (DSI) | accès par Clavis, référentiels |

Les droits sont réglés dans Clavis (rôles propres à Modulus, lus dans `clavis.pub_acces`) ; Modulus applique en plus un
périmètre par affaire (équipe de l'affaire) et cache les coûts à qui n'a pas le droit de les voir.

## 3. Ce que Modulus ne fait pas

- Il n'exécute pas les projets (planning, achats, chantier, recette : Keystone).
- Il ne tient pas les CAPEX ni le cycle DIG-PRODI (Arche).
- Il ne stocke aucun fichier (Codex : offres PDF, fiches techniques, plans, pièces des questionnaires).
- Il ne tient pas les clients de la comptabilité ni la facturation (décision D-3 : où vivent les clients externes).
- Il ne remplace pas un CRM complet tant que le propriétaire ne l'a pas décidé (D-2).

## 4. Le parcours en une page

```
Catalogue (machines, options, règles, BOM préfaites, prix)
   │ publié (vente → Arche ; budget → Keystone)
   ▼
Affaire ── besoin du client (ou besoin machine d'un CAPEX d'Arche)
   │ configuration : machine + options du catalogue
   │ option absente → demande de cotation (questionnaire type) → chiffrage → réponse
   ▼
Offre A, B… (figée à l'envoi : configuration, BOM, prix, délai, hypothèses, réserves)
   │ revue d'offre (go / no-go) ─ validation du prix au-delà du seuil
   ▼
Commande → configuration vendue (figée) ── Keystone crée le projet depuis elle
   │ avenant = nouvelle version vendue
   ▼
Fin de projet : Keystone publie coût réel, écarts, REX, recette
   ▼
Savoir-faire : niveau par machine / option / caractéristique, cas de référence, options à faire entrer au catalogue
```

## 5. Documents du cadrage

| Fichier | Contenu |
| --- | --- |
| `01-catalogue-bom-prix.md` | machines standard, options, règles, BOM préfaites, grilles de prix |
| `02-affaires-offres-ventes.md` | affaires, offres, revue d'offre, commande, configuration vendue, avenants |
| `03-cotation-options.md` | demande de cotation, questionnaire type, chiffrage, réponse |
| `04-savoir-faire.md` | capitalisation : niveaux, preuves, cas proches, entrée au catalogue |
| `05-echanges.md` | contrats avec Arche, Keystone, Codex, Vigie, Clavis, Matrix ; transition depuis Keystone |
| `06-donnees.md` | modèle de données (premier jet) |
| `../DECISIONS.md` | questions au propriétaire, chacune avec une réponse par défaut |
| `../PLAN.md` | livraisons |
