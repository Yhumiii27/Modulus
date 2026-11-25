# Déploiement de Modulus (livraison 1, bêta)

Même cible qu'Arche, Crucible et Clavis : **une ressource Coolify « Dockerfile »** derrière l'authentification HTTP basique de
Coolify, sur le serveur PostgreSQL commun EPC2I.

- Image : `Dockerfile` (racine). Elle démarre par `deploy/start.sh` ; avec `MODULUS_SINGLE_CONTAINER=on`, le conteneur applique les
  migrations (et le jeu de données d'un schéma vide, `MODULUS_SEED`), lance le worker en arrière-plan (sauvegardes, file d'envoi vers
  Codex simulée, déclaration à Matrix), puis le serveur web sur le port **3800**. `HEALTHCHECK` : `GET /api/health`.
- Base : serveur commun, base `epc2i`, schéma `modulus`, rôle `modulus_app`, hôte `epc2i-postgres` (réseau Docker `coolify`).
  `DATABASE_URL=postgresql://modulus_app:<mot de passe>@epc2i-postgres:5432/epc2i`. Le rôle existe mais reste `NOLOGIN` tant que
  son mot de passe n'est pas posé sur la ressource `epc2i-postgres` (Matrix).
- Bêta : `MODULUS_SEED=demo` (données fictives), `MODULUS_AUTH=demo` (« Voir en tant que ») — **seulement derrière l'authentification
  basique de Coolify**, rien dans Modulus ne la remplace. `MODULUS_CLOCK=2026-11-24` fige la date du jeu de démonstration (facultatif).
- Variante Docker Compose sur le serveur commun (installation directe ou Coolify « Docker Compose ») : `deploy/compose.shared.yaml`.

Variables (noms seulement ; toutes décrites dans `.env.example`) : `DATABASE_URL`, `MODULUS_SINGLE_CONTAINER`, `MODULUS_SEED`,
`MODULUS_AUTH`, `MODULUS_CLOCK`, puis, pour la connexion réelle par Clavis : `MODULUS_SESSION_SECRET`, `ENTRA_ISSUER`,
`ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI`, `MODULUS_ACCESS_FROM_CLAVIS` ; facultatives : `MODULUS_BACKUP_DIR`,
`MATRIX_URL`, `MATRIX_TOKEN`, `NEXT_PUBLIC_KEYSTONE_URL`, `NEXT_PUBLIC_CODEX_URL` (au build), `LOG_LEVEL`.
