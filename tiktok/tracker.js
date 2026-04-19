/* ============================================================
   PAGE TRACKER v4 — Cole antes de </body> em cada página
   Horário: UTC-3 (São Paulo / Brasília)
   Geo: serviços com CORS liberado
   ============================================================ */

var TRACKER_URL   = "https://autmmzsfqtjywdyrknxc.supabase.co";
var TRACKER_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1dG1tenNmcXRqeXdkeXJrbnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTQwMjgsImV4cCI6MjA5MDU5MDAyOH0.e57qWX2_iulc8VA4Z5Cbd7mLP3RV1z-dUe-dmjdAbZ0";
var TRACKER_TABLE = "page_visits";

/* ── IDs persistentes ── */
function _sid() {
  var k = "_t_sid", v = sessionStorage.getItem(k);
  if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(k, v); }
  return v;
}
function _vid() {
  var k = "_t_vid", v;
  try { v = localStorage.getItem(k); } catch(e) {}
  if (!v) {
    v = "v" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem(k, v); } catch(e) {}
  }
  return v;
}

/* ── Horário Brasília (UTC-3) ── */
function _brTime(date) {
  var offsetMs = -3 * 60 * 60 * 1000;
  var brDate   = new Date(date.getTime() + offsetMs);
  var pad = function(n) { return String(n).padStart(2, "0"); };
  return {
    iso:       brDate.getUTCFullYear()
               + "-" + pad(brDate.getUTCMonth() + 1)
               + "-" + pad(brDate.getUTCDate())
               + "T" + pad(brDate.getUTCHours())
               + ":" + pad(brDate.getUTCMinutes())
               + ":" + pad(brDate.getUTCSeconds())
               + "-03:00",
    hour:      brDate.getUTCHours(),
    dayOfWeek: brDate.getUTCDay()
  };
}

/* ── Detecta país — apenas serviços com CORS liberado ── */
async function _geo() {

  /* 1. Cloudflare trace — funciona em qualquer site, sem bloqueio */
  try {
    var r = await fetch("https://cloudflare.com/cdn-cgi/trace", { cache: "no-store" });
    if (r.ok) {
      var text = await r.text();
      /* Formato: chave=valor\n por linha. Extrai "loc" e "ip" */
      var loc  = (text.match(/loc=([A-Z]{2})/)  || [])[1];
      if (loc && loc !== "XX" && loc !== "T1") {
        /* Resolve nome do país pelo código usando a API do Restcountries */
        var name = await _countryName(loc);
        return { country_code: loc, country_name: name, city: "" };
      }
    }
  } catch(e) {}

  /* 2. db-ip.com — CORS aberto, plano gratuito */
  try {
    var r2 = await fetch("https://api.db-ip.com/v2/free/self", { cache: "no-store" });
    if (r2.ok) {
      var d2 = await r2.json();
      if (d2.countryCode && d2.countryCode !== "ZZ") {
        return {
          country_code: d2.countryCode,
          country_name: d2.countryName || d2.countryCode,
          city:         d2.city || ""
        };
      }
    }
  } catch(e) {}

  /* 3. geojs.io — CORS liberado */
  try {
    var r3 = await fetch("https://get.geojs.io/v1/ip/country.json", { cache: "no-store" });
    if (r3.ok) {
      var d3 = await r3.json();
      if (d3.country_3 || d3.country) {
        var code = d3.country || "??";
        var name = await _countryName(code);
        return { country_code: code, country_name: name, city: "" };
      }
    }
  } catch(e) {}

  return { country_code: "??", country_name: "Unknown", city: "" };
}

/* ── Resolve nome do país pelo código ISO (ex: BR → Brazil) ── */
async function _countryName(code) {
  var names = {
    BR:"Brasil", US:"Estados Unidos", PT:"Portugal", AR:"Argentina",
    MX:"México", CO:"Colômbia", CL:"Chile", PE:"Peru", UY:"Uruguai",
    GB:"Reino Unido", DE:"Alemanha", FR:"França", ES:"Espanha",
    IT:"Itália", NL:"Holanda", JP:"Japão", CN:"China", IN:"Índia",
    CA:"Canadá", AU:"Austrália", RU:"Rússia", ZA:"África do Sul",
    NG:"Nigéria", KE:"Quênia", AO:"Angola", MZ:"Moçambique"
  };
  if (names[code]) return names[code];
  /* Tenta buscar da API se não estiver no mapa */
  try {
    var r = await fetch("https://restcountries.com/v3.1/alpha/" + code + "?fields=name", { cache: "force-cache" });
    if (r.ok) {
      var d = await r.json();
      return (d.name && d.name.common) ? d.name.common : code;
    }
  } catch(e) {}
  return code;
}

/* ── Envia registro ── */
async function _track() {
  var geo = await _geo();
  var br  = _brTime(new Date());

  var payload = {
    session_id:    _sid(),
    visitor_id:    _vid(),
    page_url:      window.location.href,
    page_path:     window.location.pathname,
    page_title:    document.title || window.location.pathname,
    referrer:      document.referrer || null,
    user_agent:    navigator.userAgent,
    screen_width:  screen.width,
    screen_height: screen.height,
    language:      navigator.language || null,
    country_code:  geo.country_code,
    country_name:  geo.country_name,
    city:          geo.city,
    visited_at:    br.iso,
    hour_of_day:   br.hour,
    day_of_week:   br.dayOfWeek,
    time_zone:     "America/Sao_Paulo"
  };

  var endpoint = TRACKER_URL + "/rest/v1/" + TRACKER_TABLE;
  try {
    var res = await fetch(endpoint, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        TRACKER_KEY,
        "Authorization": "Bearer " + TRACKER_KEY,
        "Prefer":        "return=minimal"
      },
      body:      JSON.stringify(payload),
      keepalive: true
    });
    if (!res.ok) {
      var err = await res.text();
      console.warn("[Tracker] Erro ao enviar:", res.status, err);
    } else {
      console.log("[Tracker] ✅ Registrado:", payload.page_path,
                  "| País:", geo.country_name + " (" + geo.country_code + ")",
                  "| Hora Brasília:", br.hour + "h");
    }
  } catch(e) {
    console.warn("[Tracker] Falha na requisição:", e.message);
  }
}

/* ── Inicializa ── */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", _track);
} else {
  _track();
}
