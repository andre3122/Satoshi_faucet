const TIMER_SECONDS = 10;
const COOLDOWN_SECONDS = 10;

const elTimer = document.querySelector('#timer');
const elClaim = document.querySelector('#claim');
const elMsg = document.querySelector('#msg');
const elNext = document.querySelector('#next-claim');

let sec = TIMER_SECONDS;
const tick = () => {
  elTimer.textContent = sec;
  if (sec === 0) {
    maybeEnable();
    return;
  }
  sec -= 1;
  setTimeout(tick, 1000);
};

document.addEventListener('captcha-ready', maybeEnable);
['address','coin'].forEach(id=>document.getElementById(id).addEventListener('input', maybeEnable));

function maybeEnable(){
  const token = localStorage.getItem('hcaptcha');
  const address = document.getElementById('address').value.trim();
  elClaim.disabled = !(sec===0 && token && address.length>=3);
}

const SUPABASE_URL = 'https://jjhlpaonnnacucjcgmrc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaGxwYW9ubm5hY3VjamNnbXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDIzODYsImV4cCI6MjA3MDU3ODM4Nn0.03N9XzY7HNYxHbVs1ac0elb27Tg8gPlMYycSFHTZHhk';

async function submitClaim(){
  elClaim.disabled = true;
  elMsg.textContent = 'Submitting…';
  const address = document.getElementById('address').value.trim();
  const coin = document.getElementById('coin').value;
  const token = localStorage.getItem('hcaptcha');
  const data = { address, coin, captcha_token: token };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/claims`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON,'Authorization':`Bearer ${SUPABASE_ANON}`},
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    elMsg.textContent = 'Failed to submit.';
    return;
  }
  const now = new Date();
  now.setSeconds(now.getSeconds()+COOLDOWN_SECONDS);
  elNext.textContent = now.toLocaleTimeString();
  elMsg.textContent = 'Success! Your claim is queued.';
}

elClaim.addEventListener('click', submitClaim);

tick();
