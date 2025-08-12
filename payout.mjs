// payout.mjs
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

/**
 * ENV yang wajib kamu isi di GitHub Secrets:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE
 * - FAUCETPAY_API_KEY
 * - FAUCET_NAME                  (mis. "satoshi_faucet")
 *
 * Opsional:
 * - BASE_REWARD_SATS             (default 1, satuan = satoshi/litoshi/dll sesuai coin)
 * - MAX_PER_RUN                  (default 50)
 * - HCAPTCHA_SECRET              (kalau mau verifikasi server-side)
 */

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE,
  FAUCETPAY_API_KEY,
  FAUCET_NAME,
  BASE_REWARD_SATS = "1",
  MAX_PER_RUN = "50",
  HCAPTCHA_SECRET,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !FAUCETPAY_API_KEY || !FAUCET_NAME) {
  console.error("Missing required env: SUPABASE_URL/SUPABASE_SERVICE_ROLE/FAUCETPAY_API_KEY/FAUCET_NAME");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

/** Map nama coin dari dropdown → kode currency FaucetPay */
const COIN_MAP = {
  BTC: "BTC",
  ETH: "ETH",
  DOGE: "DOGE",
  LTC: "LTC",
  BCH: "BCH",
  DASH: "DASH",
  DGB: "DGB",
  TRX: "TRX",
  USDT: "USDT",
  BNB: "BNB",
};

const faucetPayEndpoint = "https://faucetpay.io/api/v1/send";

/** (Opsional) verifikasi hCaptcha di server */
async function verifyHCaptcha(token) {
  if (!HCAPTCHA_SECRET) return true; // skip kalau nggak diset
  try {
    const res = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: HCAPTCHA_SECRET, response: token }),
    });
    const json = await res.json();
    return !!json.success;
  } catch (e) {
    console.error("hCaptcha verify error:", e);
    return false;
  }
}

/** kirim satu klaim ke FaucetPay */
async function payOne(row, amountSats) {
  const currency = COIN_MAP[row.coin] || row.coin;
  const params = new URLSearchParams({
    api_key: FAUCETPAY_API_KEY,
    currency,
    amount: String(amountSats),           // FaucetPay pakai unit “koin minimal” (satoshi/litoshi/dll)
    to: row.address,
    referral: FAUCET_NAME,                // label aja (opsional)
  });

  const res = await fetch(faucetPayEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  // Contoh respons sukses biasanya { "status":200, "success":true, "message": "...", "payout_id": "...", ... }
  const ok = (res.ok && (data.success === true || data.status === 200));

  return { ok, data };
}

async function main() {
  // Ambil klaim pending
  const { data: rows, error } = await supabase
    .from("Claims")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(parseInt(MAX_PER_RUN, 10));

  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log("No pending claims. Done.");
    return;
  }

  console.log(`Processing ${rows.length} pending claims…`);

  for (const row of rows) {
    try {
      // (opsional) verifikasi hCaptcha
      const captchaOK = await verifyHCaptcha(row.captcha_token);
      if (!captchaOK) {
        await supabase.from("Claims")
          .update({ status: "error", error: "hcaptcha_failed" })
          .eq("id", row.id);
        console.log(`Row ${row.id} captcha failed`);
        continue;
      }

      // Tentukan reward (sama untuk semua coin, atau nanti bisa kamu bikin per-coin)
      const amountSats = parseInt(BASE_REWARD_SATS, 10) || 1;

      // Kirim ke FaucetPay
      const { ok, data } = await payOne(row, amountSats);

      if (ok) {
        await supabase.from("Claims")
          .update({
            status: "paid",
            tx_hash: data.payout_id || data.transactionId || null,
            error: null,
          })
          .eq("id", row.id);
        console.log(`Row ${row.id} PAID (${row.coin}) → ${row.address}`);
      } else {
        await supabase.from("Claims")
          .update({
            status: "error",
            error: data?.message ? String(data.message).slice(0, 500) : "faucetpay_failed",
          })
          .eq("id", row.id);
        console.log(`Row ${row.id} ERROR:`, data?.message || data);
      }
    } catch (e) {
      console.error("Unhandled error:", e);
      await supabase.from("Claims")
        .update({ status: "error", error: String(e).slice(0, 500) })
        .eq("id", row.id);
    }
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
