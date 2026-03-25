import type { VercelRequest, VercelResponse } from "@vercel/node";

const XAI_API_URL = "https://api.x.ai/v1/videos/generations";

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

  const {
    prompt,
    duration = 5,
    aspect_ratio = "16:9",
    resolution = "480p",
    image_url,
  } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    const body: Record<string, unknown> = {
      model: "grok-imagine-video",
      prompt,
      duration: typeof duration === "string" ? parseInt(duration, 10) : duration,
      aspect_ratio,
      resolution,
    };

    if (image_url) {
      body.image = {
        url: image_url,
        type: "image_url",
      };
    }

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

    // xAI API returns { request_id: "..." } for async video generation
    if (data.request_id) {
      return res.status(200).json({
        status: "pending",
        post_id: data.request_id,
      });
    }

    // If the video is immediately ready (unlikely but handle it)
    if (data.status === "done" && data.video?.url) {
      return res.status(200).json({
        status: "done",
        video: { url: data.video.url },
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to call xAI API", details: String(err) });
  }
}
