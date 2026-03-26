from http.server import BaseHTTPRequestHandler
import json


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        # Extract requestId from URL path
        path_parts = self.path.split('/')
        request_id = path_parts[-1].split('?')[0] if path_parts else ''

        self._send_json(200, {
            "status": "processing",
            "post_id": request_id,
            "message": "Video is being processed. Results will be delivered when ready.",
        })

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
