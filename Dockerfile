FROM n8nio/n8n:latest

USER root
RUN apk add --update nodejs npm

WORKDIR /home/node/app
COPY . .
RUN npm install

ENV N8N_PORT=10000
EXPOSE 10000

CMD ["sh", "-c", "n8n & node index_receptor.js"]
