// ===== Faucet front-end controller (timer + progress) =====
const TIMER_SECONDS = 10;        // waktu tunggu awal untuk enable claim
const COOLDOWN_SECONDS = 10;     // cooldown setelah claim

// Elemen DOM
const elTimer   = document.querySelector('#timer');
const elClaim   = document.querySelector('#claim');
const elMsg     = document.querySelector('#msg');
const elNext    = document.querySelector('#next-claim');
const elProgress= document.querySelector('#progress');

let sec = TIMER_SECONDS;
let ticking = false;

// --- helper render progress bar (0% -> 100%) ---
function renderProgress() {
  if (!elProgress || !Number.isFinite(sec)) return;
  // ketika menunggu, bar jalan dari 0 -> 100
  let base = (ticking ? TIMER_SECONDS : COOLDOWN_SECONDS);
  // fallback bila base 0/undefined
  if (!base || base <= 0) base = 1;
  const pct = Math.max(0, Math.min(100, 100 - Math.floor((sec / base) * 100)));
  elProgress.style.width = pct + '%';
}

function maybeEnable(){
  const token   = localStorage.getItem('hcaptcha');
  const address = document.getElementById('address')?.value.trim() || '';
  // tombol enable hanya saat timer 0 dan syarat terisi
  elClaim.disabled = !(sec === 0 && token && address.length >= 3);
}

function tick(){
  ticking = true;
  elTimer.textContent = sec;
  renderProgress();
  if (sec === 0) {
    maybeEnable();
    return;
  }
  sec -= 1;
  setTimeout(tick, 1000);
}

// listen isian input dan captcha
document.addEventListener('captcha-ready', maybeEnable);
['address','coin'].forEach(id=>{
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', maybeEnable);
});

// --- Supabase endpoint (sudah jalan di versi kamu) ---
const SUPABASE_URL  = 'https://jjhlpaonnnacucjcgmrc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaGxwYW9ubm5hY3VjamNnbXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDIzODYsImV4cCI6MjA3MDU3ODM4Nn0.03N9XzY7HNYxHbVs1ac0elb27Tg8gPlMYycSFHTZHhk';

async function submitClaim(){
  // cegah double click
  elClaim.disabled = true;
  elMsg.textContent = 'Submitting…';

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
      elMsg.textContent = 'Failed to submit.';
      return;
    }

    // set next claim time
    const now = new Date();
    now.setSeconds(now.getSeconds() + COOLDOWN_SECONDS);
    elNext.textContent = now.toLocaleTimeString();
    elMsg.textContent  = 'Success! Your claim is queued.';

    // reset timer untuk cooldown
    ticking = false;
    sec = COOLDOWN_SECONDS;
    elTimer.textContent = sec;
    renderProgress();

    // jalankan ulang tick sampai 0, lalu enable lagi
    const loop = () => {
      if (sec === 0) {
        maybeEnable();
        // setelah cooldown selesai, mulai lagi timer “enable” 10s agar UX konsisten
        sec = TIMER_SECONDS;
        ticking = true;
        renderProgress();
        setTimeout(tick, 1000);
        return;
      }
      sec -= 1;
      elTimer.textContent = sec;
      renderProgress();
      setTimeout(loop, 1000);
    };
    setTimeout(loop, 1000);

  } catch (e) {
    elMsg.textContent = 'Failed to submit.';
    console.error(e);
  }
}

if (elClaim) elClaim.addEventListener('click', submitClaim);

// start
renderProgress();
tick();
maybeEnable();
