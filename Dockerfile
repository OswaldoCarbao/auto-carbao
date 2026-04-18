# Versión de Node compatible
FROM node:20-alpine

# GIT para Baileys
RUN apk add --no-cache git

# Instalamos n8n globalmente
RUN npm install -g n8n

WORKDIR /home/node/app

# --- 1. CONFIGURACIÓN DE BASE DE DATOS (SUPABASE) ---
# Usamos los datos estándar que suelen funcionar mejor con Render
ENV DB_TYPE=postgresdb
ENV DB_POSTGRESDB_HOST=db.xldrtgtwonecxlfxcrat.supabase.co
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

# Copiamos el Workflow a una ruta segura
COPY Auto-Conta.json /home/node/workflow_carbao.json

# Permisos corregidos para el usuario node
RUN mkdir -p /home/node/.n8n && chown -R node:node /home/node && chown -R node:node /home/node/app

USER node
EXPOSE 10000

# Iniciamos directamente el script principal. 
# Importaremos el flujo manualmente una vez dentro para evitar errores de conexión al inicio.
CMD ["node", "index_receptor.js"]
