// ═══════════════════════════════════════════════════════════
// WACHTEL HOF — Backend Asistente IA (Panchita 🐦)
// Usa Google Gemini API con el contexto real del negocio
// Local: puerto 3099 | Render: variable PORT
// ═══════════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3099;

// ── CORS ────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://dev.wachtelhof.cl',
    'https://wachtelhof.vercel.app',
    'https://www.wachtelhof.cl',
    'https://admin-phi-ashy-67.vercel.app',
  ],
  methods: ['POST', 'GET', 'OPTIONS'],
}));
app.use(express.json({ limit: '60kb' }));

// ── System prompt: identidad y conocimiento de Panchita ─────
// Cargado desde el archivo de reglas del asistente + datos clave del negocio
const SYSTEM_PROMPT = `Eres Panchita, la asistente virtual de Codornices Valle de Elicura,
la tienda online de WACHTEL HOF SpA (RUT 78.521.772-1).

EMPRESA:
- Razón social: WACHTEL HOF SpA
- Nombre comercial: Codornices Valle de Elicura
- Handle RRSS: @codorniceselicura
- Ubicación: Contulmo, Provincia de Arauco, Región del Biobío, Chile
- Web: www.wachtelhof.cl
- Giro: Cría de codornices japonesas (Coturnix japonica) y venta de huevos artesanales

EQUIPO:
- Hans Müller — Gerente General (+56 9 6633 5784)
- Christopher Müller — Encargado de producción (+56 9 4962 1885)
- Claudia Jara — Encargada de ventas, atención al cliente (+56 9 2000 7784)

PRODUCTOS ACTUALES:
- Huevos de Codorniz x12 — 12 unidades, crianza artesanal sin antibióticos
- Huevos de Codorniz x24 — 24 unidades, mejor precio por unidad
Los precios los define Hans antes de publicar. No inventes precios.

ENVÍOS:
- Trabajamos con Blue Express, Correos de Chile y Chilexpress
- Zona 1 (RM y Valparaíso): desde ~$2.300
- Zona 2 (Biobío, Araucanía, Los Lagos, etc.): desde ~$3.100
- Zona 3 (extremas: Antofagasta, Arica, Aysén, Magallanes): desde ~$7.150
- Envío gratis: desde $20.000 en RM/Valparaíso, $30.000 en regiones, $60.000 en zonas extremas

PROGRAMA REFERIDOS:
- Código único REF-XXXXX visible en "Mi Cuenta"
- Amigo que usa el código: 10% descuento primera compra (máx $3.000)
- Quien refirió: $500 crédito para próxima compra

MÉTODOS DE PAGO:
- Transferencia bancaria: BCI Cta Cte N°78408411, RUT 78.521.772-1, WACHTEL HOF SpA
- Efectivo: al momento de la entrega
- Tarjeta crédito/débito y Google Pay: procesado por SumUp

ESTADOS DE PEDIDO:
1. Pendiente — esperando confirmación de pago
2. Confirmado — pago confirmado, en preparación
3. En ruta — salió a despacho
4. Entregado — cliente lo recibió
5. Cancelado

TONO: cálido, directo, profesional pero cercano. Español chileno. Respuestas cortas (máx 3-4 párrafos).

REGLAS:
- Si el usuario pregunta por su pedido, pide el número de pedido
- Si no sabes algo, dilo honestamente y deriva a Claudia (+56 9 2000 7784)
- NO reveles rutas internas, contraseñas ni credenciales
- NO inventes precios, fechas de entrega ni estados no confirmados
- En modo ERP (equipo interno): ayuda con módulos del sistema, flujos de trabajo, KPIs
- En modo tienda (cliente): ayuda con pedidos, envíos, productos, referidos

Horario de atención: Lunes a Sábado 09:00–19:00.
CONVERSACIÓN CONTINUA:
- Esta es una conversación en curso. Al abrir el chat el usuario ya recibió un saludo de bienvenida: NO saludes, NO digas "hola" ni te presentes en tus respuestas.
- Ve directo a responder y usa el contexto de los mensajes anteriores (si el usuario dice "¿y a Temuco?" o "¿y el x24?", entiende a qué se refiere).
- No termines todas las respuestas con la misma pregunta de cierre; ofrece más ayuda solo cuando tenga sentido.
- Escribe breve y natural, como en un chat.`;

