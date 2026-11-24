# Demandes de Modulus aux autres outils (brouillons)

Chaque demande est présentée au propriétaire et ne part dans le `REQUESTS.md` de l'outil (ou en PR, si le propriétaire
autorise la session à modifier ce dépôt) qu'après son « validé ».

## Clavis

- **C-1** : ajouter l'application `modulus` (état « prévu » puis « ouvert ») et ses rôles propres
  (`commercial`, `chiffreur`, `ingenierie`, `direction_commerciale`, `lecture`, `admin`), associés aux niveaux communs
  dans `src/domain/app-roles.ts`, et aux profils (commercial, chargé d'affaires, bureau d'études, direction).

## Matrix

- **M-1** : rôle `modulus_app` et schéma `modulus` dans le socle (`init/01`–`03`, `partage/90-droits.sql`, registre des
  outils, sauvegarde) ; liens de lecture de la spec 05 § 2.
- **M-2** : publications `modulus.pub_catalogue_machines` (K-01 v2), `pub_catalogue_options`, `pub_cotations` (K-02
  repris), `pub_budgets_configurations` (lecteur `keystone_app` seul), `pub_configurations_vendues`, d'après les requêtes de
  référence de Modulus (livraisons 2, 4, 5).

## Keystone

- **K-1** : une vue des prix d'achat des articles (dernier prix, date, fournisseur) et des taux horaires, pour le budget
  calculé (D-7).
- **K-2** : une vue du coût réel par projet et par poste, et des options livrées, à la clôture (D-9).
- **K-3** : la transition du catalogue (spec 05 § 4) : lecture du catalogue dans Modulus, écran du catalogue en lecture
  seule avec lien vers Modulus, création du projet depuis une configuration vendue.

## Arche

- **A-1** : lire le catalogue dans `modulus.pub_catalogue_machines` et `pub_catalogue_options` au lieu de Keystone.
- **A-2** : à l'ouverture d'un CAPEX, une option absente du catalogue ouvre une demande de cotation envoyée par l'API de
  Modulus ; la réponse se lit dans `modulus.pub_cotations` (remplace K-02).
