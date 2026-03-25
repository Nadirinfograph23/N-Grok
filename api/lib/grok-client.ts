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

const MODELS: Record<string, [string, string]> = {
  "grok-3-auto": ["MODEL_MODE_AUTO", "auto"],
  "grok-3-fast": ["MODEL_MODE_FAST", "fast"],
  "grok-4": ["MODEL_MODE_EXPERT", "expert"],
  "grok-4-mini-thinking-tahoe": [
    "MODEL_MODE_GROK_4_MINI_THINKING",
    "grok-4-mini-thinking",
  ],
};

function getModelMode(model: string, index: number): string {
  const entry = MODELS[model] || MODELS["grok-3-auto"];
  return entry[index];
}

export interface GrokImageResult {
  response: string | null;
  images: string[] | null;
  error?: string;
}

export async function generateImageWithGrok(
  prompt: string,
  model: string = "grok-3-auto"
): Promise<GrokImageResult> {
  const modelMode = getModelMode(model, 0);
  const keys = generateKeys();
  let cookies: CookieJar = {};

  // Step 1: Load grok.com/c
  const loadResp = await fetch("https://grok.com/c", {
    headers: LOAD_HEADERS,
    redirect: "manual",
  });

  const loadHtml = await loadResp.text();
  const setCookies = (loadResp.headers as any).getSetCookie?.() as string[] || [];
  cookies = parseCookies(setCookies, cookies);

  // Extract scripts
  const scriptMatches =
    loadHtml.match(/<script[^>]+src="(\/_next\/static\/chunks\/[^"]+)"/g) || [];
  const scripts = scriptMatches
    .map((m: string) => {
      const match = m.match(/src="([^"]+)"/);
      return match ? match[1] : "";
    })
    .filter((s: string) => s.startsWith("/_next/static/chunks/"));

  // Parse scripts to get actions and xsid script
  const { actions, xsidScript } = await parseGrokAsync(scripts);

  const baggage = between(
    loadHtml,
    '<meta name="baggage" content="',
    '"'
  );
  const sentryTrace = between(
    loadHtml,
    '<meta name="sentry-trace" content="',
    "-"
  );

  // Step 2: First c_request (multipart with public key)
  const boundary = `----formdata-${randomHex(8)}`;
  const publicKeyBytes = new Uint8Array(keys.userPublicKey);

  // Build multipart body manually
  let multipartBody = "";
  multipartBody += `--${boundary}\r\n`;
  multipartBody += `Content-Disposition: form-data; name="0"\r\n\r\n`;
  multipartBody += `[{"userPublicKey":"$o1"}]\r\n`;
  multipartBody += `--${boundary}\r\n`;
  multipartBody += `Content-Disposition: form-data; name="1"; filename="blob"\r\n`;
  multipartBody += `Content-Type: application/octet-stream\r\n\r\n`;

  // We need to send binary data, so use ArrayBuffer approach
  const textEncoder = new TextEncoder();
  const preamble = textEncoder.encode(multipartBody);
  const postamble = textEncoder.encode(`\r\n--${boundary}--\r\n`);

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
  const setCookies1 = (cResp1.headers as any).getSetCookie?.() as string[] || [];
  cookies = parseCookies(setCookies1, cookies);

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
  const setCookies2 = (cResp2.headers as any).getSetCookie?.() as string[] || [];
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
  const setCookies3 = (cResp3.headers as any).getSetCookie?.() as string[] || [];
  cookies = parseCookies(setCookies3, cookies);

  // Parse verification token and SVG data
  const { verificationToken, anim } = getAnim(cResp3Text);
  const { svgData, numbers } = await parseValuesAsync(
    cResp3Text,
    anim,
    xsidScript
  );

  // Step 5: Generate signature and make conversation request
  const xsid = generateSign(
    "/rest/app-chat/conversations/new",
    "POST",
    verificationToken,
    svgData,
    numbers
  );

  const convHeaders: Record<string, string> = {
    ...CONVERSATION_HEADERS,
    baggage,
    "sentry-trace": `${sentryTrace}-${uuidv4().replace(/-/g, "").substring(0, 16)}-0`,
    "x-statsig-id": xsid,
    "x-xai-request-id": uuidv4(),
    traceparent: `00-${randomHex(16)}-${randomHex(8)}-00`,
    cookie: cookieString(cookies),
  };

  const conversationData = {
    temporary: false,
    modelName: model,
    message: prompt,
    fileAttachments: [],
    imageAttachments: [],
    disableSearch: false,
    enableImageGeneration: true,
    returnImageBytes: false,
    returnRawGrokInXaiRequest: false,
    enableImageStreaming: true,
    imageGenerationCount: 2,
    forceConcise: false,
    toolOverrides: {},
    enableSideBySide: true,
    sendFinalMetadata: true,
    isReasoning: false,
    webpageUrls: [],
    disableTextFollowUps: false,
    responseMetadata: {
      requestModelDetails: {
        modelId: model,
      },
    },
    disableMemory: false,
    forceSideBySide: false,
    modelMode: modelMode,
    isAsyncChat: false,
  };

  const convResp = await fetch(
    "https://grok.com/rest/app-chat/conversations/new",
    {
      method: "POST",
      headers: fixOrder(convHeaders, CONVERSATION_HEADERS),
      body: JSON.stringify(conversationData),
      redirect: "manual",
    }
  );

  const convText = await convResp.text();

  if (convText.includes("modelResponse")) {
    let response: string | null = null;
    let imageUrls: string[] | null = null;

    const lines = convText.trim().split("\n");
    for (const line of lines) {
      try {
        const data = JSON.parse(line);

        if (
          !response &&
          data?.result?.response?.modelResponse?.message
        ) {
          response = data.result.response.modelResponse.message;
        }

        if (
          !imageUrls &&
          data?.result?.response?.modelResponse?.generatedImageUrls
        ) {
          const urls =
            data.result.response.modelResponse.generatedImageUrls;
          if (urls && (Array.isArray(urls) ? urls.length > 0 : true)) {
            imageUrls = Array.isArray(urls) ? urls : [urls];
          }
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    return { response, images: imageUrls };
  } else if (convText.includes("rejected by anti-bot rules")) {
    return {
      response: null,
      images: null,
      error: "Request rejected by anti-bot rules. Please try again.",
    };
  } else if (convText.includes("Grok is under heavy usage")) {
    return {
      response: null,
      images: null,
      error: "Grok is under heavy usage right now. Please try again later.",
    };
  } else {
    return {
      response: null,
      images: null,
      error: `Unexpected response from Grok: ${convText.substring(0, 200)}`,
    };
  }
}
