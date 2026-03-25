import type { VercelRequest, VercelResponse } from "@vercel/node";

const XAI_API_URL = "https://api.x.ai/v1/images/edits";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "XAI_API_KEY not configured" });
  }

  const { prompt, image_url } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }
  if (!image_url) {
    return res.status(400).json({ error: "Missing image_url" });
  }

  try {
    const body: Record<string, unknown> = {
      model: "grok-imagine-image",
      prompt,
      image: {
        url: image_url,
        type: "image_url",
      },
    };

    const resp = await fetch(XAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return res.status(resp.status).json({
        error: `xAI API error (${resp.status})`,
        details: errText.slice(0, 500),
      });
    }

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to call xAI API", details: String(err) });
  }
}
