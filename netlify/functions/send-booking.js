function buildMessage(data){
  const safe = (v)=>{
    const s = String(v ?? "").trim();
    return s ? s : "-";
  };

  const formatDate = (v)=>{
    const s = String(v ?? "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m) return `${m[3]}.${m[2]}.${m[1]}`;
    return s ? s : "-";
  };

  const normalizeLang = (v)=>{
    const s = String(v ?? "").trim().toLowerCase();
    if(s === "az") return "AZ";
    if(s === "ru") return "RU";
    if(s === "en") return "EN";
    return s ? s.toUpperCase() : "-";
  };

  const lines = [
    "📌 Yeni masa bronu",
    `🌐 Dil: ${normalizeLang(data.lang)}`,
    `👤 Ad: ${safe(data.name)}`,
    `📅 Tarix: ${formatDate(data.date)}`,
    `⏰ Saat: ${safe(data.time)}`,
    `👥 Qonaq sayı: ${safe(data.guests)}`,
    `📞 Telefon: ${safe(data.phone)}`,
    `📝 Mesaj: ${safe(data.message)}`
  ];

  return lines.join("\n");
}

const RATE = {
  windowMs: 10 * 60 * 1000,
  max: 3
};

const hitsByIp = new Map();

function getClientIp(event){
  const h = event.headers || {};
  const direct = h["x-nf-client-connection-ip"] || h["X-Nf-Client-Connection-Ip"];
  if(direct) return String(direct).trim();
  const fwd = h["x-forwarded-for"] || h["X-Forwarded-For"];
  if(!fwd) return "";
  return String(fwd).split(",")[0].trim();
}

function isRateLimited(ip){
  if(!ip) return false;
  const now = Date.now();
  const cutoff = now - RATE.windowMs;
  const list = hitsByIp.get(ip) || [];
  const next = list.filter((t)=>t >= cutoff);
  if(next.length >= RATE.max){
    hitsByIp.set(ip, next);
    return true;
  }
  next.push(now);
  hitsByIp.set(ip, next);
  return false;
}

exports.handler = async (event)=>{
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if(event.httpMethod === "OPTIONS"){
    return { statusCode: 200, headers, body: "" };
  }

  if(event.httpMethod !== "POST"){
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if(!token || !chatId){
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Server is not configured" }) };
  }

  let payload;
  try{
    payload = JSON.parse(event.body || "{}");
  }catch(_err){
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Invalid JSON" }) };
  }

  if(payload && payload.company){
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  const ip = getClientIp(event);
  if(isRateLimited(ip)){
    return { statusCode: 429, headers, body: JSON.stringify({ ok: false, error: "Too many requests" }) };
  }

  const required = ["name","phone","date","time","guests"];
  const missing = required.filter((k)=>!(payload && String(payload[k] ?? "").trim()));
  if(missing.length){
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: `Missing required fields: ${missing.join(", ")}` }) };
  }

  const text = buildMessage(payload);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try{
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });

    if(!res.ok){
      const t = await res.text().catch(()=>"");
      return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: t || `Telegram error: ${res.status}` }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }catch(err){
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }) };
  }
};
