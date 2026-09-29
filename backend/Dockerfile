FROM node:24-alpine

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./

RUN npm ci

COPY backend/src ./src

COPY shared /app/shared

EXPOSE 3000

CMD ["npm", "start"]