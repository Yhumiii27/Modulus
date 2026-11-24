# Modulus — décisions

## 1. Décisions déjà prises par le propriétaire

| Id | Date | Décision |
| --- | --- | --- |
| P-1 | 24 nov. 2026 | La partie « machines standard et catalogue » sort de Keystone pour un outil à part : Modulus. |
| P-2 | 24 nov. 2026 | Modulus publie la liste des machines standard à Arche (CAPEX) et à Keystone. |
| P-3 | 24 nov. 2026 | À la création d'un CAPEX, la filiale choisit une machine et ses options ; une option absente du catalogue ouvre une demande de cotation avec un questionnaire type qui fait comprendre le besoin. |
| P-4 | 24 nov. 2026 | Une machine standard, avec ou sans options, est liée à une BOM préfaite et à des prix : budget pour Keystone, vente pour Arche. |
| P-5 | 24 nov. 2026 | Modulus est le support du service commercial et chiffrage : il garde la trace de ce qui est vendu dans chaque projet et des options développées pour chacun, pour capitaliser sur ce que l'on sait ou ne sait pas faire. |
| P-6 | 24 nov. 2026 | Nom : Modulus. Charte graphique : celle de Keystone (Nocturne), aujourd'hui tenue dans Norma, avec les thèmes sombre et clair. |

## 2. Questions ouvertes (chacune a une réponse par défaut, appliquée si le propriétaire ne dit rien)

| Id | Question | Réponse par défaut | Autres choix |
| --- | --- | --- | --- |
| D-1 | Les réponses aux besoins machines des CAPEX (contrat K-02, aujourd'hui dans Keystone) passent-elles dans Modulus ? | Oui : cotations et réponses dans Modulus ; Keystone ne garde que l'exécution | Rester dans Keystone |
| D-2 | Modulus tient-il un pipeline commercial (probabilité, montant pondéré, prévision) ? | Oui, simple : statut, probabilité, montant pondéré, motifs de perte | Non (pas de CRM) ; CRM complet plus tard |
| D-3 | Où vivent les clients externes ? | Dans Modulus (raison sociale, pays, contacts commerciaux, SIRET / TVA), sans données comptables | Lus dans un CRM existant (identifiant seulement) ; Sage |
| D-4 | Qui valide un prix de vente publié et une remise ? | La direction commerciale ; une remise au-delà de 10 % aussi la direction générale | Seuils à donner |
| D-5 | Les articles des BOM préfaites viennent-ils du référentiel d'articles de Keystone ? | Oui, lus par `keystone.pub_articles` ; un article manquant se crée dans Keystone | Référentiel propre à Modulus |
| D-6 | Quelles caractéristiques techniques par type de machine ? | Liste à fournir par l'ingénierie ; en attendant : capacité, encombrement, puissance installée, air, eau | — |
| D-7 | Le budget se calcule-t-il (BOM × derniers prix d'achat + heures × taux) ou se saisit-il par poste ? | Les deux : calcul proposé, saisie possible, écart montré | Saisie seule |
| D-8 | Une revue d'offre (go / no-go) est-elle obligatoire avant tout envoi ? | Oui au-delà de 150 k€ ou dès qu'une option est « jamais fait » ou « à éviter » | Toujours ; jamais |
| D-9 | Quand Keystone renvoie-t-il le coût réel d'un projet ? | À la clôture du projet, puis une mise à jour à la fin de la garantie | À chaque jalon |
| D-10 | Un questionnaire type par quoi ? | Par type de machine × catégorie d'option, avec un tronc commun | Un seul questionnaire |
| D-11 | Délai cible de réponse à une demande de cotation | Indicatif 5 jours ouvrés ; devis 15 ; offre ferme 30 | À donner |
| D-12 | Règles des niveaux de savoir-faire (seuils) | Celles de la spec 04 § 2 ; entrée au catalogue proposée après 2 ventes | À ajuster |
| D-13 | Le client voit-il une offre en ligne (portail) ? | Non : l'offre est un PDF envoyé (Keystone a retiré son portail client, D9-06) | Portail plus tard |
| D-14 | Devises de vente | Euro ; autre devise au cours du jour noté dans l'offre | Grilles par devise |
| D-15 | Qui voit le budget et la marge ? | Chiffreurs, direction commerciale, direction de portefeuille, direction générale ; pas les commerciaux | Aussi les commerciaux |
