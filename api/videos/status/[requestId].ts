import type { VercelRequest, VercelResponse } from "@vercel/node";

const XAI_API_BASE = "https://api.x.ai/v1/videos";

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

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "XAI_API_KEY not configured" });
  }

  const rawId = req.query.requestId;
  const requestId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!requestId) {
    return res.status(400).json({ error: "Missing requestId" });
  }

  try {
    const resp = await fetch(`${XAI_API_BASE}/${requestId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return res.status(resp.status).json({
        error: `xAI API error (${resp.status})`,
        details: errText.slice(0, 500),
      });
    }

    const data = await resp.json();

    // xAI returns: { status: "done"|"pending"|"expired"|"failed", video?: { url, duration }, model? }
    return res.status(200).json(data);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to check video status", details: String(err) });
  }
}
