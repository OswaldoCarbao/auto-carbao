# Versión de Node compatible
FROM node:20-alpine

# GIT para Baileys
RUN apk add --no-cache git

# Instalamos n8n globalmente
RUN npm install -g n8n

WORKDIR /home/node/app

# --- 1. CONFIGURACIÓN DE BASE DE DATOS (SUPABASE) ---
ENV DB_TYPE=postgresdb
ENV DB_POSTGRESDB_HOST=db.xldrtgtwonecxlfxcrat.supabase.co
ENV DB_POSTGRESDB_PORT=5432
ENV DB_POSTGRESDB_DATABASE=postgres
ENV DB_POSTGRESDB_USER=postgres
ENV DB_POSTGRESDB_PASSWORD=LJyt.NWXX5p!R2b

# --- 2. CONFIGURACIÓN DE RED Y SEGURIDAD ---
ENV PORT=10000
ENV N8N_PORT=10001
ENV N8N_PATH=/n8n/
ENV N8N_PROTOCOL=https
ENV N8N_HOST=auto-carbao.onrender.com
ENV N8N_BASE_URL=https://auto-carbao.onrender.com/
ENV N8N_WEBHOOK_URL=https://auto-carbao.onrender.com/n8n/

# Una llave fija para que n8n no se confunda al reiniciar
ENV N8N_ENCRYPTION_KEY=carbao_2026_safe_key

# --- 3. ARCHIVOS Y PERMISOS ---
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
COPY Auto-Conta.json /home/node/workflow_carbao.json

# Aseguramos que el usuario node tenga control TOTAL
RUN mkdir -p /home/node/.n8n && \
    chown -R node:node /home/node && \
    chmod -R 777 /home/node/.n8n

USER node
EXPOSE 10000

# Usamos un comando de inicio que nos muestre errores detallados si falla
CMD ["sh", "-c", "n8n start --tunnel && node index_receptor.js"]
