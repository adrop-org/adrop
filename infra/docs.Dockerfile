# docs.adrop.sh: MkDocs Material build served by Caddy. Build context: repo root.
FROM python:3.12-slim AS build
RUN pip install --no-cache-dir mkdocs-material==9.*
WORKDIR /src
COPY mkdocs.yml ./
COPY docs ./docs
RUN mkdocs build --strict --site-dir /site

FROM caddy:2-alpine
COPY --from=build /site /srv
RUN printf ':8080 {\n\troot * /srv\n\tfile_server\n\tencode gzip\n}\n' > /etc/caddy/Caddyfile
EXPOSE 8080
