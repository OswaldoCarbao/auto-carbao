FROM n8nio/n8n:latest

USER root
WORKDIR /home/node/app

# Instalamos dependencias del sistema necesarias para Baileys/WhatsApp
RUN apk add --no-cache python3 make g++

COPY . .
RUN npm install

# Puerto para Render
ENV N8N_PORT=10000
EXPOSE 10000

# Usamos el comando directo sin rutas fijas
CMD ["node", "index_receptor.js"]
