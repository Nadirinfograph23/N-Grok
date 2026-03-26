const API_URL = import.meta.env.VITE_API_URL || "";

export interface ImageGenerateRequest {
  prompt: string;
  model?: string;
  aspect_ratio?: string;
  style?: string;
}

export interface ImageEditRequest {
  prompt: string;
  image_base64: string;
}

export interface VideoGenerateRequest {
  prompt: string;
  width?: number;
  height?: number;
  video_length?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  flow_shift?: number;
  embedded_guidance_scale?: number;
  seed?: number;
  image?: string;
}

export interface VideoSubmitResponse {
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  prediction_id?: string;
  video_url?: string;
  message?: string;
  error?: string;
  logs?: string;
}

export interface ChatRequest {
  message: string;
  model?: string;
  conversationId?: string;
  parentResponseId?: string;
  customInstructions?: string;
  disableSearch?: boolean;
  enableImageGeneration?: boolean;
  imageGenerationCount?: number;
  isReasoning?: boolean;
  webpageUrls?: string[];
}

export interface ChatResponse {
  message: string;
  images?: string[];
  conversationId?: string;
  responseId?: string;
  title?: string;
  error?: string;
}

export interface ImageResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

export async function generateImage(req: ImageGenerateRequest): Promise<ImageResponse> {
  const res = await fetch(`${API_URL}/api/images/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image generation failed: ${err}`);
  }
  return res.json();
}

export async function editImage(req: ImageEditRequest): Promise<ImageResponse> {
  const res = await fetch(`${API_URL}/api/images/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image editing failed: ${err}`);
  }
  return res.json();
}

export async function generateVideo(req: VideoGenerateRequest): Promise<VideoSubmitResponse> {
  const res = await fetch(`${API_URL}/api/videos/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok && res.status !== 202) {
    let errorMessage = "Video generation failed";
    try {
      const data = await res.json();
      errorMessage = data.error || data.message || errorMessage;
    } catch {
      errorMessage = await res.text();
    }
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function checkVideoStatus(predictionId: string): Promise<VideoSubmitResponse> {
  const res = await fetch(`${API_URL}/api/videos/status/${predictionId}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Status check failed: ${err}`);
  }
  return res.json();
}

export async function sendChat(req: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chat failed: ${err}`);
  }
  return res.json();
}

export async function uploadImage(file: File): Promise<{ data_uri: string; filename: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const res = await fetch(`${API_URL}/api/upload-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: base64,
      content_type: file.type || "image/png",
      filename: file.name,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image upload failed: ${err}`);
  }
  return res.json();
}
