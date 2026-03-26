import type { VercelRequest, VercelResponse } from "@vercel/node";

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";
const HUNYUAN_MODEL_VERSION =
  "6c9132aee14409cd6568d030453f1ba50f5f3412b844fe67f78a9eb62d55664f";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return res
        .status(500)
        .json({ error: "REPLICATE_API_TOKEN is not configured on the server." });
    }

    const body = req.body || {};
    const {
      prompt,
      width = 1280,
      height = 720,
      video_length = 129,
      num_inference_steps = 50,
      guidance_scale = 6.0,
      flow_shift = 7.0,
      embedded_guidance_scale = 6.0,
      seed,
      image,
    } = body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const input: Record<string, unknown> = {
      prompt,
      width: Number(width),
      height: Number(height),
      video_length: Number(video_length),
      num_inference_steps: Number(num_inference_steps),
      guidance_scale: Number(guidance_scale),
      flow_shift: Number(flow_shift),
      embedded_guidance_scale: Number(embedded_guidance_scale),
    };

    if (seed !== undefined && seed !== null && seed !== "") {
      input.seed = Number(seed);
    }

    if (image) {
      input.image = image;
    }

    const response = await fetch(REPLICATE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: HUNYUAN_MODEL_VERSION,
        input,
      }),
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
        "Failed to create prediction";
      return res.status(200).json({
        status: "failed",
        error: detail,
        message: detail,
        details: prediction,
      });
    }

    if (prediction.status === "succeeded" && prediction.output) {
      const output = prediction.output;
      return res.status(200).json({
        status: "succeeded",
        prediction_id: prediction.id,
        video_url:
          typeof output === "string"
            ? output
            : Array.isArray(output)
              ? (output as string[])[0]
              : (output as Record<string, unknown>)?.url || output,
        message: "Video generated successfully!",
      });
    }

    return res.status(202).json({
      status: (prediction.status as string) || "starting",
      prediction_id: prediction.id,
      message:
        "Video generation started. Poll for status using the prediction ID.",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to start video generation",
      details: String(err),
    });
  }
}
