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
  model?: string;
  aspect_ratio?: string;
  resolution?: string;
}

export interface VideoSubmitResponse {
  status: "submitted" | "processing";
  post_id?: string;
  message?: string;
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Video generation failed: ${err}`);
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
