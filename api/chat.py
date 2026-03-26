from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
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

            message = body.get('message')
            if not message:
                self._send_json(400, {"error": "Missing message"})
                return

            model = body.get('model', 'grok-3')
            conversation_id = body.get('conversationId')
            parent_response_id = body.get('parentResponseId')

            extra_data = None
            if conversation_id and parent_response_id:
                extra_data = {
                    "conversationId": conversation_id,
                    "parentResponseId": parent_response_id,
                }

            grok = Grok(model=model)
            result = grok.start_convo(
                message=message,
                extra_data=extra_data,
                customInstructions=body.get('customInstructions', ''),
                disableSearch=body.get('disableSearch', False),
                enableImageGeneration=body.get('enableImageGeneration', False),
                imageGenerationCount=body.get('imageGenerationCount', 2),
                isReasoning=body.get('isReasoning', False),
                webpageUrls=body.get('webpageUrls', []),
                forceConcise=False,
                disableTextFollowUps=False,
            )

            if result.get('error'):
                self._send_json(500, {"error": result['error']})
                return

            response_data = {
                "message": result.get("response", ""),
                "conversationId": result.get("conversationId"),
                "responseId": result.get("responseId"),
                "title": result.get("title"),
            }
            images = result.get("images")
            if images:
                response_data["images"] = images

            self._send_json(200, response_data)

        except Exception as e:
            self._send_json(500, {"error": "Chat request failed", "details": str(e)})

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
