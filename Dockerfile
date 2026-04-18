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
COPY workflow_carbao.json /home/node/workflow_carbao.json
# Modificamos el comando de inicio para que importe el archivo antes de arrancar todo
CMD n8n import:workflow --input=/home/node/workflow_carbao.json && node index_receptor.js
