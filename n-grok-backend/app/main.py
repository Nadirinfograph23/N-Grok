import os
import base64
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="N-Grok API", description="Proxy to GeminiGen AI API for image and video generation")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

GEMINIGEN_API_BASE = "https://api.geminigen.ai/uapi/v1"


def get_api_key() -> str:
    key = os.getenv("GEMINIGEN_API_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="GEMINIGEN_API_KEY not configured on server")
    return key


def get_headers() -> dict:
    return {
        "x-api-key": get_api_key(),
        "Accept": "application/json",
    }


# ---------- Health ----------

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


# ---------- Image Generation ----------

class ImageGenerateRequest(BaseModel):
    prompt: str
    model: str = "imagen-flash"
    aspect_ratio: str = "16:9"
    style: Optional[str] = None


@app.post("/api/images/generate")
async def generate_image(req: ImageGenerateRequest):
    form_data = {
        "prompt": req.prompt,
        "model": req.model,
        "aspect_ratio": req.aspect_ratio,
    }
    if req.style and req.style not in ("None", "none"):
        form_data["style"] = req.style

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{GEMINIGEN_API_BASE}/generate_image",
            headers=get_headers(),
            data=form_data,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    result = resp.json()
    # Transform GeminiGen response to match frontend expected format
    if "base64_images" in result:
        return {"data": [{"url": f"data:image/png;base64,{result['base64_images']}"}]}
    return result


# ---------- Image Editing ----------

class ImageEditRequest(BaseModel):
    prompt: str
    image_base64: str


@app.post("/api/images/edit")
async def edit_image(req: ImageEditRequest):
    # Use imagen-flash model which supports image reference
    # Strip data URI prefix if present
    base64_data = req.image_base64
    if ";base64," in base64_data:
        base64_data = base64_data.split(";base64,", 1)[1]

    image_bytes = base64.b64decode(base64_data)

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{GEMINIGEN_API_BASE}/generate_image",
            headers=get_headers(),
            data={"prompt": req.prompt, "model": "imagen-flash", "aspect_ratio": "16:9"},
            files={"files": ("reference.png", image_bytes, "image/png")},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    result = resp.json()
    if "base64_images" in result:
        return {"data": [{"url": f"data:image/png;base64,{result['base64_images']}"}]}
    return result


# ---------- Video Generation ----------

class VideoGenerateRequest(BaseModel):
    prompt: str
    model: str = "veo-2"
    aspect_ratio: str = "16:9"
    resolution: str = "720p"


@app.post("/api/videos/generate")
async def generate_video(req: VideoGenerateRequest):
    form_data = {
        "prompt": req.prompt,
        "model": req.model,
        "aspect_ratio": req.aspect_ratio,
        "resolution": req.resolution,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{GEMINIGEN_API_BASE}/video-gen/veo",
            headers=get_headers(),
            data=form_data,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    data = resp.json()
    # GeminiGen returns { id, uuid, status, ... }
    if "uuid" in data:
        return {
            "status": "submitted",
            "post_id": data["uuid"],
            "message": "Video generation request submitted successfully. Results will be sent to your webhook.",
        }
    return data


@app.get("/api/videos/status/{request_id}")
async def video_status(request_id: str):
    # GeminiGen uses webhooks for video results delivery
    return {
        "status": "processing",
        "post_id": request_id,
        "message": "Video is being processed. Results will be delivered to your configured webhook.",
    }


# ---------- Upload Image (base64 conversion) ----------

@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    content_type = file.content_type or "image/png"
    b64 = base64.b64encode(contents).decode("utf-8")
    data_uri = f"data:{content_type};base64,{b64}"
    return {"data_uri": data_uri, "filename": file.filename}
