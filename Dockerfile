# Imagem para hospedar em qualquer VPS / Railway / Render / Fly.io
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install
COPY . .
ENV NITRO_PRESET=node_server
RUN bun run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
