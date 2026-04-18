# Versión de Node compatible
FROM node:20-alpine

# GIT para Baileys
RUN apk add --no-cache git

# Instalamos n8n globalmente
RUN npm install -g n8n

WORKDIR /home/node/app
ENV PORT=10000
ENV N8N_PORT=10001
ENV N8N_PATH=/n8n/

# Estas 3 líneas obligan a n8n a usar la URL de Render en lugar de localhost
ENV N8N_PROTOCOL=https
ENV N8N_HOST=auto-carbao.onrender.com
ENV WEBHOOK_URL=https://auto-carbao.onrender.com/n8n/
ENV N8N_BASE_URL=https://auto-carbao.onrender.com/

# Copiamos archivos de dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiamos todo el proyecto
COPY . .

# Copiamos el Workflow específicamente
COPY Auto-Conta.json /home/node/workflow_carbao.json

# Permisos para el usuario node
RUN mkdir -p /home/node/.n8n && chown -R node:node /home/node

# --- VARIABLES DE ENTORNO CRÍTICAS ---
ENV PORT=10000
ENV N8N_PORT=10001
ENV N8N_PATH=/n8n/
# Esta URL es la que n8n usará para generar sus propios links internos
ENV N8N_BASE_URL=https://auto-carbao.onrender.com/
ENV N8N_WEBHOOK_URL=https://auto-carbao.onrender.com/n8n/

USER node
EXPOSE 10000

# Importamos el flujo y arrancamos el script principal
CMD n8n import:workflow --input=/home/node/workflow_carbao.json && node index_receptor.js
