import type { VercelRequest, VercelResponse } from "@vercel/node";
import { askGrok } from "./lib/grok-client";

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

  const {
    message,
    model = "grok-3",
    conversationId,
    parentResponseId,
    customInstructions = "",
    disableSearch = false,
    enableImageGeneration = false,
    imageGenerationCount = 2,
    isReasoning = false,
    webpageUrls = [],
  } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  try {
    const result = await askGrok({
      message,
      modelName: model,
      conversationId,
      parentResponseId,
      customInstructions,
      disableSearch,
      enableImageGeneration,
      imageGenerationCount,
      isReasoning,
      webpageUrls,
      forceConcise: false,
      disableTextFollowUps: false,
    });

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    return res.status(200).json({
      message: result.modelResponse.message,
      images: result.modelResponse.generatedImageUrls.length > 0
        ? result.modelResponse.generatedImageUrls
        : undefined,
      conversationId: result.conversationId,
      responseId: result.responseId,
      title: result.title,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Chat request failed", details: String(err) });
  }
}
