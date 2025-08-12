/* ==== CONFIG ==== */
const TIMER_SECONDS = 10;          // durasi hitung mundur
const COOLDOWN_SECONDS = 10;       // hanya untuk tampilan "Next claim"

/* ==== ELEMENTS ==== */
const $ = (sel) => document.querySelector(sel);
const elTimer     = $("#timer");
const elTimer2    = $("#timer2");        // kalau nggak ada, aman (opsional)
const elProgress  = $("#progress");      // bar biru di bawah "TIMER"
const elNext      = $("#next-claim");
const elClaim     = $("#claim");
const elMsg       = $("#msg");
const elAddress   = $("#address");
const elCoin      = $("#coin");

/* ==== STATE ==== */
let sec = TIMER_SECONDS;
let intervalId = null;
let captchaToken = localStorage.getItem("hcaptcha") || null;

/* ==== SUPABASE (pakai punyamu!) ==== */
const SUPABASE_URL  = '<<YOUR_SUPABASE_URL>>';   // pakai yang sudah kamu pakai sebelumnya
const SUPABASE_ANON = '<<YOUR_SUPABASE_ANON>>';  // pakai yang sudah kamu pakai sebelumnya

/* ==== UI HELPERS ==== */
function paint() {
  // angka
  if (elTimer)  elTimer.textContent  = sec;
  if (elTimer2) elTimer2.textContent = sec;

  // progress bar: 0% di awal → 100% saat habis
  if (elProgress) {
    const pct = ((TIMER_SECONDS - sec) / TIMER_SECONDS) * 100;
    elProgress.style.width = `${pct}%`;
  }
}

function startTimer() {
  clearInterval(intervalId);
  sec = TIMER_SECONDS;
  paint();

  intervalId = setInterval(() => {
    sec -= 1;
    if (sec <= 0) {
      sec = 0;
      paint();
      clearInterval(intervalId);
      maybeEnable();     // tombol otomatis enable kalau syarat lain terpenuhi
      return;
    }
    paint();
  }, 1000);
}

function maybeEnable() {
  const okAddress = (elAddress?.value.trim().length || 0) >= 3;
  const okTime    = sec === 0;
  const okCaptcha = !!captchaToken;
  if (elClaim) elClaim.disabled = !(okAddress && okTime && okCaptcha);
}

/* hCaptcha callback dari HTML */
window.onCaptcha = (token) => {
  try {
    captchaToken = token;
    localStorage.setItem("hcaptcha", token);
  } catch {}
  maybeEnable();
};

/* ==== EVENTS ==== */
document.addEventListener("input", (e) => {
  if (e.target === elAddress || e.target === elCoin) {
    maybeEnable();
  }
});

/* ==== SUBMIT ==== */
async function submitClaim() {
  if (!elClaim) return;
  elClaim.disabled = true;
  if (elMsg) elMsg.textContent = "Submitting…";

  try {
    const address = elAddress.value.trim();
    const coin    = elCoin.value;

    // data yang disimpan ke Supabase
    const body = { address, coin, captcha_token: captchaToken };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/claims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text().catch(()=> "");
      if (elMsg) elMsg.textContent = "Failed to submit.";
      console.error("Supabase error:", res.status, t);
      // timer tetap jalan; biar user bisa coba lagi setelah 0 detik + captcha
      return;
    }

    // next-claim (tampilan jam saja)
    const now = new Date();
    now.setSeconds(now.getSeconds() + COOLDOWN_SECONDS);
    if (elNext) elNext.textContent = now.toLocaleTimeString();

    if (elMsg) elMsg.textContent = "Success! Your claim is queued.";

    // Reset siklus: mulai hitung lagi 10 detik (tanpa refresh)
    startTimer();
    maybeEnable();
  } catch (e) {
    console.error(e);
    if (elMsg) elMsg.textContent = "Failed to submit.";
  }
}

if (elClaim) elClaim.addEventListener("click", submitClaim);

/* ==== BOOT ==== */
startTimer();
maybeEnable();

