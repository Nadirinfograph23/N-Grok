import os
import base64
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="N-Grok API", description="Proxy to xAI Grok Imagine API for image and video generation")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

XAI_API_BASE = "https://api.x.ai/v1"


def get_api_key() -> str:
    key = os.getenv("XAI_API_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="XAI_API_KEY not configured on server")
    return key


def get_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {get_api_key()}",
    }


# ---------- Health ----------

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


# ---------- Image Generation ----------

class ImageGenerateRequest(BaseModel):
    prompt: str
    n: int = 1
    aspect_ratio: str = "auto"
    response_format: str = "url"


@app.post("/api/images/generate")
async def generate_image(req: ImageGenerateRequest):
    payload: dict = {
        "model": "grok-imagine-image",
        "prompt": req.prompt,
        "n": req.n,
        "response_format": req.response_format,
    }
    if req.aspect_ratio != "auto":
        payload["aspect_ratio"] = req.aspect_ratio

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{XAI_API_BASE}/images/generations",
            headers=get_headers(),
            json=payload,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


# ---------- Image Editing ----------

class ImageEditRequest(BaseModel):
    prompt: str
    image_url: str
    n: int = 1
    response_format: str = "url"


@app.post("/api/images/edit")
async def edit_image(req: ImageEditRequest):
    payload = {
        "model": "grok-imagine-image",
        "prompt": req.prompt,
        "image": {
            "url": req.image_url,
            "type": "image_url",
        },
        "n": req.n,
        "response_format": req.response_format,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{XAI_API_BASE}/images/edits",
            headers=get_headers(),
            json=payload,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


# ---------- Video Generation ----------

class VideoGenerateRequest(BaseModel):
    prompt: str
    duration: int = 6
    aspect_ratio: str = "16:9"
    resolution: str = "480p"
    image_url: Optional[str] = None


@app.post("/api/videos/generate")
async def generate_video(req: VideoGenerateRequest):
    payload: dict = {
        "model": "grok-imagine-video",
        "prompt": req.prompt,
        "duration": req.duration,
        "aspect_ratio": req.aspect_ratio,
        "resolution": req.resolution,
    }
    if req.image_url:
        payload["image_url"] = req.image_url

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{XAI_API_BASE}/videos/generations",
            headers=get_headers(),
            json=payload,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


@app.get("/api/videos/status/{request_id}")
async def video_status(request_id: str):
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{XAI_API_BASE}/videos/{request_id}",
            headers={"Authorization": f"Bearer {get_api_key()}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


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