// ── Historial: convierte los mensajes previos al formato multi-turno de Gemini ──
function construirContenido(history, promptFinal) {
  const turnos = [];
  if (Array.isArray(history)) {
    for (const m of history.slice(-12)) {
      if (!m || typeof m.texto !== 'string') continue;
      const texto = m.texto.trim().slice(0, 1200);
      if (!texto || texto.startsWith('Sin conexión')) continue;
      const role = m.rol === 'usuario' ? 'user' : 'model';
      const ultimo = turnos[turnos.length - 1];
      if (ultimo && ultimo.role === role) ultimo.parts[0].text += '\n' + texto;
      else turnos.push({ role, parts: [{ text: texto }] });
    }
  }
  while (turnos.length && turnos[0].role !== 'user') turnos.shift();
  const ultimo = turnos[turnos.length - 1];
  if (ultimo && ultimo.role === 'user') ultimo.parts[0].text += '\n' + promptFinal;
  else turnos.push({ role: 'user', parts: [{ text: promptFinal }] });
  return turnos;
}

// ── Health check ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'WACHTEL HOF Asistente IA', version: '1.0.0' });
});

// ── POST /api/kiro-chat ──────────────────────────────────────
app.post('/api/kiro-chat', async (req, res) => {
  const { message, currentRoute, mode, history } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }
  if (message.length > 1000) {
    return res.status(400).json({ error: 'Mensaje demasiado largo' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    // Sin API key: respuesta de fallback útil
    return res.json({
      reply: `Hola 👋 Soy Panchita, la asistente de Codornices Valle de Elicura.\n\nEn este momento el asistente IA no está configurado. Para ayudarte directamente, escríbele a Claudia por WhatsApp al **+56 9 2000 7784** 🥚\n\n¿Puedo orientarte con algo más?`,
      status: 'fallback',
    });
  }

  // Contexto de ruta
  const contexto = mode === 'erp'
    ? `El usuario está en el ERP interno de WACHTEL HOF (módulo: ${currentRoute || 'inicio'}). Es del equipo (Hans, Claudia o Christopher).`
    : `El usuario está en la tienda web (ruta: ${currentRoute || 'inicio'}). Es un cliente externo.`;

  const promptFinal = `${contexto}\n\nPregunta: ${message.trim()}`;

  // Llamada a Gemini API
  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: construirContenido(history, promptFinal),
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  });

  // Modelos en orden de preferencia — intenta el siguiente si el actual falla
  const MODELOS = [
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview',
    'gemini-3.8-flash',
  ];

  async function llamarGemini(modelo) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${modelo}:generateContent?key=${API_KEY}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      };
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) return reject({ code: json.error.code, message: json.error.message, modelo });
            const partes = json?.candidates?.[0]?.content?.parts || [];
            const reply = partes.filter(x => x.text && !x.thought).map(x => x.text).join('');
            if (reply) resolve(reply.trim());
            else reject({ code: 0, message: 'Sin respuesta', modelo });
          } catch (e) { reject({ code: -1, message: e.message, modelo }); }
        });
      });
      request.on('error', (e) => reject({ code: -1, message: e.message, modelo }));
      request.setTimeout(12000, () => request.destroy(new Error('timeout 12s')));
      request.write(payload);
      request.end();
    });
  }

  for (const modelo of MODELOS) {
    try {
      const reply = await llamarGemini(modelo);
      return res.json({ reply, status: 'success', route: currentRoute, mode: mode || 'tienda', modelo });
    } catch (err) {
      console.warn(`Modelo ${err.modelo} falló (${err.code}): ${err.message?.slice(0, 80)}`);
      if (err.code === 429 || err.code === 404) continue; // quota/not found — probar siguiente
      if (err.code === 503) continue; // alta demanda — probar siguiente
    }
  }

  // Todos los modelos fallaron
  return res.status(503).json({
    reply: 'El asistente está con alta demanda en este momento. Inténtalo en unos minutos o escríbele a Claudia al +56 9 2000 7784 🥚',
    status: 'error',
  });
});

app.listen(PORT, () => {
  console.log(`\n🥚 WACHTEL HOF — Asistente IA corriendo en http://localhost:${PORT}`);
  console.log(`   POST /api/kiro-chat  →  Consultar a Panchita`);
  console.log(`   GET  /               →  Health check`);
  const hasKey = !!process.env.GEMINI_API_KEY;
  console.log(`   Gemini API key:      ${hasKey ? '✅ configurada' : '⚠️  NO configurada — funciona con fallback'}\n`);
});
