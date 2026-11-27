# Déploiement de Modulus (livraison 1, bêta)

Même cible qu'Arche, Crucible et Clavis : **une ressource Coolify « Dockerfile »** derrière l'authentification HTTP basique de
Coolify, sur le serveur PostgreSQL commun de la suite Atrium.

- Image : `Dockerfile` (racine). Elle démarre par `deploy/start.sh` ; avec `MODULUS_SINGLE_CONTAINER=on`, le conteneur applique les
  migrations (et le jeu de données d'un schéma vide, `MODULUS_SEED`), lance le worker en arrière-plan (sauvegardes, file d'envoi vers
  Codex simulée, déclaration à Matrix), puis le serveur web sur le port **3800**. `HEALTHCHECK` : `GET /api/health`.
- Base : serveur commun, schéma `modulus`, rôle `modulus_app`, sur le réseau Docker `coolify`. Modulus ne fixe ni le nom de la
  base ni l'hôte : il lit `DATABASE_URL`, `postgresql://modulus_app:<mot de passe>@<hôte>:5432/<base>`. Aujourd'hui (avant le
  renommage du serveur par Matrix) : la base et l'hôte gardent leurs noms actuels, ceux de la ressource PostgreSQL de Matrix. Le
  rôle existe mais reste `NOLOGIN` tant que son mot de passe n'est pas posé sur cette ressource (Matrix).
- **Renommage du serveur commun** (Norma 3.0, opération séparée de Matrix : base `atrium`, hôte `atrium-postgres`) : Modulus
  marche avant et après sans changement de code.
  - Ressource « Dockerfile » : remplacer, dans `DATABASE_URL`, l'hôte par `atrium-postgres` et la base par `atrium`, puis
    redéployer — seulement une fois l'opération annoncée faite par Matrix.
  - `deploy/compose.shared.yaml` : `DATABASE_URL` y est construite à partir de `ATRIUM_PG_HOST`, `ATRIUM_PG_DB` (et
    `ATRIUM_PG_PORT`, défaut `5432`) ; sans elles, les noms actuels du serveur (défauts du fichier, ou les anciennes variables
    `EPC2I_PG_HOST` / `EPC2I_PG_DB` si elles sont posées, lues pendant la transition seulement). Après l'opération : poser
    `ATRIUM_PG_HOST=atrium-postgres` et `ATRIUM_PG_DB=atrium` sur la ressource et redéployer. Le réseau suit de même
    `ATRIUM_DOCKER_NETWORK` (défaut `coolify`).
  - Installation directe : fichier `/etc/atrium/modulus.env` une fois le dossier renommé par Matrix (guide
    `docs/installation-directe.md` du dépôt Matrix), même `DATABASE_URL` à changer.
- Bêta : `MODULUS_SEED=demo` (données fictives), `MODULUS_AUTH=demo` (« Voir en tant que ») — **seulement derrière l'authentification
  basique de Coolify**, rien dans Modulus ne la remplace. `MODULUS_CLOCK=2026-11-24` fige la date du jeu de démonstration (facultatif).
- Variante Docker Compose sur le serveur commun (installation directe ou Coolify « Docker Compose ») : `deploy/compose.shared.yaml`.

Variables (noms seulement ; toutes décrites dans `.env.example`) : `DATABASE_URL`, `MODULUS_SINGLE_CONTAINER`, `MODULUS_SEED`,
`MODULUS_AUTH`, `MODULUS_CLOCK`, puis, pour la connexion réelle par Clavis : `MODULUS_SESSION_SECRET`, `ENTRA_ISSUER`,
`ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI`, `MODULUS_ACCESS_FROM_CLAVIS` ; facultatives : `MODULUS_BACKUP_DIR`,
`MATRIX_URL`, `MATRIX_TOKEN`, `NEXT_PUBLIC_KEYSTONE_URL`, `NEXT_PUBLIC_CODEX_URL` (au build), `LOG_LEVEL` ; pour
`deploy/compose.shared.yaml` seulement : `ATRIUM_PG_HOST`, `ATRIUM_PG_DB`, `ATRIUM_PG_PORT`, `ATRIUM_DOCKER_NETWORK`.
