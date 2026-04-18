# Versión de Node compatible
FROM node:20-alpine

# GIT para Baileys
RUN apk add --no-cache git

# Instalamos n8n globalmente
RUN npm install -g n8n

WORKDIR /home/node/app

# --- 1. CONFIGURACIÓN DE BASE DE DATOS (SUPABASE) ---
# Esto evita que n8n pierda la memoria cada vez que Render se reinicia
ENV DB_TYPE=postgresdb
ENV DB_POSTGRESDB_HOST=aws-0-sa-east-1.pooler.supabase.com
ENV DB_POSTGRESDB_PORT=5432
ENV DB_POSTGRESDB_DATABASE=postgres
ENV DB_POSTGRESDB_USER=postgres
ENV DB_POSTGRESDB_PASSWORD=LJyt.NWXX5p!R2b

# --- 2. CONFIGURACIÓN DE RED Y PROXY ---
ENV PORT=10000
ENV N8N_PORT=10001
ENV N8N_PATH=/n8n/
ENV N8N_PROTOCOL=https
ENV N8N_HOST=auto-carbao.onrender.com
ENV N8N_BASE_URL=https://auto-carbao.onrender.com/
ENV N8N_WEBHOOK_URL=https://auto-carbao.onrender.com/n8n/

# Copiamos archivos de dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiamos todo el proyecto
COPY . .

# Copiamos el Workflow específicamente para la importación inicial
COPY Auto-Conta.json /home/node/workflow_carbao.json

# Permisos para el usuario node
RUN mkdir -p /home/node/.n8n && chown -R node:node /home/node

USER node
EXPOSE 10000

# Importamos el flujo a la base de datos y arrancamos el script principal (WhatsApp + n8n)
CMD n8n import:workflow --input=/home/node/workflow_carbao.json && node index_receptor.js
