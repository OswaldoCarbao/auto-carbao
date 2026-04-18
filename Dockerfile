FROM n8nio/n8n:latest

USER root
WORKDIR /home/node/app

COPY package*.json ./
# Instalamos Express para el health check
RUN npm install express && npm install --omit=dev

COPY . .

ENV N8N_PORT=10001 
ENV PORT=10000
EXPOSE 10000

# Usamos el ejecutable de n8n que ya viene en la imagen
CMD ["node", "index_receptor.js"]
