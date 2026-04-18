# Versión de Node compatible
FROM node:20-alpine

# GIT para Baileys
RUN apk add --no-cache git

# Instalamos n8n globalmente
RUN npm install -g n8n

WORKDIR /home/node/app

# Copiamos archivos de dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiamos todo el proyecto
COPY . .

# Copiamos el Workflow específicamente con el nombre que espera el comando
COPY Auto-Conta.json /home/node/workflow_carbao.json

# Permisos
RUN mkdir -p /home/node/.n8n && chown -R node:node /home/node

# --- VARIABLES DE ENTORNO CRÍTICAS PARA EL PROXY ---
ENV PORT=10000
ENV N8N_PORT=10001
ENV N8N_PATH=/n8n/
ENV N8N_BASE_URL=https://auto-carbao.onrender.com/
ENV WEBHOOK_URL=https://auto-carbao.onrender.com/n8n/

USER node
EXPOSE 10000

# Importamos el flujo y arrancamos el script principal
CMD n8n import:workflow --input=/home/node/workflow_carbao.json && node index_receptor.js
