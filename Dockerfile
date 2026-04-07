FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

ENV SIMPLE_GIT_HOOKS=0
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true

RUN npm ci --legacy-peer-deps --production=false

COPY . .

RUN npm run build \
  && npm prune --omit=dev --legacy-peer-deps

EXPOSE 4000

CMD ["npm", "run", "start"]
