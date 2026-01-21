async function sendBooking(payload){
  const res = await fetch("/api/send-booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if(!res.ok){
    const t = await res.text().catch(()=>"");
    let msg = "";
    try{
      const j = JSON.parse(t);
      if(j && typeof j.error === "string") msg = j.error;
    }catch(_e){
      // ignore
    }

    if(msg === "NOT_CONFIGURED"){
      throw new Error(getT("booking_unavailable") || "Online booking is temporarily unavailable.");
    }
    throw new Error(msg || t || `Request failed: ${res.status}`);
  }
}

function getT(key){
  const lang = getLang();
  const dict = (window.I18N && window.I18N[lang]) ? window.I18N[lang] : (window.I18N ? window.I18N.az : null);
  return (dict && typeof dict[key] === "string") ? dict[key] : "";
}

function showNotice(kind, text){
  const el = document.getElementById("formNotice");
  if(!el) return;
  el.style.display = "block";
  el.classList.remove("ok","err");
  el.classList.add(kind);
  el.textContent = text;

  requestAnimationFrame(()=>{
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  });
}

function setLoading(isLoading){
  const btn = document.getElementById("submitBtn");
  if(!btn) return;
  btn.disabled = isLoading;
  btn.style.opacity = isLoading ? "0.7" : "1";
}

function sanitizePhone(v){
  let s = String(v || "");
  s = s.replace(/[^0-9+]/g, "");
  s = s.replace(/\++/g, "+");
  if(s.includes("+")){
    s = "+" + s.replace(/\+/g, "");
  }
  return s;
}

function sanitizeDigits(v){
  return String(v || "").replace(/\D/g, "");
}

function sanitizeName(v){
  let s = String(v || "");
  s = s.replace(/[^\p{L} \-']/gu, "");
  s = s.replace(/\s+/g, " ");
  return s.trimStart();
}

function getLang(){
  return localStorage.getItem("lang") || "az";
}

function initPickers(form){
  if(typeof window.flatpickr !== "function") return;

  const dateInput = form.querySelector("input[name='date']");
  if(dateInput){
    dateInput.setAttribute("readonly", "readonly");
    window.flatpickr(dateInput, {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d.m.Y",
      allowInput: false
    });
  }
}

function pad2(n){
  return String(n).padStart(2, "0");
}

function buildTimeOptions(){
  const out = [];
  for(let h = 10; h <= 22; h++){
    for(let m = 0; m < 60; m += 15){
      if(h === 22 && m > 0) break;
      out.push(`${pad2(h)}:${pad2(m)}`);
    }
  }
  return out;
}

function initTimeSelect(form){
  const sel = form.querySelector("select[name='time']");
  if(!sel) return;
  sel.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "";
  placeholder.selected = true;
  sel.appendChild(placeholder);

  buildTimeOptions().forEach((t)=>{
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
}

function initBooking(){
  const form = document.getElementById("bookingForm");
  if(!form) return;

  window.addEventListener("langchange", ()=>{
    const notice = document.getElementById("formNotice");
    if(!notice || notice.style.display === "none") return;

    if(notice.classList.contains("ok")){
      notice.textContent = getT("ok_sent") || notice.textContent;
      return;
    }

    if(notice.classList.contains("err")){
      notice.textContent = getT("err_send") || notice.textContent;
    }
  });

  initPickers(form);
  initTimeSelect(form);

  const phoneInput = form.querySelector("input[name='phone']");
  const guestsInput = form.querySelector("input[name='guests']");
  const nameInput = form.querySelector("input[name='name']");

  phoneInput?.addEventListener("input", ()=>{
    const next = sanitizePhone(phoneInput.value);
    if(next !== phoneInput.value) phoneInput.value = next;
  });

  guestsInput?.addEventListener("input", ()=>{
    const next = sanitizeDigits(guestsInput.value);
    if(next !== guestsInput.value) guestsInput.value = next;
  });

  nameInput?.addEventListener("input", ()=>{
    const next = sanitizeName(nameInput.value);
    if(next !== nameInput.value) nameInput.value = next;
  });

  const COOLDOWN_MS = 30_000;
  let lastSubmitAt = 0;

  const requiredFields = [
    { key: "name", labelKey: "field_name" },
    { key: "phone", labelKey: "field_phone" },
    { key: "date", labelKey: "field_date" },
    { key: "time", labelKey: "field_time" },
    { key: "guests", labelKey: "field_guests" }
  ];

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const now = Date.now();
    if(lastSubmitAt && (now - lastSubmitAt) < COOLDOWN_MS){
      showNotice("err", getT("err_send") || "Please try again later.");
      return;
    }

    const fd = new FormData(form);
    const payload = {
      lang: getLang(),
      name: sanitizeName(String(fd.get("name") || "").trim()),
      phone: sanitizePhone(String(fd.get("phone") || "").trim()),
      date: String(fd.get("date") || "").trim(),
      time: String(fd.get("time") || "").trim(),
      guests: sanitizeDigits(String(fd.get("guests") || "").trim()),
      message: String(fd.get("message") || "").trim(),
      company: String(fd.get("company") || "").trim()
    };

    const missing = [];
    requiredFields.forEach((f)=>{
      if(!payload[f.key]) missing.push(getT(f.labelKey) || f.key);
    });

    if(missing.length){
      const prefix = getT("err_missing_prefix") || "Please fill:";
      const base = getT("err_fill_all") || "Please fill in all required fields.";
      showNotice("err", `${base}\n${prefix} ${missing.join(", ")}`);
      return;
    }

    setLoading(true);
    try{
      await sendBooking(payload);
      lastSubmitAt = Date.now();
      showNotice("ok", getT("ok_sent") || "Sent");
      form.reset();
      initTimeSelect(form);
    }catch(_err){
      const msg = _err && _err.message ? String(_err.message) : "";
      showNotice("err", msg || (getT("err_send") || "Error"));
    }finally{
      setLoading(false);
    }
  });
}

document.addEventListener("DOMContentLoaded", initBooking);
