import type { VercelRequest, VercelResponse } from "@vercel/node";
import { askGrok } from "../lib/grok-client";

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

  const { prompt, model = "grok-3" } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    const result = await askGrok({
      message: `Create a video: ${prompt}`,
      modelName: model,
      enableImageGeneration: true,
      imageGenerationCount: 2,
      forceConcise: true,
      disableTextFollowUps: true,
    });

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    const imageUrls = result.modelResponse.generatedImageUrls;
    if (imageUrls.length > 0) {
      return res.status(200).json({
        status: "submitted",
        post_id: `grok-${Date.now()}`,
        message: "Content generated successfully.",
        urls: imageUrls,
      });
    }

    return res.status(200).json({
      status: "submitted",
      post_id: `grok-${Date.now()}`,
      message: result.modelResponse.message || "Request processed. Video generation via Grok conversation.",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to generate video", details: String(err) });
  }
}
