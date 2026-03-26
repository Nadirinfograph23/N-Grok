from http.server import BaseHTTPRequestHandler
import json


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

            data = body.get('data')
            if not data:
                self._send_json(400, {"error": "No image data provided"})
                return

            content_type = body.get('content_type', 'image/png')
            filename = body.get('filename', 'upload')

            data_uri = f"data:{content_type};base64,{data}"

            self._send_json(200, {
                "data_uri": data_uri,
                "filename": filename,
            })

        except Exception as e:
            self._send_json(500, {"error": "Upload failed", "details": str(e)})

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
