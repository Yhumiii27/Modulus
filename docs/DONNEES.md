# Modulus — données à fournir

Le propriétaire fournira ces données plus tard (24 novembre 2026). Chaque fichier a un modèle CSV dans `docs/donnees/`
(séparateur `;`, UTF-8, une ligne d'exemple à remplacer). Un fichier Excel convient aussi s'il garde les mêmes colonnes. Les
fichiers réels ne vont pas dans Git s'ils contiennent des prix ou des noms de clients : ils se déposent dans Codex et leur
référence est notée ici.

| # | Donnée | Modèle | Qui la tient sans doute | Utile pour | Livraison | Remarque |
| --- | --- | --- | --- | --- | --- | --- |
| DATA-0 | Filiales du groupe et pays | `00-filiales-pays.csv` | direction / DSI | cas 1 et 2 (D-3), devises, sites | L1 | les filiales, zones et sites font foi dans Matrix (`matrix.pub_filiales`, `pub_sites`, décision M-08) : la liste se saisit dans le référentiel de Matrix, Modulus la lit |
| DATA-1 | Types de machines et machines standard | `01-machines-standard.csv` | ingénierie, commerce | catalogue | L2 | le catalogue actuel de Keystone est repris automatiquement : ne lister que ce qui manque ou diffère |
| DATA-2 | Caractéristiques techniques par type | `02-caracteristiques-par-type.csv` | ingénierie | configurateur, règles, savoir-faire | L2 | liste de départ de D-6 ; complétée au fil de l'eau (D-6) |
| DATA-3 | Options courantes | `03-options.csv` | ingénierie, commerce | catalogue, configurateur | L2 | catégories : capacité, automatisme, sécurité, environnement, confort, service, autre |
| DATA-4 | Règles entre options | `04-regles-options.csv` | ingénierie | configurateur | L2 | règles : `exclut`, `impose`, `obligatoire_si`, `une_parmi` |
| DATA-5 | BOM préfaites (machines et options) | `05-bom-standard.csv` | bureau d'études | budget calculé, BOM des projets | L2 | articles par leur code Keystone (D-5) ; une option s'écrit en delta |
| DATA-6 | Budgets par poste et taux horaires | `06-budgets-et-taux.csv` | chiffrage, finance | budget (D-7) | L2 | postes : matière, sous-traitance, heures ingénierie / atelier / chantier, frais ; préciser les taux horaires en vigueur |
| DATA-7 | Grilles de prix de vente | `07-grilles-de-prix.csv` | direction commerciale | prix de vente, remises (D-4) | L2 | en euros (D-14) ; validité datée |
| DATA-8 | Clients et prospects | `08-clients-et-prospects.csv` | commerce | affaires (D-3, D-16) | L3 | les clients déjà dans Keystone sont lus là-bas : ne lister que les prospects et les contacts commerciaux |
| DATA-9 | Affaires passées à reprendre | `09-affaires-passees.csv` | commerce, chiffrage, Keystone | savoir-faire (D-12), références | L6 | au minimum les projets livrés des 3 à 5 dernières années ; le coût réel peut venir de Keystone |
| DATA-10 | Questions de cotation | `10-questions-cotation.csv` | ingénierie | questionnaire type (D-10) | L4 | tronc commun proposé dans `docs/spec/03-cotation-options.md` § 2 ; questions propres à chaque type × catégorie |

## Comment les transmettre

1. Remplir le modèle (ou un export de l'outil actuel avec les mêmes colonnes).
2. Le déposer dans Codex (ou le transmettre dans la session) en indiquant le numéro DATA-n.
3. Claude contrôle le fichier (colonnes, codes, doublons, articles inconnus de Keystone), signale les écarts, puis l'importe
   dans la livraison concernée par un import journalisé, rejouable.
