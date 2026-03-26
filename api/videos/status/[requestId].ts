import type { VercelRequest, VercelResponse } from "@vercel/node";

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    return res
      .status(500)
      .json({ error: "REPLICATE_API_TOKEN is not configured on the server." });
  }

  const rawId = req.query.requestId;
  const requestId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!requestId) {
    return res.status(400).json({ error: "Missing requestId" });
  }

  try {
    const response = await fetch(`${REPLICATE_API_URL}/${requestId}`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    const prediction = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: prediction.detail || "Failed to fetch prediction status",
        details: prediction,
      });
    }

    if (prediction.status === "succeeded") {
      const output = prediction.output;
      const videoUrl =
        typeof output === "string"
          ? output
          : Array.isArray(output)
            ? output[0]
            : output?.url || output;

      return res.status(200).json({
        status: "succeeded",
        prediction_id: prediction.id,
        video_url: videoUrl,
        message: "Video generated successfully!",
      });
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      return res.status(200).json({
        status: prediction.status,
        prediction_id: prediction.id,
        error: prediction.error || "Video generation failed.",
        message: prediction.error || "Video generation failed.",
      });
    }

    // Still processing (starting or processing)
    return res.status(200).json({
      status: prediction.status || "processing",
      prediction_id: prediction.id,
      message: "Video is being generated. Please wait...",
      logs: prediction.logs || "",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to check video status",
      details: String(err),
    });
  }
}
