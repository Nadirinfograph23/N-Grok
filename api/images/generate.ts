import type { VercelRequest, VercelResponse } from "@vercel/node";

const GROK_CHAT_URL = "https://grok.com/rest/app-chat/conversations/new";

function getHeaders(sso: string): Record<string, string> {
  return {
    Cookie: `sso=${sso}; sso-rw=${sso}`,
    Origin: "https://grok.com",
    Referer: "https://grok.com/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Content-Type": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };
}

function buildImagePayload(prompt: string, n: number, aspectRatio: string) {
  return {
    temporary: true,
    modelName: "grok-3",
    message: prompt,
    fileAttachments: [],
    imageAttachments: [],
    disableSearch: true,
    enableImageGeneration: true,
    enableImageStreaming: true,
    imageGenerationCount: Math.min(Math.max(n, 1), 4),
    forceConcise: false,
    toolOverrides: {},
    isReasoning: false,
    webpageUrls: [],
    disableTextFollowUps: true,
    disableMemory: true,
    enableSideBySide: true,
    sendFinalMetadata: true,
    customInstructions: "",
    returnImageBytes: false,
    returnRawGrokInXaiRequest: false,
    isAsyncChat: false,
    forceSideBySide: false,
    modelMode: null,
    responseMetadata: {
      requestModelDetails: { modelId: "grok-3" },
      modelConfigOverride: {
        modelMap: {
          imageGenModelConfig: {
            aspectRatio: aspectRatio,
          },
        },
      },
    },
    deviceEnvInfo: {
      darkModeEnabled: true,
      devicePixelRatio: 2,
      screenWidth: 1920,
      screenHeight: 1080,
      viewportWidth: 1920,
      viewportHeight: 980,
    },
  };
}

function extractImageUrls(text: string): string[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const imageUrls: string[] = [];

  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      const r = data?.result?.response;
      if (!r) continue;

      if (r.modelResponse?.generatedImageUrls) {
        for (const url of r.modelResponse.generatedImageUrls) {
          if (url && !imageUrls.includes(url)) imageUrls.push(url);
        }
      }
      if (r.imageAttachment?.imageUrl) {
        const url = r.imageAttachment.imageUrl;
        if (!imageUrls.includes(url)) imageUrls.push(url);
      }
      if (r.streamingImageGenerationResponse?.imageUrl) {
        const url = r.streamingImageGenerationResponse.imageUrl;
        if (!imageUrls.includes(url)) imageUrls.push(url);
      }
    } catch {
      // skip non-JSON lines
    }
  }

  // Also extract grok.com image URLs via regex as fallback
  const urlRegex = /https:\/\/grok\.com\/[^\s"']+\.(?:jpg|png|jpeg|webp)/g;
  for (const line of lines) {
    const matches = line.match(urlRegex);
    if (matches) {
      for (const url of matches) {
        if (!imageUrls.includes(url)) imageUrls.push(url);
      }
    }
  }

  return imageUrls;
}

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

  const sso = process.env.GROK_SSO;
  if (!sso) {
    return res.status(500).json({ error: "GROK_SSO not configured" });
  }

  const { prompt, n = 1, aspect_ratio = "1:1" } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    const resp = await fetch(GROK_CHAT_URL, {
      method: "POST",
      headers: getHeaders(sso),
      body: JSON.stringify(buildImagePayload(prompt, n, aspect_ratio)),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return res.status(resp.status).json({
        error: `Grok API error (${resp.status})`,
        details: errText.slice(0, 500),
      });
    }

    const text = await resp.text();
    const imageUrls = extractImageUrls(text);

    if (imageUrls.length === 0) {
      return res.status(500).json({
        error: "No images generated",
        details: "The API did not return any image URLs",
      });
    }

    return res.status(200).json({
      data: imageUrls.map((url) => ({ url })),
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to call Grok API", details: String(err) });
  }
}
