# Modulus — delivery 0: the clickable mockup (maquette/index.html, fictitious data only) served as a static site until the
# application of delivery 1 replaces it. One self-contained HTML file: no external request (its own CSP forbids them).
# Coolify: deploy/compose.yaml (basic authentication by a Traefik label, like Arche). Port 80.
FROM nginx:1.27.5-alpine

RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/modulus.conf
COPY maquette/ /usr/share/nginx/html/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
