import express from 'express';
import { exec } from 'child_process';
import makeWASocket, { 
    useMultiFileAuthState, 
    downloadContentFromMessage, 
    fetchLatestBaileysVersion,
    DisconnectReason
} from '@whiskeysockets/baileys';
import fs from 'fs';
import axios from 'axios';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import QRCodeImage from 'qrcode';
import { Boom } from '@hapi/boom';
import httpProxy from 'http-proxy';

// --- 1. CONFIGURACIÓN DEL SERVIDOR Y PROXY ---
const app = express();
const proxy = httpProxy.createProxyServer({});
const port = process.env.PORT || 10000;
let ultimoQR = "";

// EL PUENTE MAESTRO: Redirige /n8n al puerto interno 10001
app.all('/n8n*', (req, res) => {
    proxy.web(req, res, { 
        target: 'http://localhost:10001',
        changeOrigin: true
    }, (e) => {
        console.error("Proxy error:", e.message);
        res.status(502).send("n8n de Carbao está despertando... recarga en 10 segundos.");
    });
});

app.get('/', (req, res) => res.send('Sistema CARBAO Activo 🚀 - Ve a /n8n para configurar o /qr para vincular'));

// RUTA PARA EL QR
app.get('/qr', async (req, res) => {
    if (!ultimoQR) {
        return res.send(`
            <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
                <h2>El QR aún no se genera o ya estás vinculado.</h2>
                <script>setTimeout(() => location.reload(), 5000);</script>
            </body>
        `);
    }
    try {
        const qrImage = await QRCodeImage.toDataURL(ultimoQR);
        res.send(`
            <html>
                <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f0f2f5;font-family:sans-serif;text-align:center;">
                    <h2>Vincular WhatsApp Consorcio Carbao</h2>
                    <img src="${qrImage}" style="border:10px solid white; box-shadow:0 4px 6px rgba(0,0,0,0.1); width:300px;">
                    <p>Escanea con el celular de la empresa</p>
                    <script>setTimeout(() => location.reload(), 20000);</script>
                </body>
            </html>
        `);
    } catch (err) { res.status(500).send("Error QR"); }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Servidor CARBAO en puerto ${port}`);
    iniciarTodo();
});

// --- 2. LÓGICA DE ARRANQUE ---
function iniciarTodo() {
    console.log("🚀 Iniciando n8n...");
    // Importante: n8n hereda las variables de entorno del Dockerfile automáticamente
    exec('n8n start', (err, stdout, stderr) => {
        if (err) console.error(`Error n8n: ${err}`);
    });
    startReceptor();
}

// --- 3. WHATSAPP (Lógica de Carbao) ---
const ID_GRUPO = '120363361803863216@g.us';
const PROCESADOS_FILE = './DATA/procesados.json';
const N8N_WEBHOOK = 'http://localhost:10001/n8n/webhook/071685b6-7efd-4353-9b9e-ce4594fd164e'; 

if (!fs.existsSync('./DATA')) fs.mkdirSync('./DATA');
let procesados = fs.existsSync(PROCESADOS_FILE) ? JSON.parse(fs.readFileSync(PROCESADOS_FILE, 'utf-8')) : [];
const queue = [];
let isProcessing = false;

function esNuevoMensaje(id) {
    if (!id || procesados.includes(id)) return false;
    procesados.push(id);
    if (procesados.length > 5000) procesados.shift();
    fs.writeFileSync(PROCESADOS_FILE, JSON.stringify(procesados));
    return true;
}

async function startReceptor() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Sistema Carbao", "Chrome", "1.0.0"],
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const m of messages) {
            if (m.key.remoteJid === ID_GRUPO && esNuevoMensaje(m.key.id)) {
                if (m.message?.imageMessage || m.message?.documentMessage) {
                    queue.push(m);
                    if (!isProcessing) processQueue();
                }
            }
        }
    });

    async function processQueue() {
        if (queue.length === 0) { isProcessing = false; return; }
        isProcessing = true;
        const m = queue.shift();
        const content = m.message?.imageMessage || m.message?.documentMessage;
        try {
            const type = m.message?.imageMessage ? 'image' : 'document';
            const stream = await downloadContentFromMessage(content, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            await axios.post(N8N_WEBHOOK, {
                fileName: `CARBAO_${Date.now()}`,
                fileData: buffer.toString('base64'),
                mimeType: content.mimetype,
                sender: m.pushName || 'User'
            });
            console.log("✅ Documento enviado a n8n");
        } catch (e) { console.error("❌ Error en cola:", e.message); }
        setTimeout(processQueue, 2000);
    }

    sock.ev.on('connection.update', (u) => {
        if (u.qr) ultimoQR = u.qr;
        if (u.connection === 'open') {
            ultimoQR = "";
            console.log('✅ Conectado a WhatsApp');
        }
        if (u.connection === 'close') {
            if ((new Boom(u.lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(startReceptor, 5000);
            }
        }
    });
}
