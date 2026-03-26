from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from grok_lib.client import Grok


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}

            prompt = body.get('prompt')
            if not prompt:
                self._send_json(400, {"error": "Missing prompt"})
                return

            model = body.get('model', 'grok-3')
            image_count = body.get('imageGenerationCount', 2)

            grok = Grok(model=model)
            result = grok.start_convo(
                message=f"Generate an image: {prompt}",
                enableImageGeneration=True,
                imageGenerationCount=image_count,
                forceConcise=True,
                disableTextFollowUps=True,
            )

            if result.get('error'):
                self._send_json(500, {"error": result['error']})
                return

            image_urls = result.get("images") or []
            if image_urls:
                self._send_json(200, {
                    "data": [{"url": url} for url in image_urls],
                })
            else:
                self._send_json(200, {
                    "data": [],
                    "message": result.get("response") or "No images were generated. Try a different prompt.",
                })

        except Exception as e:
            self._send_json(500, {"error": "Failed to generate image", "details": str(e)})

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
