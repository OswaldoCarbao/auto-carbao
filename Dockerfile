# Cambiamos a la versión 20 que es la que pide Baileys
FROM node:20-alpine

# Instalamos GIT (necesario para bajar Baileys)
RUN apk add --no-cache git

# Instalamos n8n globalmente
RUN npm install -g n8n

WORKDIR /home/node/app

# Copiamos archivos de dependencias
COPY package*.json ./

# Instalamos las dependencias (ahora sí pasará el check de versión)
RUN npm install --omit=dev

# Copiamos el resto de archivos
COPY . .

# Permisos para el usuario node
RUN mkdir -p /home/node/.n8n && chown -R node:node /home/node

USER node

ENV PORT=10000
ENV N8N_PORT=10001
EXPOSE 10000

CMD ["node", "index_receptor.js"]
