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

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequest(context) {
  // Handle OPTIONS request for CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Only allow POST requests
  if (context.request.method !== 'POST') {
    return json({ 
      ok: false, 
      error: "Method not allowed. Please use POST method." 
    }, 405);
  }

  const token = context.env && context.env.TELEGRAM_BOT_TOKEN;
  const chatId = context.env && context.env.TELEGRAM_CHAT_ID;

  let payload;
  try {
    payload = await context.request.json();
  } catch (_err) {
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
    return json({ 
      ok: false, 
      error: "Too many requests. Please try again later." 
    }, 429);
  }

  const required = ["name", "phone", "date", "time", "guests"];
  const missing = required.filter(k => !(payload && String(payload[k] ?? "").trim()));
  if(missing.length > 0){
    const missingFields = missing.map(f => {
      switch(f) {
        case 'name': return getTranslatedField('field_name', context);
        case 'phone': return getTranslatedField('field_phone', context);
        case 'date': return getTranslatedField('field_date', context);
        case 'time': return getTranslatedField('field_time', context);
        case 'guests': return getTranslatedField('field_guests', context);
        default: return f;
      }
    });
    
    return json({ 
      ok: false, 
      error: `${getTranslatedField('err_missing_prefix', context)}: ${missingFields.join(', ')}` 
    }, 400);
  }

  const text = buildMessage(payload);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        parse_mode: "HTML"
      })
    });

    if(!res.ok){
      const errorText = await res.text().catch(() => "Unknown error");
      console.error('Telegram API error:', errorText);
      return json({ 
        ok: false, 
        error: "Failed to send message. Please try again later." 
      }, 502);
    }

    return json({ ok: true });
  } catch(err) {
    console.error('Error sending message to Telegram:', err);
    return json({ 
      ok: false, 
      error: "An unexpected error occurred. Please try again later." 
    }, 500);
  }
}

// Helper function to get translated field names for error messages
function getTranslatedField(field, context) {
  // Default translations in case we can't determine the language
  const defaultTranslations = {
    'field_name': 'Name',
    'field_phone': 'Phone',
    'field_date': 'Date',
    'field_time': 'Time',
    'field_guests': 'Number of guests',
    'err_missing_prefix': 'Please fill in'
  };
  
  // Try to get the language from the request headers or URL
  const acceptLanguage = context.request.headers.get('accept-language') || '';
  let lang = 'en';
  
  if (acceptLanguage.includes('az')) {
    lang = 'az';
  } else if (acceptLanguage.includes('ru')) {
    lang = 'ru';
  }
  
  // In a real implementation, you would use your i18n system here
  // This is a simplified version
  const translations = {
    'az': {
      'field_name': 'Ad',
      'field_phone': 'Telefon',
      'field_date': 'Tarix',
      'field_time': 'Saat',
      'field_guests': 'Qonaq sayı',
      'err_missing_prefix': 'Zəhmət olmasa doldurun'
    },
    'ru': {
      'field_name': 'Имя',
      'field_phone': 'Телефон',
      'field_date': 'Дата',
      'field_time': 'Время',
      'field_guests': 'Количество гостей',
      'err_missing_prefix': 'Пожалуйста, заполните'
    },
    'en': defaultTranslations
  };
  
  return translations[lang]?.[field] || defaultTranslations[field] || field;
}
