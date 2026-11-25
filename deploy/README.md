# Deployment

- Delivery 0: the clickable mockup `maquette/index.html` (fictitious data) is served by nginx (`Dockerfile`,
  `deploy/nginx.conf`) at https://modulus.projectdirection.fr — Coolify resource « modulus » (Docker Compose,
  `/deploy/compose.yaml`, base directory `/`), behind the same HTTP basic authentication as Arche's site
  (`MODULUS_BASIC_AUTH_USERS`, Literal; « Escape special characters in labels » off). Replaced by the application at delivery 1.
