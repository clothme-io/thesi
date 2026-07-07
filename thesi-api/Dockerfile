FROM node:22-alpine AS base
WORKDIR /usr/src/app

FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5000
CMD ["npm", "run", "start:dev"]

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /usr/src/app/dist ./dist
EXPOSE 5000
CMD ["sh", "-c", "node dist/dbConfig/drizzle/migrate.js && node dist/main"]
