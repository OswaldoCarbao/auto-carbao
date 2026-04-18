FROM n8nio/n8n:latest

# Volvemos a root para instalar lo que falta
USER root
WORKDIR /home/node/app

# Copiamos archivos de configuración
COPY package*.json ./

# Instalamos express (necesario para el health check del index) y las dependencias
RUN npm install express && npm install --omit=dev

# Copiamos el resto del código (incluyendo tu index corregido)
COPY . .

# Permisos para que n8n pueda escribir sus configs
RUN chown -R node:node /home/node/app

# Volvemos al usuario node por seguridad y para que los comandos funcionen
USER node

# Puertos
ENV PORT=10000
EXPOSE 10000

# Comando simple: node ya debería estar en el PATH del usuario node
CMD ["node", "index_receptor.js"]
