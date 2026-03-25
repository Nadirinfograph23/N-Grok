import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateImageWithGrok } from "../lib/grok-client";

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

  const { prompt, model = "grok-3-auto" } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    const result = await generateImageWithGrok(
      `Create a video: ${prompt}`,
      model
    );

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    if (result.images && result.images.length > 0) {
      return res.status(200).json({
        status: "submitted",
        post_id: `grok-${Date.now()}`,
        message: "Content generated successfully.",
        urls: result.images,
      });
    }

    return res.status(200).json({
      status: "submitted",
      post_id: `grok-${Date.now()}`,
      message: result.response || "Request processed. Video generation via Grok conversation.",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to generate video", details: String(err) });
  }
}
