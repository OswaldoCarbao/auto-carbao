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
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';

// --- 1. CONFIGURACIÓN DEL SERVIDOR DE SALUD (Para Render) ---
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Sistema CARBAO Activo 🚀'));

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Servidor de salud escuchando en puerto ${port}`);
    
    // Una vez que el servidor de Render está feliz, arrancamos n8n y WhatsApp
    iniciarTodo();
});

// --- 2. LÓGICA DE ARRANQUE EN PARALELO ---
function iniciarTodo() {
    console.log("🚀 Iniciando n8n en segundo plano...");
    exec('n8n start', (err, stdout, stderr) => {
        if (err) console.error(`Error n8n: ${err}`);
        console.log(stdout);
    });

    startReceptor();
}

// --- 3. CONFIGURACIÓN WHATSAPP ---
const ID_GRUPO = '120363361803863216@g.us';
const PROCESADOS_FILE = './DATA/procesados.json';
const N8N_WEBHOOK = 'http://localhost:10001/webhook/071685b6-7efd-4353-9b9e-ce4594fd164e'; // OJO: puerto 10001 si n8n corre ahí

if (!fs.existsSync('./DATA')) fs.mkdirSync('./DATA');

let procesados = fs.existsSync(PROCESADOS_FILE) 
    ? JSON.parse(fs.readFileSync(PROCESADOS_FILE, 'utf-8')) 
    : [];

const queue = [];
let isProcessing = false;

function esNuevoMensaje(id) {
    if (!id) return false;
    if (!procesados.includes(id)) {
        procesados.push(id);
        if (procesados.length > 5000) procesados.shift(); 
        fs.writeFileSync(PROCESADOS_FILE, JSON.stringify(procesados));
        return true;
    }
    return false;
}

async function startReceptor() {
    console.log('🔍 [RECEPTOR] Iniciando vigilancia de comprobantes...');
    
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket.default({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Sistema Contabilidad CARBAO", "Chrome", "1.0.0"], 
        syncFullHistory: true,
        shouldSyncHistoryMessage: () => true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify' && type !== 'append') return;
        for (const m of messages) {
            const msgId = m.key?.id;
            const from = m.key?.remoteJid;
            const timestamp = m.messageTimestamp ? (m.messageTimestamp * 1000) : Date.now();
            const doceHorasAtras = Date.now() - (12 * 60 * 60 * 1000);

            if (from === ID_GRUPO && esNuevoMensaje(msgId) && timestamp > doceHorasAtras) {
                const content = m.message?.imageMessage || m.message?.documentMessage;
                if (content) {
                    console.log(`📥 Comprobante detectado (ID: ${msgId})`);
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
            const ext = m.message?.imageMessage ? 'jpg' : 'pdf';
            const fileName = `CARBAO_${Date.now()}.${ext}`;
            const type = m.message?.imageMessage ? 'image' : 'document';
            
            const stream = await downloadContentFromMessage(content, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            await axios.post(N8N_WEBHOOK, {
                fileName,
                fileData: buffer.toString('base64'),
                mimeType: content.mimetype,
                sender: m.pushName || 'Admin',
                msgId: m.key.id
            });
            console.log(`✅ ENVIADO A N8N: ${fileName}`);
        } catch (e) {
            console.error("❌ Error enviando a n8n:", e.message);
        }
        setTimeout(processQueue, 2000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('⚠️ [AVISO] ESCANEA EL QR EN LOS LOGS:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') console.log('✅ [WHATSAPP] Conectado y listo.');
        if (connection === 'close') {
            const shouldReconnect = (new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(startReceptor, 5000);
        }
    });
}
