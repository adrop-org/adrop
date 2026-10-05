// SGT lookup via Helius getTokenAccountsByOwnerV2 (Token-2022; skip amount 0) and a parsed
// mint check: MetadataPointer.metadataAddress and TokenGroupMember.group both == group.
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export type SgtHolding = { mint: string; tokenAccount: string };
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ json(): Promise<any> }>;

export class Helius {
  constructor(private readonly url: string, private readonly fetchFn: FetchLike = fetch as unknown as FetchLike) {}

  async rpc<T = any>(method: string, params: unknown[]): Promise<T> {
    const res = await this.fetchFn(this.url, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const body = await res.json();
    if (body.error) throw new Error(`helius ${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
    return body.result;
  }

  async isSgtMint(mint: string, group: string): Promise<boolean> {
    const info = await this.rpc("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
    const parsed = info?.value?.data?.parsed;
    if (parsed?.type !== "mint" || info.value.owner !== TOKEN_2022_PROGRAM_ID.toBase58()) return false;
    const ext: any[] = parsed.info.extensions ?? [];
    const mp = ext.find((e) => e.extension === "metadataPointer")?.state?.metadataAddress;
    const member = ext.find((e) => e.extension === "tokenGroupMember")?.state;
    return mp === group && member?.group === group && member?.mint === mint;
  }

  /** First SGT of `group` held by `owner`, or null. */
  async findSgt(owner: string, group: string): Promise<SgtHolding | null> {
    let paginationKey: string | undefined;
    do {
      const page = await this.rpc("getTokenAccountsByOwnerV2", [
        owner, { programId: TOKEN_2022_PROGRAM_ID.toBase58() },
        { encoding: "jsonParsed", limit: 100, ...(paginationKey ? { paginationKey } : {}) },
      ]);
      const v = page?.value ?? page; // V2 nests under `value`
      for (const a of v?.accounts ?? []) {
        const info = a.account?.data?.parsed?.info;
        if (!info || info.tokenAmount?.amount !== "1" || info.tokenAmount?.decimals !== 0) continue;
        if (await this.isSgtMint(info.mint, group)) return { mint: info.mint, tokenAccount: a.pubkey };
      }
      paginationKey = v?.paginationKey ?? undefined;
    } while (paginationKey);
    return null;
  }
}
