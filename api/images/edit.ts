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

  const { prompt, image_base64 } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }
  if (!image_base64) {
    return res.status(400).json({ error: "Missing image data" });
  }

  try {
    // Use imagen-flash model which supports image reference for editing
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("model", "imagen-flash");
    formData.append("aspect_ratio", "16:9");

    // Convert base64 to blob for file upload
    const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, "");
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "image/png" });
    formData.append("files", blob, "reference.png");

    const resp = await fetch(GEMINIGEN_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
      },
      body: formData,
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
    if (result.base64_images) {
      return res.status(200).json({
        data: [{ url: `data:image/png;base64,${result.base64_images}` }],
      });
    }

    return res.status(200).json(result);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to call GeminiGen API", details: String(err) });
  }
}
