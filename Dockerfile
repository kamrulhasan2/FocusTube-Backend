FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

ENV SIMPLE_GIT_HOOKS=0

RUN npm ci --legacy-peer-deps --production=false

COPY . .

RUN npm run build \
  && npm prune --production

EXPOSE 4000

CMD ["npm", "run", "start"]
