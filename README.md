# N-Grok

AI Video & Image Generator powered by xAI's Grok Imagine API. This project replicates the mechanism used by services like GeminiGen AI to access Grok's video and image generation capabilities.

## Architecture

- **Backend**: FastAPI proxy to xAI Grok Imagine API
- **Frontend**: React + Vite + Tailwind CSS

## Features

- **Video Generation**: Text-to-video using `grok-imagine-video` model
- **Image-to-Video**: Animate still images with text prompts
- **Image Generation**: Text-to-image using `grok-imagine-image` model
- **Image Editing**: Edit existing images with natural language prompts
- Configurable duration, aspect ratio, and resolution
- Async video generation with automatic status polling
- Image upload with base64 conversion

## xAI API Endpoints Used

| Feature | Endpoint | Model |
|---------|----------|-------|
| Image Generation | `POST /v1/images/generations` | `grok-imagine-image` |
| Image Editing | `POST /v1/images/edits` | `grok-imagine-image` |
| Video Generation | `POST /v1/videos/generations` | `grok-imagine-video` |
| Video Status | `GET /v1/videos/{request_id}` | - |

## Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- xAI API Key ([get one here](https://console.x.ai/))

### Backend

```bash
cd n-grok-backend
cp .env.example .env  # Add your XAI_API_KEY
poetry install
poetry run fastapi dev app/main.py
```

Backend runs at `http://localhost:8000`

### Frontend

```bash
cd n-grok-frontend
cp .env.example .env  # Configure API URL
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

## Environment Variables

### Backend (`n-grok-backend/.env`)
```
XAI_API_KEY=your-xai-api-key-here
```

### Frontend (`n-grok-frontend/.env`)
```
VITE_API_URL=http://localhost:8000
```

## API Reference

### Generate Image
```bash
curl -X POST http://localhost:8000/api/images/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A beautiful sunset over mountains", "aspect_ratio": "16:9"}'
```

### Generate Video
```bash
curl -X POST http://localhost:8000/api/videos/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A majestic eagle soaring through mountain peaks", "duration": 6, "resolution": "480p"}'
```

### Check Video Status
```bash
curl http://localhost:8000/api/videos/status/{request_id}
```

## How It Works

1. User enters a text prompt (and optionally uploads a reference image)
2. Frontend sends the request to the FastAPI backend
3. Backend proxies the request to xAI's Grok Imagine API (`api.x.ai/v1`)
4. For images: response is returned immediately with image URLs
5. For videos: a `request_id` is returned, then the frontend polls for status every 5 seconds until the video is ready

## License

MIT
