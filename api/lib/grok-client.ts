import { generateKeys, signChallenge } from "./anon";
import { generateSign } from "./signature";
import { getAnim, parseValuesAsync, parseGrokAsync } from "./parser";
import {
  LOAD_HEADERS,
  C_REQUEST_HEADERS,
  CONVERSATION_HEADERS,
  fixOrder,
} from "./headers";
import { between, uuidv4, randomHex } from "./utils";

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

interface CookieJar {
  [key: string]: string;
}

function parseCookies(
  setCookieHeaders: string[],
  existing: CookieJar
): CookieJar {
  const jar = { ...existing };
  for (const header of setCookieHeaders) {
    const parts = header.split(";")[0];
    const eqIdx = parts.indexOf("=");
    if (eqIdx > 0) {
      const name = parts.substring(0, eqIdx).trim();
      const value = parts.substring(eqIdx + 1).trim();
      jar[name] = value;
    }
  }
  return jar;
}

function cookieString(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

// ---------------------------------------------------------------------------
// Model mapping  (aligned with Grok3API modelName values)
// ---------------------------------------------------------------------------

const MODELS: Record<string, [string, string]> = {
  "grok-3": ["MODEL_MODE_AUTO", "auto"],
  "grok-3-auto": ["MODEL_MODE_AUTO", "auto"],
  "grok-3-fast": ["MODEL_MODE_FAST", "fast"],
  "grok-4": ["MODEL_MODE_EXPERT", "expert"],
  "grok-4-mini-thinking-tahoe": [
    "MODEL_MODE_GROK_4_MINI_THINKING",
    "grok-4-mini-thinking",
  ],
};

function getModelMode(model: string, index: number): string {
  const entry = MODELS[model] || MODELS["grok-3"];
  return entry[index];
}

// ---------------------------------------------------------------------------
// Response types  (aligned with Grok3API GrokResponse / ModelResponse)
// ---------------------------------------------------------------------------

export interface ModelResponse {
  responseId: string;
  message: string;
  sender: string;
  generatedImageUrls: string[];
  query: string;
}

export interface GrokResponse {
  modelResponse: ModelResponse;
  isThinking: boolean;
  isSoftStop: boolean;
  responseId: string;
  conversationId: string | null;
  title: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Ask parameters  (aligned with Grok3API GrokClient.ask())
// ---------------------------------------------------------------------------

export interface AskGrokOptions {
  message: string;
  modelName?: string;
  temporary?: boolean;
  fileAttachments?: string[];
  imageAttachments?: string[];
  customInstructions?: string;
  deepsearchPreset?: string;
  disableSearch?: boolean;
  enableImageGeneration?: boolean;
  enableImageStreaming?: boolean;
  enableSideBySide?: boolean;
  imageGenerationCount?: number;
  isPreset?: boolean;
  isReasoning?: boolean;
  returnImageBytes?: boolean;
  returnRawGrokInXaiRequest?: boolean;
  sendFinalMetadata?: boolean;
  toolOverrides?: Record<string, unknown>;
  forceConcise?: boolean;
  disableTextFollowUps?: boolean;
  webpageUrls?: string[];
  disableArtifact?: boolean;
  responseModelId?: string;
  conversationId?: string;
  parentResponseId?: string;
}

// ---------------------------------------------------------------------------
// Session bootstrap - obtain cookies + x-statsig-id from grok.com
// ---------------------------------------------------------------------------

interface SessionContext {
  cookies: CookieJar;
  baggage: string;
  sentryTrace: string;
  xsid: string;
}

async function bootstrapSession(): Promise<SessionContext> {
  let cookies: CookieJar = {};

  // Step 1: Load grok.com/c
  const loadResp = await fetch("https://grok.com/c", {
    headers: LOAD_HEADERS,
    redirect: "manual",
  });

  const loadHtml = await loadResp.text();
  const setCookies =
    ((loadResp.headers as any).getSetCookie?.() as string[]) || [];
  cookies = parseCookies(setCookies, cookies);

  // Extract scripts (support both relative and CDN-absolute URLs)
  const scriptMatches =
    loadHtml.match(/<script[^>]+src="((?:https:\/\/cdn\.grok\.com)?\/[^"]*_next\/static\/chunks\/[^"]+)"/g) || [];
  const scripts = scriptMatches
    .map((m: string) => {
      const match = m.match(/src="([^"]+)"/);
      return match ? match[1] : "";
    })
    .filter((s: string) => s.includes("/_next/static/chunks/"));

  const { actions, xsidScript } = await parseGrokAsync(scripts);

  const baggage = between(loadHtml, '<meta name="baggage" content="', '"');
  const sentryTrace = between(
    loadHtml,
    '<meta name="sentry-trace" content="',
    "-"
  );

  const keys = generateKeys();

  // Step 2: First c_request (multipart with public key)
  // IMPORTANT: Part "1" (binary blob) must come before part "0" (JSON) to match
  // the order used by curl_cffi CurlMime in the reference Python implementation.
  const boundary = `----formdata-${randomHex(8)}`;
  const publicKeyBytes = new Uint8Array(keys.userPublicKey);

  let multipartPreamble = "";
  multipartPreamble += `--${boundary}\r\n`;
  multipartPreamble += `Content-Disposition: form-data; name="1"; filename="blob"\r\n`;
  multipartPreamble += `Content-Type: application/octet-stream\r\n\r\n`;

  const multipartPostamble =
    `\r\n--${boundary}\r\n` +
    `Content-Disposition: form-data; name="0"\r\n\r\n` +
    `[{"userPublicKey":"$o1"}]\r\n` +
    `--${boundary}--\r\n`;

  const textEncoder = new TextEncoder();
  const preamble = textEncoder.encode(multipartPreamble);
  const postamble = textEncoder.encode(multipartPostamble);

  const body1 = new Uint8Array(
    preamble.length + publicKeyBytes.length + postamble.length
  );
  body1.set(preamble, 0);
  body1.set(publicKeyBytes, preamble.length);
  body1.set(postamble, preamble.length + publicKeyBytes.length);

  const cReqHeaders1: Record<string, string> = {
    ...C_REQUEST_HEADERS,
    "next-action": actions[0],
    baggage,
    "sentry-trace": `${sentryTrace}-${uuidv4().replace(/-/g, "").substring(0, 16)}-0`,
    "content-type": `multipart/form-data; boundary=${boundary}`,
    cookie: cookieString(cookies),
  };
  delete cReqHeaders1["content-type"];
  cReqHeaders1["content-type"] = `multipart/form-data; boundary=${boundary}`;

  const cResp1 = await fetch("https://grok.com/c", {
    method: "POST",
    headers: fixOrder(cReqHeaders1, C_REQUEST_HEADERS),
    body: body1,
    redirect: "manual",
  });

  const cResp1Text = await cResp1.text();
  const setCookies1 =
    ((cResp1.headers as any).getSetCookie?.() as string[]) || [];
  cookies = parseCookies(setCookies1, cookies);

  if (!cResp1Text.includes('"anonUserId"')) {
    throw new Error(
      `First c_request failed (status ${cResp1.status}): ${cResp1Text.substring(0, 200)}`
    );
  }
  const anonUser = between(cResp1Text, '{"anonUserId":"', '"');

  // Step 3: Second c_request
  const cReqHeaders2: Record<string, string> = {
    ...C_REQUEST_HEADERS,
    "next-action": actions[1],
    baggage,
    "sentry-trace": `${sentryTrace}-${uuidv4().replace(/-/g, "").substring(0, 16)}-0`,
    "content-type": "text/plain;charset=UTF-8",
    cookie: cookieString(cookies),
  };

  const cResp2 = await fetch("https://grok.com/c", {
    method: "POST",
    headers: fixOrder(cReqHeaders2, C_REQUEST_HEADERS),
    body: JSON.stringify([{ anonUserId: anonUser }]),
    redirect: "manual",
  });

  const cResp2Bytes = new Uint8Array(await cResp2.arrayBuffer());
  const setCookies2 =
    ((cResp2.headers as any).getSetCookie?.() as string[]) || [];
  cookies = parseCookies(setCookies2, cookies);

  // Extract challenge from hex response
  const hexStr = Buffer.from(cResp2Bytes).toString("hex");
  const startMarker = "3a6f38362c";
  let challengeBytes: Uint8Array;

  const startIdx = hexStr.indexOf(startMarker);
  if (startIdx !== -1) {
    const dataStart = startIdx + startMarker.length;
    const endIdx = hexStr.indexOf("313a", dataStart);
    if (endIdx !== -1) {
      const challengeHex = hexStr.substring(dataStart, endIdx);
      challengeBytes = Buffer.from(challengeHex, "hex");
    } else {
      throw new Error("Could not find challenge end marker");
    }
  } else {
    throw new Error("Could not find challenge start marker");
  }

  const challengeDict = signChallenge(challengeBytes, keys.privateKey);

  // Step 4: Third c_request (with challenge solution)
  const cReqHeaders3: Record<string, string> = {
    ...C_REQUEST_HEADERS,
    "next-action": actions[2],
    baggage,
    "sentry-trace": `${sentryTrace}-${uuidv4().replace(/-/g, "").substring(0, 16)}-0`,
    "content-type": "text/plain;charset=UTF-8",
    cookie: cookieString(cookies),
  };

  const cResp3 = await fetch("https://grok.com/c", {
    method: "POST",
    headers: fixOrder(cReqHeaders3, C_REQUEST_HEADERS),
    body: JSON.stringify([{ anonUserId: anonUser, ...challengeDict }]),
    redirect: "manual",
  });

  const cResp3Text = await cResp3.text();
  const setCookies3 =
    ((cResp3.headers as any).getSetCookie?.() as string[]) || [];
  cookies = parseCookies(setCookies3, cookies);

  // Parse verification token and SVG data
  const { verificationToken, anim } = getAnim(cResp3Text);
  const { svgData, numbers } = await parseValuesAsync(
    cResp3Text,
    anim,
    xsidScript
  );

  // Generate x-statsig-id
  const xsid = generateSign(
    "/rest/app-chat/conversations/new",
    "POST",
    verificationToken,
    svgData,
    numbers
  );

  return { cookies, baggage, sentryTrace, xsid };
}

// ---------------------------------------------------------------------------
// Upload image to grok.com  (aligned with Grok3API _upload_image)
// ---------------------------------------------------------------------------

export async function uploadImageToGrok(
  base64Content: string,
  fileName: string,
  fileMimeType: string,
  session: SessionContext
): Promise<string> {
  const uploadHeaders: Record<string, string> = {
    ...CONVERSATION_HEADERS,
    "x-statsig-id": session.xsid,
    "x-xai-request-id": uuidv4(),
    cookie: cookieString(session.cookies),
  };

  const resp = await fetch("https://grok.com/rest/app-chat/upload-file", {
    method: "POST",
    headers: fixOrder(uploadHeaders, CONVERSATION_HEADERS),
    body: JSON.stringify({
      fileName,
      fileMimeType,
      content: base64Content,
    }),
    redirect: "manual",
  });

  const data = await resp.json();
  if (!data.fileMetadataId) {
    throw new Error("Server response does not contain fileMetadataId");
  }
  return data.fileMetadataId;
}

// ---------------------------------------------------------------------------
// Parse Grok streaming response  (aligned with Grok3API _send_request)
// ---------------------------------------------------------------------------

function parseGrokStreamResponse(responseText: string): GrokResponse {
  let finalResponse: ModelResponse | null = null;
  let conversationId: string | null = null;
  let title: string | null = null;
  let isThinking = false;
  let isSoftStop = false;
  let responseId = "";

  const emptyModel: ModelResponse = {
    responseId: "",
    message: "",
    sender: "",
    generatedImageUrls: [],
    query: "",
  };

  const lines = responseText.trim().split("\n");
  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      const result = data?.result || {};

      // Extract conversation info
      if (result.conversation) {
        conversationId =
          conversationId || result.conversation.conversationId || null;
        title = title || result.conversation.title || null;
      }

      // Extract title
      if (result.title?.newTitle) {
        title = result.title.newTitle;
      }

      // Extract thinking / soft stop flags
      if (result.response?.isThinking !== undefined) {
        isThinking = result.response.isThinking;
      }
      if (result.response?.isSoftStop !== undefined) {
        isSoftStop = result.response.isSoftStop;
      }

      // Extract modelResponse (keep last complete one)
      const mr =
        result.response?.modelResponse || result.modelResponse || null;
      if (mr && mr.message !== undefined) {
        finalResponse = {
          responseId: mr.responseId || "",
          message: mr.message || "",
          sender: mr.sender || "",
          generatedImageUrls: mr.generatedImageUrls || [],
          query: mr.query || "",
        };
        responseId = mr.responseId || responseId;
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  if (!finalResponse) {
    if (responseText.includes("rejected by anti-bot rules")) {
      return {
        modelResponse: emptyModel,
        isThinking: false,
        isSoftStop: false,
        responseId: "",
        conversationId: null,
        title: null,
        error: "Request rejected by anti-bot rules. Please try again.",
      };
    }
    if (responseText.includes("Grok is under heavy usage")) {
      return {
        modelResponse: emptyModel,
        isThinking: false,
        isSoftStop: false,
        responseId: "",
        conversationId: null,
        title: null,
        error: "Grok is under heavy usage right now. Please try again later.",
      };
    }
    if (responseText.includes("Too many requests")) {
      return {
        modelResponse: emptyModel,
        isThinking: false,
        isSoftStop: false,
        responseId: "",
        conversationId: null,
        title: null,
        error: "Too many requests. Please try again later.",
      };
    }

    return {
      modelResponse: emptyModel,
      isThinking: false,
      isSoftStop: false,
      responseId: "",
      conversationId: null,
      title: null,
      error: `Unexpected response from Grok: ${responseText.substring(0, 200)}`,
    };
  }

  return {
    modelResponse: finalResponse,
    isThinking,
    isSoftStop,
    responseId,
    conversationId,
    title,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// askGrok - main entry point  (aligned with Grok3API GrokClient.ask())
// ---------------------------------------------------------------------------

export async function askGrok(options: AskGrokOptions): Promise<GrokResponse> {
  const {
    message,
    modelName = "grok-3",
    temporary = false,
    fileAttachments = [],
    imageAttachments = [],
    customInstructions = "",
    deepsearchPreset = "",
    disableSearch = false,
    enableImageGeneration = true,
    enableImageStreaming = true,
    enableSideBySide = true,
    imageGenerationCount = 2,
    isPreset = false,
    isReasoning = false,
    returnImageBytes = false,
    returnRawGrokInXaiRequest = false,
    sendFinalMetadata = true,
    toolOverrides = {},
    forceConcise = true,
    disableTextFollowUps = true,
    webpageUrls = [],
    disableArtifact = false,
    responseModelId,
    conversationId,
    parentResponseId,
  } = options;

  const modelMode = getModelMode(modelName, 0);
  const session = await bootstrapSession();

  // Determine target URL (new vs existing conversation)
  const targetUrl = conversationId
    ? `https://grok.com/rest/app-chat/conversations/${conversationId}/responses`
    : "https://grok.com/rest/app-chat/conversations/new";

  // Build payload (aligned with reference Python Grok implementation)
  const payload: Record<string, unknown> = {
    temporary,
    modelName,
    message,
    fileAttachments,
    imageAttachments,
    disableSearch,
    enableImageGeneration,
    returnImageBytes,
    returnRawGrokInXaiRequest,
    enableImageStreaming,
    imageGenerationCount,
    forceConcise,
    toolOverrides,
    enableSideBySide,
    sendFinalMetadata,
    isReasoning,
    disableTextFollowUps,
    webpageUrls,
    responseMetadata: {
      requestModelDetails: {
        modelId: responseModelId || modelName,
      },
    },
    disableMemory: false,
    forceSideBySide: false,
    modelMode,
    isAsyncChat: false,
  };

  if (parentResponseId) {
    payload.parentResponseId = parentResponseId;
  }

  // Build headers
  const convHeaders: Record<string, string> = {
    ...CONVERSATION_HEADERS,
    baggage: session.baggage,
    "sentry-trace": `${session.sentryTrace}-${uuidv4().replace(/-/g, "").substring(0, 16)}-0`,
    "x-statsig-id": session.xsid,
    "x-xai-request-id": uuidv4(),
    traceparent: `00-${randomHex(16)}-${randomHex(8)}-00`,
    cookie: cookieString(session.cookies),
  };

  const convResp = await fetch(targetUrl, {
    method: "POST",
    headers: fixOrder(convHeaders, CONVERSATION_HEADERS),
    body: JSON.stringify(payload),
    redirect: "manual",
  });

  const convText = await convResp.text();
  return parseGrokStreamResponse(convText);
}

// ---------------------------------------------------------------------------
// Legacy wrapper for backward compatibility
// ---------------------------------------------------------------------------

export interface GrokImageResult {
  response: string | null;
  images: string[] | null;
  error?: string;
}

export async function generateImageWithGrok(
  prompt: string,
  model: string = "grok-3"
): Promise<GrokImageResult> {
  const grokResp = await askGrok({
    message: prompt,
    modelName: model,
    enableImageGeneration: true,
    imageGenerationCount: 2,
    forceConcise: true,
    disableTextFollowUps: true,
  });

  if (grokResp.error) {
    return { response: null, images: null, error: grokResp.error };
  }

  const images =
    grokResp.modelResponse.generatedImageUrls.length > 0
      ? grokResp.modelResponse.generatedImageUrls
      : null;

  return {
    response: grokResp.modelResponse.message || null,
    images,
  };
}
