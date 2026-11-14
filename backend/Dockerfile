FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY tsconfig.json ./tsconfig.json
COPY src ./src

# prisma.config.ts requires DATABASE_URL even for `generate`; use a placeholder at
# build time (no DB connection is made). The real value comes from compose at runtime.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

ENV PORT=3001
EXPOSE 3001

# Sync the schema to the database, then start the API.
CMD ["npm", "run", "start:prod"]

