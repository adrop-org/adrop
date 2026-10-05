// Registers the demo viewer wallet (X402_DEMO_SECRET) via the server: GET register-tx, sign, send.
import { Connection, Keypair, Transaction } from "@solana/web3.js";
const [base = "http://localhost:3000"] = process.argv.slice(2);
const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.X402_DEMO_SECRET!)));
const conn = new Connection(process.env.RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
const r = await fetch(`${base}/identity/register-tx`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: wallet.publicKey.toBase58() }) });
const body = await r.json();
if (r.status !== 200) { console.log(r.status, body); process.exit(0); }
const tx = Transaction.from(Buffer.from(body.tx_base64, "base64"));
tx.sign(wallet);
const sig = await conn.sendRawTransaction(tx.serialize());
await conn.confirmTransaction(sig, "confirmed");
console.log(JSON.stringify({ registered: wallet.publicKey.toBase58(), identity: body.identity, tx: sig }));
console.log(await (await fetch(`${base}/identity/${wallet.publicKey.toBase58()}`)).json());
