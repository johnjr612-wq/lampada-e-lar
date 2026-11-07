// Servidor de assinaturas do Lâmpada e Lar (Cloudflare Worker + KV).
// Rotas:
//   POST /webhook   -> recebe os avisos da Hotmart (compra aprovada, cancelamento, reembolso...)
//   GET  /verificar?email=...  -> o app pergunta se esse e-mail tem assinatura ativa
//
// Variáveis (configure no painel da Cloudflare, em Settings > Variables):
//   HOTTOK          (obrigatória) token da sua conta Hotmart, para provar que o aviso veio de lá
//   PRODUCT_ID      (opcional)    ID do produto na Hotmart; avisos de outros produtos são ignorados
//   DIAS            (opcional)    dias liberados a cada pagamento aprovado (padrão 35, para plano mensal)
//   ALLOWED_ORIGIN  (opcional)    endereço do seu site, ex.: https://lampadaelar.com.br
// Armazenamento: um KV chamado ASSINATURAS (veja o README).

const ATIVAM = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'];
const REVOGAM = ['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK'];
const CANCELAM = ['SUBSCRIPTION_CANCELLATION', 'PURCHASE_CANCELED'];

const dia = (ms) => new Date(ms).toISOString().slice(0, 10);
const json = (obj, status, cors) =>
  new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json', ...cors } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/webhook' && req.method === 'POST') return webhook(req, env, cors);
    if (url.pathname === '/verificar' && req.method === 'GET') return verificar(url, env, cors);
    return new Response('Lâmpada e Lar: servidor no ar.', { headers: cors });
  },
};

async function webhook(req, env, cors) {
  const token = req.headers.get('X-HOTMART-HOTTOK');
  if (!env.HOTTOK || token !== env.HOTTOK) return json({ erro: 'não autorizado' }, 401, cors);

  let corpo;
  try { corpo = await req.json(); } catch (_) { return json({ erro: 'json inválido' }, 400, cors); }
  const evento = corpo.event;
  const d = corpo.data || {};

  if (env.PRODUCT_ID && String((d.product || {}).id) !== String(env.PRODUCT_ID)) return json({ ok: true, ignorado: 'outro produto' }, 200, cors);

  const email = String((d.buyer || {}).email || (d.subscriber || {}).email || (d.user || {}).email || '').trim().toLowerCase();
  if (!email) return json({ ok: true, ignorado: 'sem e-mail' }, 200, cors);

  const chave = 'sub:' + email;
  const atual = JSON.parse((await env.ASSINATURAS.get(chave)) || 'null');
  const agora = Date.now();
  const dias = Number(env.DIAS) || 35;

  if (ATIVAM.includes(evento)) {
    const novo = dia(agora + dias * 864e5);
    const ate = atual && atual.ate && atual.ate > novo ? atual.ate : novo;
    await env.ASSINATURAS.put(chave, JSON.stringify({ ate, status: 'ativa', atualizado: dia(agora) }));
  } else if (REVOGAM.includes(evento)) {
    await env.ASSINATURAS.put(chave, JSON.stringify({ ate: dia(agora - 864e5), status: 'revogada', atualizado: dia(agora) }));
  } else if (CANCELAM.includes(evento) && atual) {
    // cancelou: continua valendo até o fim do período já pago
    await env.ASSINATURAS.put(chave, JSON.stringify({ ...atual, status: 'cancelada', atualizado: dia(agora) }));
  }
  return json({ ok: true }, 200, cors);
}

async function verificar(url, env, cors) {
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  if (!email || email.length > 200) return json({ ok: false }, 200, cors);
  const reg = JSON.parse((await env.ASSINATURAS.get('sub:' + email)) || 'null');
  const ok = !!(reg && reg.status !== 'revogada' && reg.ate >= dia(Date.now()));
  return json(ok ? { ok: true, ate: reg.ate } : { ok: false }, 200, cors);
}
