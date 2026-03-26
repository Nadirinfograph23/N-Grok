import type { VercelRequest, VercelResponse } from "@vercel/node";

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
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

    const response = await fetch(`${REPLICATE_API_URL}/${requestId}`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();
    let prediction: Record<string, unknown>;
    try {
      prediction = JSON.parse(responseText);
    } catch {
      return res.status(502).json({
        error: "Invalid response from Replicate API",
        details: responseText.substring(0, 500),
      });
    }

    if (!response.ok) {
      const detail =
        (prediction.detail as string) ||
        (prediction.title as string) ||
        "Failed to fetch prediction status";
      return res.status(200).json({
        status: "failed",
        error: detail,
        message: detail,
      });
    }

    if (prediction.status === "succeeded") {
      const output = prediction.output;
      const videoUrl =
        typeof output === "string"
          ? output
          : Array.isArray(output)
            ? (output as string[])[0]
            : (output as Record<string, unknown>)?.url || output;

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
        error: (prediction.error as string) || "Video generation failed.",
        message: (prediction.error as string) || "Video generation failed.",
      });
    }

    // Still processing (starting or processing)
    return res.status(200).json({
      status: (prediction.status as string) || "processing",
      prediction_id: prediction.id,
      message: "Video is being generated. Please wait...",
      logs: (prediction.logs as string) || "",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to check video status",
      details: String(err),
    });
  }
}
