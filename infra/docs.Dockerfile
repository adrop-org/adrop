# adrop.sh (landing, www/) and docs.adrop.sh (MkDocs Material, docs/) from one Caddy image.
# Build context: repo root. Caddy routes by Host; the Cloudflare tunnel sends both hostnames here.
FROM python:3.12-slim AS build
RUN pip install --no-cache-dir mkdocs-material==9.*
WORKDIR /src
COPY mkdocs.yml ./
COPY docs ./docs
RUN mkdocs build --strict --site-dir /site

FROM caddy:2-alpine
COPY --from=build /site /srv/docs
COPY www /srv/www
COPY infra/Caddyfile.docs /etc/caddy/Caddyfile
EXPOSE 8080
