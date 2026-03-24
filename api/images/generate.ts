import type { VercelRequest, VercelResponse } from "@vercel/node";

const XAI_API_BASE = "https://api.x.ai/v1";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "XAI_API_KEY not configured" });
  }

  const { prompt, n = 1, aspect_ratio = "auto", response_format = "url" } = req.body;

  const payload: Record<string, unknown> = {
    model: "grok-2-image",
    prompt,
    n,
    response_format,
  };
  if (aspect_ratio !== "auto") {
    payload.aspect_ratio = aspect_ratio;
  }

  try {
    const resp = await fetch(`${XAI_API_BASE}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json(data);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to call xAI API", details: String(err) });
  }
}
