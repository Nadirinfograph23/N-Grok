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

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    const result = await generateImageWithGrok(
      `Edit an image based on this description: ${prompt}`,
      "grok-3-auto"
    );

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    if (result.images && result.images.length > 0) {
      return res.status(200).json({
        data: result.images.map((url) => ({ url })),
      });
    }

    return res.status(200).json({
      data: [],
      message: result.response || "No images were generated. Try a different prompt.",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to edit image", details: String(err) });
  }
}
