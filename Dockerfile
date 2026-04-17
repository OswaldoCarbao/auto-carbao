# 1. Usamos la imagen de n8n (que ya tiene Node.js y todo lo básico)
FROM n8nio/n8n:latest

USER root

# 2. Saltamos la instalación de herramientas de sistema para evitar errores de compatibilidad
# n8n ya viene preparado para lo básico.

# 3. Carpeta de trabajo
WORKDIR /home/node/app

# 4. Copiamos tus archivos de CARBAO
COPY . .

# 5. Instalamos solo las librerías de tu receptor (Baileys, Axios, etc.)
RUN npm install

# 6. Puerto de Render
ENV N8N_PORT=10000
EXPOSE 10000

# 7. Arrancamos n8n y tu script
CMD ["sh", "-c", "n8n & node index_receptor.js"]
