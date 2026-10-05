// x402 for money in (SPEC §4). The route handler must act on settlement, which paymentMiddleware
// hides, so routes drive x402HTTPResourceServer directly: process -> settle -> act -> respond.
import type { Request, Response } from "express";
import { ExpressAdapter } from "@x402/express";
import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer, type FacilitatorClient, type RoutesConfig } from "@x402/core/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";

export type X402Deps = { facilitator: FacilitatorClient; network: string; usdcMint: string; payTo: string; rpcUrl?: string };

export const httpFacilitator = (url: string): FacilitatorClient => new HTTPFacilitatorClient({ url });

export class X402 {
  constructor(private readonly deps: X402Deps) {}

  private server(routes: RoutesConfig) {
    const rs = new x402ResourceServer(this.deps.facilitator).register(this.deps.network, new ExactSvmScheme({ rpcUrl: this.deps.rpcUrl }));
    return new x402HTTPResourceServer(rs, routes);
  }

  /**
   * Charges `amount` base units of USDC for this request. Returns null after writing the 402 or
   * an error response; otherwise the settlement (tx) and the headers to attach to the reply.
   */
  async charge(req: Request, res: Response, routeKey: string, amount: number, description: string) {
    const http = this.server({
      [routeKey]: { accepts: [{ scheme: "exact", network: this.deps.network, payTo: this.deps.payTo, price: { asset: this.deps.usdcMint, amount: String(amount) } }], description },
    });
    await http.initialize();
    const adapter = new ExpressAdapter(req);
    const context = { adapter, path: req.path, method: req.method, paymentHeader: adapter.getHeader("payment-signature") };
    const result = await http.processHTTPRequest(context);
    if (result.type === "no-payment-required") throw new Error(`route ${routeKey} not matched by x402 config`);
    if (result.type === "payment-error") {
      res.status(result.response.status);
      for (const [k, v] of Object.entries(result.response.headers)) res.setHeader(k, v);
      res.json(result.response.body ?? {});
      return null;
    }
    const settled = await http.processSettlement(result.paymentPayload, result.paymentRequirements, result.declaredExtensions, { request: context }, undefined, result.beforeHandlerSettlement);
    if (!settled.success) {
      res.status(settled.response.status);
      for (const [k, v] of Object.entries(settled.response.headers)) res.setHeader(k, v);
      res.json(settled.response.body ?? { error: settled.errorReason });
      return null;
    }
    return { tx: settled.transaction, payer: settled.payer, headers: settled.headers };
  }
}
