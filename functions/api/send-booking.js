function buildMessage(data){
  const safe = (v)=>{
    const s = String(v ?? "").trim();
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
    `📅 Tarix: ${safe(data.date)}`,
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

function getClientIp(request){
  const h = request.headers;

  const cf = h.get("CF-Connecting-IP");
  if(cf) return String(cf).trim();

  const fwd = h.get("X-Forwarded-For");
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

function json(body, status = 200){
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}

export async function onRequestOptions(){
  return new Response("", {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}

export async function onRequestPost(context){
  const token = context.env && context.env.TELEGRAM_BOT_TOKEN;
  const chatId = context.env && context.env.TELEGRAM_CHAT_ID;

  let payload;
  try{
    payload = await context.request.json();
  }catch(_err){
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  if(!token || !chatId){
    return json({ ok: false, error: "NOT_CONFIGURED" }, 503);
  }

  if(payload && payload.company){
    return json({ ok: true }, 200);
  }

  const ip = getClientIp(context.request);
  if(isRateLimited(ip)){
    return json({ ok: false, error: "Too many requests" }, 429);
  }

  const required = ["name","phone","date","time","guests"];
  const missing = required.filter((k)=>!(payload && String(payload[k] ?? "").trim()));
  if(missing.length){
    return json({ ok: false, error: `Missing required fields: ${missing.join(", ")}` }, 400);
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
      return json({ ok: false, error: t || `Telegram error: ${res.status}` }, 502);
    }

    return json({ ok: true }, 200);
  }catch(err){
    return json({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}
