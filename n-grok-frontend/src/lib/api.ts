const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface ImageGenerateRequest {
  prompt: string;
  n?: number;
  aspect_ratio?: string;
  response_format?: string;
}

export interface ImageEditRequest {
  prompt: string;
  image_url: string;
  n?: number;
  response_format?: string;
}

export interface VideoGenerateRequest {
  prompt: string;
  duration?: number;
  aspect_ratio?: string;
  resolution?: string;
  image_url?: string;
}

export interface VideoStatusResponse {
  status: "pending" | "done" | "expired" | "failed";
  video?: {
    url: string;
    duration?: number;
  };
  model?: string;
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

export async function generateVideo(req: VideoGenerateRequest): Promise<{ request_id: string }> {
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

export async function getVideoStatus(requestId: string): Promise<VideoStatusResponse> {
  const res = await fetch(`${API_URL}/api/videos/status/${requestId}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Video status check failed: ${err}`);
  }
  return res.json();
}

export async function uploadImage(file: File): Promise<{ data_uri: string; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/api/upload-image`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Image upload failed: ${err}`);
  }
  return res.json();
}
