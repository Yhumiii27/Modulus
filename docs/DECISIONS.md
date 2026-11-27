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

## 2. Réponses du propriétaire (questionnaire, 24 novembre 2026)

| Id | Réponse | Note du propriétaire / conséquence |
| --- | --- | --- |
| D-1 | proposition retenue | cotations et réponses aux besoins des CAPEX dans Modulus ; Keystone garde l'exécution |
| D-2 | proposition retenue | pipeline simple |
| D-3 | autre réponse | modèle d'affaires du groupe, ci-dessous § 3 ; les clients extérieurs au groupe n'ont pas accès à Arche : Modulus doit traiter leurs demandes lui-même (questions D-16 et D-17) |
| D-4 | proposition retenue | direction commerciale ; au-delà de 10 % de remise, aussi la direction générale |
| D-5 | proposition retenue | articles lus dans `keystone.pub_articles` |
| D-6 | autre réponse | « On retient ta proposition pour l'instant, nous compléterons les fiches au fur et à mesure de l'évolution de l'outil et du catalogue » : liste de départ, caractéristiques ajoutables par type sans développement |
| D-7 | proposition retenue | budget calculé et saisi, écart montré |
| D-8 | proposition retenue | revue d'offre obligatoire au-delà de 150 k€ ou avec une option « jamais fait » / « à éviter » |
| D-9 | proposition retenue | coût réel à la clôture, puis à la fin de la garantie |
| D-10 | autre réponse | « Part sur ta proposition, nous te ferons probablement ajuster cela plus tard » : tronc commun + questions par type × catégorie, questionnaires modifiables par l'ingénierie sans développement |
| D-11 | autre réponse | « Prends ta proposition comme base, fais en sorte que cela soit réglable » : 5 / 15 / 30 jours ouvrés par défaut, réglables dans l'administration de Modulus |
| D-12 | proposition retenue | seuils de la spec 04 § 2 (à rendre réglables comme D-11) |
| D-13 | proposition retenue | pas de portail client, offre en PDF |
| D-14 | proposition retenue | grilles en euros, autre devise au cours du jour figé dans l'offre |
| D-15 | proposition retenue | budget et marge : chiffreurs, direction commerciale, direction de portefeuille, direction générale |
| U-1 | proposition retenue | rôles commercial, chiffreur, ingénierie, direction commerciale, lecture, administrateur ; la livraison 1 y ajoute **direction générale** et **direction de portefeuille**, que nomment D-4 (validation d'une remise au-delà du seuil) et D-15 (qui voit le budget) |
| U-2 | proposition retenue | affaire visible de son équipe et des directions ; les autres commerciaux voient la liste sans les prix |

## 3. Modèle d'affaires du groupe (réponse D-3)

Les filiales du groupe, dans plusieurs pays, fournissent de l'explosif aux clients miniers : soit produit dans la filiale
puis livré sur le site minier, soit produit sur le site minier par des équipements qui y sont installés (c'est le périmètre
des CAPEX, Arche). L'ingénierie du groupe conçoit et fournit les équipements de production, les livre, les installe, les met en production et
forme les opérateurs. Trois cas de vente d'équipements :

| Cas | Acheteur de l'équipement | Exploitant | Passe par Arche ? | Client de l'affaire dans Modulus |
| --- | --- | --- | --- | --- |
| 1 | la filiale | la filiale (sur son site ou sur le site minier), qui vend la production | oui : CAPEX de la filiale | la filiale (client interne) |
| 2 | le site minier, la filiale servant d'intermédiaire | le site minier | non (pas un investissement de la filiale) | le site minier, avec la filiale intermédiaire |
| 3 | un client direct du groupe | le client | non | le client externe |

Conséquences pour Modulus : une affaire porte un **cas** (1, 2 ou 3), un **client** et, pour le cas 2, la **filiale
intermédiaire** ; seul le cas 1 vient d'un CAPEX d'Arche. Pour les cas 2 et 3, le client n'a accès à aucun outil du groupe :
c'est le commercial (ou la filiale intermédiaire) qui saisit le besoin et la demande de cotation dans Modulus (D-17).

## 4. Questions de suivi (après les réponses du 24 novembre)

Relu le 25 novembre 2026 avant la livraison 1 : aucune réponse à D-16 ni à D-17 dans le questionnaire ; leur **réponse par défaut
est appliquée** (livraison 1, `docs/DELIVERY-1.md` § 2) jusqu'à la réponse du propriétaire. Les réponses D-1 à D-15, U-1 et U-2 sont
inchangées.

| Id | Question | Réponse par défaut | Autres choix |
| --- | --- | --- | --- |
| D-16 | Qui tient la fiche des clients ? Keystone tient déjà les clients (internes = filiales de Matrix, externes) et les publie (`keystone.pub_clients`). | Modulus lit les clients de Keystone ; un prospect (client jamais livré) se crée dans Modulus ; à la commande, le client est créé dans Keystone s'il n'y est pas (demande à Keystone par son API) | Modulus devient la source des clients et Keystone les lit ; chacun tient les siens |
| D-17 | Comment recueillir le besoin d'un client qui n'a pas accès aux outils (cas 2 et 3) ? | Le commercial saisit l'affaire et le questionnaire de cotation dans Modulus ; Modulus produit le questionnaire en PDF ou en formulaire imprimable à envoyer au client, puis le commercial reporte les réponses ; la filiale intermédiaire (cas 2) peut aussi saisir la demande si elle a un accès Modulus | formulaire en ligne sécurisé pour le client (lien à usage unique), à valider par la DSI ; la filiale saisit toujours |

## 5. Questionnaire initial (historique, réponses au § 2)


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
| U-1 | Rôles de Modulus (lus dans Clavis, cumulables) | commercial, chiffreur, ingénierie, direction commerciale, lecture, administrateur | ajouter « assistante commerciale » |
| U-2 | Qui voit une affaire ? | l'équipe de l'affaire, la direction commerciale et la direction générale ; les autres commerciaux voient la liste sans les prix | tout le service ; équipe et direction seulement |

## 6. Données à fournir

Liste, format et modèle de chaque donnée : `docs/DONNEES.md` (modèles CSV dans `docs/donnees/`).

## 7. Questionnaire

Les questions D-1 à D-17, U-1, U-2 et les données étaient dans le questionnaire « Décisions Modulus » (page retirée par
Norma 3.0). Elles sont reprises, avec les réponses déjà données, dans `decisions/modulus.json` du dépôt Norma et montrées
sur la page unique « Suivi Atrium » (https://claude.ai/artifact/Rs7kooJdowShdYUqNS8jQf ; réponses dans sa base, collection
`answers`, un document par question). Les réponses sont relues avant chaque livraison et reportées ici ; une nouvelle
question s'ajoute à `decisions/modulus.json` dans Norma.
