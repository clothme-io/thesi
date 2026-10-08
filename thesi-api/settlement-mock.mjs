import http from "node:http";
import Stripe from "stripe";

const KEY = process.env.COMMERCE_SETTLEMENT_SERVICE_KEY;
const ACCOUNT = process.env.SETTLEMENT_PLATFORM_ACCOUNT_ID;
const CREATOR_ID = process.env.SETTLEMENT_CREATOR_USER_ID;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const previews = new Map();

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let body = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    body = {};
  }
  const action = String(req.url || "").split("/").filter(Boolean).pop();
  const json = (code, payload) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  };
  if (req.headers["x-thesi-settlement-key"] !== KEY) {
    return json(403, { message: "bad settlement key" });
  }
  try {
    if (action === "platform") {
      return json(200, { data: { accountId: ACCOUNT } });
    }
    if (action === "preview") {
      const current = previews.get(body.orderLineId) ?? {
        receiptId: body.receiptId,
        creatorId: CREATOR_ID,
        earnedCents: 500,
        eligibleAt: new Date(Date.now() - 86400000).toISOString(),
        holdReasons: [],
        disqualified: false,
        totals: { creatorPaid: 0, creatorRecovered: 0 },
        operations: [],
        rules: { minimumPayoutCents: 0 },
      };
      current.receiptId = body.receiptId;
      current.creatorId = CREATOR_ID;
      previews.set(body.orderLineId, current);
      return json(200, { data: current });
    }
    if (action === "decide") {
      let transferId = null;
      if (body.action === "qualify" && body.destination) {
        const transfer = await stripe.transfers.create({
          amount: 500,
          currency: "usd",
          destination: body.destination,
          metadata: {
            type: "commission_settlement_test",
            orderLineId: String(body.orderLineId ?? ""),
          },
        });
        transferId = transfer.id;
      }
      const current = previews.get(body.orderLineId) ?? {};
      current.totals = { creatorPaid: 500, creatorRecovered: 0 };
      current.operations = [
        { id: transferId, state: "succeeded", kind: "qualify" },
      ];
      previews.set(body.orderLineId, current);
      return json(200, { data: { transferId, state: "succeeded" } });
    }
    return json(200, { data: { ok: true, action } });
  } catch (error) {
    return json(409, { message: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(5020, "127.0.0.1", () => {
  console.log("settlement-mock listening on 127.0.0.1:5020");
});
