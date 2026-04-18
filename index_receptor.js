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

// EL PUENTE MAESTRO REFORZADO (Para evitar el Cannot GET)
app.all('/n8n*', (req, res) => {
    // 1. Limpiamos la URL para el n8n interno (quitamos el prefijo /n8n)
    let newUrl = req.url.replace(/^\/n8n/, '');
    if (newUrl === '') newUrl = '/';
    req.url = newUrl;

    // 2. Redirigimos al puerto 10001 con changeOrigin habilitado
    proxy.web(req, res, { 
        target: 'http://localhost:10001',
        changeOrigin: true,
        ws: true // Habilita WebSockets para evitar que salga "Offline"
    }, (e) => {
        console.error("Proxy error:", e.message);
        res.status(502).send("El motor de n8n está despertando... recarga en 10 segundos.");
    });
});

app.get('/', (req, res) => res.send('Sistema CARBAO Activo 🚀 - Ve a /n8n/ para configurar o /qr para vincular WhatsApp'));

// RUTA PARA EL QR
app.get('/qr', async (req, res) => {
    if (!ultimoQR) {
        return res.send(`
            <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
                <h2>Esperando que WhatsApp genere el código...</h2>
                <p>Si ya escaneaste, el sistema de Carbao ya está activo.</p>
                <script>setTimeout(()=>location.reload(),5000)</script>
            </body>
        `);
    }
    try {
        const qrImage = await QRCodeImage.toDataURL(ultimoQR);
        res.send(`
            <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f0f2f5;font-family:sans-serif;text-align:center;">
                <div style="background:white;padding:40px;border-radius:20px;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
                    <h2 style="color:#1a73e8;">Vincular WhatsApp CARBAO</h2>
                    <img src="${qrImage}" style="width:300px; border:5px solid #eee; border-radius:10px;">
                    <p style="margin-top:20px;color:#666;">Abre WhatsApp > Dispositivos vinculados > Vincular.</p>
                </div>
                <script>setTimeout(() => location.reload(), 20000);</script>
            </body>
        `);
    } catch (err) { res.status(500).send("Error QR"); }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Servidor CARBAO en puerto ${port}`);
    iniciarTodo();
});

// --- 2. LÓGICA DE ARRANQUE ---
function iniciarTodo() {
    console.log("🚀 Iniciando n8n en segundo plano...");
    exec('n8n start', (err, stdout, stderr) => {
        if (err) console.error(`Error crítico n8n: ${err}`);
    });
    startReceptor();
}

// --- 3. WHATSAPP RECEPTOR ---
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
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const m of messages) {
            if (m.key.remoteJid === ID_GRUPO && esNuevoMensaje(m.key.id)) {
                if (m.message?.imageMessage || m.message?.documentMessage) {
                    console.log("📥 Nuevo comprobante detectado...");
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
                sender: m.pushName || 'Colaborador Carbao'
            });
            console.log("✅ Documento procesado y enviado a n8n");
        } catch (e) { 
            console.error("❌ Error enviando a n8n:", e.message); 
        }
        setTimeout(processQueue, 2000);
    }

    sock.ev.on('connection.update', (u) => {
        if (u.qr) ultimoQR = u.qr;
        if (u.connection === 'open') {
            ultimoQR = "";
            console.log('✅ WhatsApp vinculado correctamente!');
        }
        if (u.connection === 'close') {
            if ((new Boom(u.lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(startReceptor, 5000);
            }
        }
    });
}
