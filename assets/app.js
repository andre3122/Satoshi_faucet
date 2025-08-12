// ===== Faucet front-end controller (timer + progress) =====
const TIMER_SECONDS = 10;        // waktu tunggu awal untuk enable claim
const COOLDOWN_SECONDS = 10;     // cooldown setelah claim

// Elemen DOM
const elTimer    = document.querySelector('#timer');
const elTimer2   = document.querySelector('#timer2'); // opsional (biar sinkron)
const elClaim    = document.querySelector('#claim');
const elMsg      = document.querySelector('#msg');
const elNext     = document.querySelector('#next-claim');
const elProgress = document.querySelector('#progress');

// ===== Supabase endpoint (punya kamu) =====
const SUPABASE_URL  = 'https://jjhlpaonnnacucjcgmrc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaGxwYW9ubm5hY3VjamNnbXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDIzODYsImV4cCI6MjA3MDU3ODM4Nn0.03N9XzY7HNYxHbVs1ac0elb27Tg8gPlMYycSFHTZHhk';

let sec = TIMER_SECONDS;
let mode = 'enable'; // 'enable' (menunggu sebelum bisa claim) atau 'cooldown'

// --- render semua tampilan timer/progress ---
function paint() {
  if (elTimer)  elTimer.textContent  = sec;
  if (elTimer2) elTimer2.textContent = sec;
  if (elProgress) {
    const base = mode === 'enable' ? TIMER_SECONDS : COOLDOWN_SECONDS;
    const pct = 100 - Math.floor((sec / base) * 100);
    elProgress.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }
}

// aktifkan tombol jika syarat terpenuhi
function maybeEnable(){
  const token   = localStorage.getItem('hcaptcha');
  const address = document.getElementById('address')?.value.trim() || '';
  const ready   = (mode === 'enable' && sec === 0 && token && address.length >= 3);
  if (elClaim) elClaim.disabled = !ready;
}

// loop timer 1 detik
function startLoop() {
  paint(); maybeEnable();
  const tick = () => {
    if (sec > 0) {
      sec -= 1;
      paint(); maybeEnable();
      setTimeout(tick, 1000);
    } else {
      // saat habis:
      paint(); maybeEnable();
    }
  };
  setTimeout(tick, 1000);
}

// dengarkan captcha & input
document.addEventListener('captcha-ready', maybeEnable);
['address','coin'].forEach(id=>{
  document.getElementById(id)?.addEventListener('input', maybeEnable);
});

// Submit klaim
async function submitClaim(){
  if (!elClaim) return;
  elClaim.disabled = true;
  if (elMsg) elMsg.textContent = 'Submitting…';

  const address = document.getElementById('address')?.value.trim() || '';
  const coin    = document.getElementById('coin')?.value || 'BTC';
  const token   = localStorage.getItem('hcaptcha');

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({ address, coin, captcha_token: token }),
    });

    if (!res.ok) {
      if (elMsg) elMsg.textContent = 'Failed to submit.';
      elClaim.disabled = false;
      return;
    }

    // set "Next claim"
    const now = new Date();
    now.setSeconds(now.getSeconds() + COOLDOWN_SECONDS);
    if (elNext) elNext.textContent = now.toLocaleTimeString();
    if (elMsg)  elMsg.textContent  = 'Success! Your claim is queued.';

    // masuk mode cooldown: hitung mundur 10 detik lalu balik lagi ke enable
    mode = 'cooldown';
    sec  = COOLDOWN_SECONDS;
    paint();

    const cooldownTick = () => {
      if (sec > 0) {
        sec -= 1;
        paint();
        setTimeout(cooldownTick, 1000);
      } else {
        // selesai cooldown → mulai lagi fase enable
        mode = 'enable';
        sec  = TIMER_SECONDS;
        paint(); maybeEnable();
        startLoop();
      }
    };
    setTimeout(cooldownTick, 1000);

  } catch (e) {
    console.error(e);
    if (elMsg) elMsg.textContent = 'Failed to submit.';
    elClaim.disabled = false;
  }
}

elClaim?.addEventListener('click', submitClaim);

// start awal (fase enable)
mode = 'enable';
sec  = TIMER_SECONDS;
paint();
startLoop();
maybeEnable();
