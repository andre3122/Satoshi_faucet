// ====== Faucet UI timers ======
const TIMER_SECONDS = 10;
const COOLDOWN_SECONDS = 10;

const elTimer = document.querySelector('#timer');
const elClaim = document.querySelector('#claim');
const elMsg   = document.querySelector('#msg');
const elNext  = document.querySelector('#next-claim');

let sec = TIMER_SECONDS;

function tick() {
  elTimer.textContent = sec;
  if (sec === 0) {
    maybeEnable();
    return;
  }
  sec -= 1;
  setTimeout(tick, 1000);
}

// enable tombol claim saat captcha + input valid
document.addEventListener('captcha-ready', maybeEnable);
['address','coin'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', maybeEnable);
});

function maybeEnable(){
  const token   = localStorage.getItem('hcaptcha');
  const address = document.getElementById('address').value.trim();
  // aktif kalau: timer selesai + token ada + address minimal 3 char
  elClaim.disabled = !(sec === 0 && token && address.length >= 3);
}

// ====== Supabase config (punya kamu) ======
const SUPABASE_URL  = 'https://jjhlpaonnnacucjcgmrc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaGxwYW9ubm5hY3VjamNnbXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDIzODYsImV4cCI6MjA3MDU3ODM4Nn0.03N9XzY7HNYxHbVs1ac0elb27Tg8gPlMYycSFHTZHhk';

// ====== Submit handler ======
async function submitClaim(){
  try {
    elClaim.disabled = true;
    elMsg.textContent = 'Submitting…';

    const address = document.getElementById('address').value.trim();
    const coin    = document.getElementById('coin').value;
    const token   = localStorage.getItem('hcaptcha');

    const payload = { address, coin, captcha_token: token };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      elMsg.textContent = 'Failed to submit.';
      elClaim.disabled = false;
      return;
    }

    // sukses → set cooldown “Next claim”, reset timer & captcha
    const next = new Date();
    next.setSeconds(next.getSeconds() + COOLDOWN_SECONDS);
    elNext.textContent = next.toLocaleTimeString();
    elMsg.textContent = 'Success! Your claim is queued.';

    // reset captcha token biar user verifikasi lagi untuk klaim berikutnya
    localStorage.removeItem('hcaptcha');
    sec = TIMER_SECONDS;
    setTimeout(tick, 1000);
  } catch (err) {
    console.error(err);
    elMsg.textContent = 'Failed to submit.';
    elClaim.disabled = false;
  }
}

elClaim.addEventListener('click', submitClaim);

// mulai timer awal
tick();
