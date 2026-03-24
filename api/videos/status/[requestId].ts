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

function extractVideoUrl(text: string): string | null {
  const lines = text.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      const r = data?.result?.response;
      if (!r) continue;

      if (r.modelResponse?.videoUrl) return r.modelResponse.videoUrl;
      if (r.videoAttachment?.videoUrl) return r.videoAttachment.videoUrl;
      if (r.streamingVideoResponse?.videoUrl)
        return r.streamingVideoResponse.videoUrl;
      if (r.mediaPostVideoUrl) return r.mediaPostVideoUrl;
    } catch {
      // skip non-JSON lines
    }
  }

  const videoUrlRegex = /https:\/\/[^\s"']+\.(?:mp4|webm|mov)/g;
  for (const line of lines) {
    const matches = line.match(videoUrlRegex);
    if (matches && matches.length > 0) return matches[0];
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sso = process.env.GROK_SSO;
  if (!sso) {
    return res.status(500).json({ error: "GROK_SSO not configured" });
  }

  const rawId = req.query.requestId;
  const postId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!postId) {
    return res.status(400).json({ error: "Missing requestId" });
  }

  try {
    // Try to get video status by re-querying the chat API with a status check
    const resp = await fetch(GROK_CHAT_URL, {
      method: "POST",
      headers: getHeaders(sso),
      body: JSON.stringify({
        temporary: true,
        modelName: "grok-3",
        message: `Check status of video generation post ${postId}`,
        fileAttachments: [],
        imageAttachments: [],
        disableSearch: true,
        enableImageGeneration: false,
        enableImageStreaming: false,
        imageGenerationCount: 0,
        forceConcise: true,
        toolOverrides: { video_generation: true },
        isReasoning: false,
        webpageUrls: [],
        disableTextFollowUps: true,
        disableMemory: true,
        enableSideBySide: false,
        sendFinalMetadata: true,
        customInstructions: "",
        returnImageBytes: false,
        returnRawGrokInXaiRequest: false,
        isAsyncChat: false,
        forceSideBySide: false,
        modelMode: null,
        responseMetadata: {
          requestModelDetails: { modelId: "grok-3" },
        },
      }),
    });

    if (!resp.ok) {
      return res
        .status(resp.status)
        .json({ status: "pending" });
    }

    const text = await resp.text();
    const videoUrl = extractVideoUrl(text);

    if (videoUrl) {
      return res.status(200).json({
        status: "done",
        video: { url: videoUrl },
      });
    }

    return res.status(200).json({ status: "pending" });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to check video status", details: String(err) });
  }
}
