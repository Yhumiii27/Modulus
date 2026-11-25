# Modulus — plan des livraisons

| Livraison | Contenu | Dépend de |
| --- | --- | --- |
| **0 — Cadrage** | spécification `docs/spec/00`–`06`, décisions, plan, demandes aux autres outils | — |
| **1 — Plateforme et bêta** (faite le 25 nov. 2026, `docs/DELIVERY-1.md`) | socle copié de Clavis (adapté par Crucible / Arche), charte `@norma/charte` (thèmes sombre et clair), PostgreSQL seul, schéma `modulus`, connexion par Clavis et droits lus dans `clavis.pub_acces` (rôles Modulus à ajouter dans Clavis), journal d'audit, horloge, jeu de démonstration, CI ; à la demande du propriétaire (« passer du stade de maquette au stade de bêta »), tous les écrans de la maquette construits sur ce socle avec le jeu de démonstration (une première version des livraisons 2 à 6, à compléter par elles) | Norma 2.1, demande Clavis C-1 |
| **2 — Catalogue, BOM, prix** | types, machines et versions, options et règles, BOM préfaites et deltas, budgets par poste, grilles de prix datées et validation, reprise du catalogue de Keystone (import journalisé), requêtes de référence des vues K-01 v2 et options | D-5, D-6, D-7 ; Matrix pour les vues |
| **3 — Affaires et offres** | affaires, lignes de configuration (configurateur avec règles), offres figées, revue d'offre, PDF déposé dans Codex, pipeline | D-2, D-3, D-4, D-8 |
| **4 — Cotation des options** | questionnaires types, demandes (affaire ou API pour Arche), qualification, chiffrage, réponse, cas proches, vue `pub_cotations` (K-02 repris) | D-1, D-10, D-11 ; Arche (bascule) |
| **5 — Commande et retour de projet** | commande, configuration vendue et avenants, vue pour Keystone, retour du coût réel et du REX | D-9 ; Keystone (création du projet, vue des coûts réels) |
| **6 — Savoir-faire** | niveaux calculés, carte, fiche de preuves, propositions d'entrée au catalogue, alertes | D-12 |
| **7 — Transition achevée** | Keystone et Arche ne lisent plus que Modulus pour le catalogue ; retrait de l'écran de saisie de Keystone | Keystone, Arche, Matrix |

Chaque livraison : branche, PR fusionnée une fois la CI verte. Reste à faire : `reste-a-faire/modulus.json` dans Norma (page globale https://claude.ai/artifact/Rs7kooJdowShdYUqNS8jQf).
