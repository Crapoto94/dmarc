FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src/ ./src/

RUN mkdir -p data reports

EXPOSE 3201

CMD ["node", "src/index.js"]
