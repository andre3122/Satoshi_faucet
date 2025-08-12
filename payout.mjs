import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const BASE = Number(process.env.BASE_REWARD_SATS || 50);

const CODES = { BTC:'BTC', ETH:'ETH', DOGE:'DOGE', LTC:'LTC', BCH:'BCH', DASH:'DASH', DGB:'DGB', TRX:'TRX', USDT:'USDT', BNB:'BNB' };

const { data: rows, error } = await supa
  .from('claims')
  .select('*')
  .eq('status', 'pending')
  .order('created_at', { ascending: true })
  .limit(200);
if (error) throw error;

for (const row of rows) {
  try {
    const coin = CODES[row.coin] || 'BTC';
    const amount = BASE;
    const res = await faucetPaySend({
      api_key: process.env.FAUCETPAY_API_KEY,
      currency: coin,
      amount,
      to: row.address,
      faucetname: process.env.FAUCET_NAME
    });
    if (!res || res.status !== 200) throw new Error('fp_failed');
    await supa.from('claims').update({ status:'sent', tx_hash: res.data?.payout_id || null }).eq('id', row.id);
    console.log('paid', row.address, coin, amount);
  } catch (e) {
    console.error('fail', row.id, e.message);
    await supa.from('claims').update({ status:'error', error: e.message }).eq('id', row.id);
  }
}

async function faucetPaySend({ api_key, currency, amount, to, faucetname }){
  const form = new URLSearchParams({ api_key, currency, amount: String(amount), to, faucetname });
  const r = await fetch('https://faucetpay.io/api/v1/send', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form
  });
  const data = await r.json().catch(()=>({}));
  return { status: r.status, data };
}