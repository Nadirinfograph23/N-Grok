import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawId = req.query.requestId;
  const requestId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!requestId) {
    return res.status(400).json({ error: "Missing requestId" });
  }

  // GeminiGen uses webhooks for video results delivery.
  // This endpoint returns a status indicating that the video is being processed
  // and results will be delivered via the configured webhook.
  return res.status(200).json({
    status: "processing",
    post_id: requestId,
    message: "Video is being processed. Results will be delivered to your configured webhook.",
  });
}
