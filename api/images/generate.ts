import type { VercelRequest, VercelResponse } from "@vercel/node";

const GEMINIGEN_API_URL = "https://api.geminigen.ai/uapi/v1/generate_image";

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

  const apiKey = process.env.GEMINIGEN_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINIGEN_API_KEY not configured" });
  }

  const { prompt, model = "imagen-flash", aspect_ratio = "1:1", style } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    const formBody = new URLSearchParams();
    formBody.append("prompt", prompt);
    formBody.append("model", model);
    formBody.append("aspect_ratio", aspect_ratio);
    if (style && style !== "None" && style !== "none") {
      formBody.append("style", style);
    }

    const resp = await fetch(GEMINIGEN_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
      },
      body: formBody,
    });

    if (!resp.ok) {
      if (resp.status >= 400 && resp.status < 500) {
        try {
          const errData = await resp.json();
          const errMsg = errData?.detail?.error_message || `Request failed (${resp.status})`;
          return res.status(resp.status).json({ error: errMsg });
        } catch {
          return res.status(resp.status).json({ error: `Client error: ${resp.status}` });
        }
      }
      const errText = await resp.text().catch(() => "");
      return res.status(resp.status).json({
        error: `GeminiGen API error (${resp.status})`,
        details: errText.slice(0, 500),
      });
    }

    const result = await resp.json();

    // Transform GeminiGen response to match frontend expected format
    // GeminiGen returns { base64_images: "..." }
    if (result.base64_images) {
      return res.status(200).json({
        data: [{ url: `data:image/png;base64,${result.base64_images}` }],
      });
    }

    // Fallback: return raw response
    return res.status(200).json(result);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to call GeminiGen API", details: String(err) });
  }
}
