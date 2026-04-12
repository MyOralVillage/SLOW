FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY tsconfig.json ./tsconfig.json
COPY src ./src

RUN npm run prisma:generate && npm run build

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/main.js"]

