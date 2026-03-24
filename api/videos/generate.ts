import type { VercelRequest, VercelResponse } from "@vercel/node";

const MEDIA_POST_CREATE_URL = "https://grok.com/rest/media/post/create";
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

async function createVideoPost(
  sso: string,
  prompt: string
): Promise<string | null> {
  const resp = await fetch(MEDIA_POST_CREATE_URL, {
    method: "POST",
    headers: getHeaders(sso),
    body: JSON.stringify({
      mediaType: "MEDIA_POST_TYPE_VIDEO",
      prompt,
    }),
  });

  if (!resp.ok) return null;

  const data = await resp.json();
  return data?.post?.id ?? null;
}

function buildVideoChatPayload(prompt: string) {
  return {
    temporary: true,
    modelName: "grok-3",
    message: prompt,
    fileAttachments: [],
    imageAttachments: [],
    disableSearch: true,
    enableImageGeneration: false,
    enableImageStreaming: false,
    imageGenerationCount: 0,
    forceConcise: false,
    toolOverrides: {
      video_generation: true,
    },
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

function extractVideoUrl(text: string): string | null {
  const lines = text.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      const r = data?.result?.response;
      if (!r) continue;

      // Check for video URL in various response shapes
      if (r.modelResponse?.videoUrl) return r.modelResponse.videoUrl;
      if (r.videoAttachment?.videoUrl) return r.videoAttachment.videoUrl;
      if (r.streamingVideoResponse?.videoUrl)
        return r.streamingVideoResponse.videoUrl;
      if (r.mediaPostVideoUrl) return r.mediaPostVideoUrl;
    } catch {
      // skip non-JSON lines
    }
  }

  // Fallback: regex for video URLs
  const videoUrlRegex =
    /https:\/\/[^\s"']+\.(?:mp4|webm|mov)/g;
  for (const line of lines) {
    const matches = line.match(videoUrlRegex);
    if (matches && matches.length > 0) return matches[0];
  }

  return null;
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

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    // Step 1: Create media post for video
    const postId = await createVideoPost(sso, prompt);

    // Step 2: Start video generation via chat endpoint
    const resp = await fetch(GROK_CHAT_URL, {
      method: "POST",
      headers: getHeaders(sso),
      body: JSON.stringify(buildVideoChatPayload(prompt)),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return res.status(resp.status).json({
        error: `Grok API error (${resp.status})`,
        details: errText.slice(0, 500),
      });
    }

    const text = await resp.text();
    const videoUrl = extractVideoUrl(text);

    if (videoUrl) {
      return res.status(200).json({
        status: "done",
        video: { url: videoUrl },
        post_id: postId,
      });
    }

    // If no video URL found yet, return post_id so frontend can poll
    if (postId) {
      return res.status(200).json({
        status: "pending",
        post_id: postId,
      });
    }

    return res.status(500).json({
      error: "Video generation failed",
      details: "No video URL or post ID returned",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to call Grok API", details: String(err) });
  }
}
