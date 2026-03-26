from grok_lib.utils import between
from grok_lib.headers import Headers
from grok_lib.anon import Anon
from grok_lib.parser import Parser
from grok_lib.signature import Signature
from curl_cffi import requests, CurlMime
from dataclasses import dataclass, field
from bs4 import BeautifulSoup
from json import dumps, loads
from secrets import token_hex
from uuid import uuid4


@dataclass
class Models:
    models: dict[str, list[str]] = field(default_factory=lambda: {
        "grok-3": ["MODEL_MODE_AUTO", "auto"],
        "grok-3-auto": ["MODEL_MODE_AUTO", "auto"],
        "grok-3-fast": ["MODEL_MODE_FAST", "fast"],
        "grok-4": ["MODEL_MODE_EXPERT", "expert"],
        "grok-4-mini-thinking-tahoe": ["MODEL_MODE_GROK_4_MINI_THINKING", "grok-4-mini-thinking"]
    })

    def get_model_mode(self, model: str, index: int) -> str:
        return self.models.get(model, ["MODEL_MODE_AUTO", "auto"])[index]

_Models = Models()


class Grok:

    def __init__(self, model: str = "grok-3-auto", proxy: str = None) -> None:
        self.session: requests.Session = requests.Session(impersonate="chrome136", default_headers=False)
        self.headers: Headers = Headers()

        self.model_mode: str = _Models.get_model_mode(model, 0)
        self.model: str = model
        self.mode: str = _Models.get_model_mode(model, 1)
        self.c_run: int = 0
        self.keys: dict = Anon.generate_keys()
        if proxy:
            self.session.proxies = {
                "all": proxy
            }

    def _load(self, extra_data: dict = None) -> None:

        if not extra_data:
            self.session.headers = self.headers.LOAD
            load_site = self.session.get('https://grok.com/c')
            self.session.cookies.update(load_site.cookies)

            # Support both relative and CDN-absolute script URLs
            all_scripts = BeautifulSoup(load_site.text, 'html.parser').find_all('script', src=True)
            scripts: list = [
                s['src'] for s in all_scripts
                if '/_next/static/chunks/' in s['src']
            ]

            self.actions, self.xsid_script = Parser.parse_grok(scripts)

            self.baggage: str = between(load_site.text, '<meta name="baggage" content="', '"')
            self.sentry_trace: str = between(load_site.text, '<meta name="sentry-trace" content="', '-')
        else:
            self.session.cookies.update(extra_data["cookies"])
            self.actions: list = extra_data["actions"]
            self.xsid_script: list = extra_data["xsid_script"]
            self.baggage: str = extra_data["baggage"]
            self.sentry_trace: str = extra_data["sentry_trace"]

    def c_request(self, next_action: str) -> None:

        self.session.headers = self.headers.C_REQUEST
        self.session.headers.update({
            'baggage': self.baggage,
            'next-action': next_action,
            'sentry-trace': f'{self.sentry_trace}-{str(uuid4()).replace("-", "")[:16]}-0',
        })
        self.session.headers = Headers.fix_order(self.session.headers, self.headers.C_REQUEST)

        if self.c_run == 0:
            self.session.headers.pop("content-type")

            mime = CurlMime()
            mime.addpart(name="1", data=bytes(self.keys["userPublicKey"]), filename="blob", content_type="application/octet-stream")
            mime.addpart(name="0", filename=None, data='[{"userPublicKey":"$o1"}]')

            c_request = self.session.post("https://grok.com/c", multipart=mime)
            self.session.cookies.update(c_request.cookies)

            self.anon_user: str = between(c_request.text, '{"anonUserId":"', '"')
            self.c_run += 1

        else:

            if self.c_run == 1:
                data: str = dumps([{"anonUserId": self.anon_user}])
            elif self.c_run == 2:
                data: str = dumps([{"anonUserId": self.anon_user, **self.challenge_dict}])

            c_request = self.session.post('https://grok.com/c', data=data)
            self.session.cookies.update(c_request.cookies)

            if self.c_run == 1:
                start_idx = c_request.content.hex().find("3a6f38362c")
                if start_idx != -1:
                    start_idx += len("3a6f38362c")
                    end_idx = c_request.content.hex().find("313a", start_idx)
                    if end_idx != -1:
                        challenge_hex = c_request.content.hex()[start_idx:end_idx]
                        challenge_bytes = bytes.fromhex(challenge_hex)

                self.challenge_dict: dict = Anon.sign_challenge(challenge_bytes, self.keys["privateKey"])
            elif self.c_run == 2:
                self.verification_token, self.anim = Parser.get_anim(c_request.text, "grok-site-verification")
                self.svg_data, self.numbers = Parser.parse_values(c_request.text, self.anim, self.xsid_script)

            self.c_run += 1

    def start_convo(self, message: str, extra_data: dict = None, **kwargs) -> dict:

        if not extra_data:
            self._load()
            self.c_request(self.actions[0])
            self.c_request(self.actions[1])
            self.c_request(self.actions[2])
            xsid: str = Signature.generate_sign('/rest/app-chat/conversations/new', 'POST', self.verification_token, self.svg_data, self.numbers)
        else:
            self._load(extra_data)
            self.c_run: int = 1
            self.anon_user: str = extra_data["anon_user"]
            self.keys["privateKey"] = extra_data["privateKey"]
            self.c_request(self.actions[1])
            self.c_request(self.actions[2])
            xsid: str = Signature.generate_sign(f'/rest/app-chat/conversations/{extra_data["conversationId"]}/responses', 'POST', self.verification_token, self.svg_data, self.numbers)

        self.session.headers = self.headers.CONVERSATION
        self.session.headers.update({
            'baggage': self.baggage,
            'sentry-trace': f'{self.sentry_trace}-{str(uuid4()).replace("-", "")[:16]}-0',
            'x-statsig-id': xsid,
            'x-xai-request-id': str(uuid4()),
            'traceparent': f"00-{token_hex(16)}-{token_hex(8)}-00"
        })
        self.session.headers = Headers.fix_order(self.session.headers, self.headers.CONVERSATION)

        # Build conversation payload with optional overrides from kwargs
        conversation_data: dict = {
            'temporary': kwargs.get('temporary', False),
            'modelName': self.model,
            'message': message,
            'fileAttachments': kwargs.get('fileAttachments', []),
            'imageAttachments': kwargs.get('imageAttachments', []),
            'disableSearch': kwargs.get('disableSearch', False),
            'enableImageGeneration': kwargs.get('enableImageGeneration', True),
            'returnImageBytes': kwargs.get('returnImageBytes', False),
            'returnRawGrokInXaiRequest': kwargs.get('returnRawGrokInXaiRequest', False),
            'enableImageStreaming': kwargs.get('enableImageStreaming', True),
            'imageGenerationCount': kwargs.get('imageGenerationCount', 2),
            'forceConcise': kwargs.get('forceConcise', False),
            'toolOverrides': kwargs.get('toolOverrides', {}),
            'enableSideBySide': kwargs.get('enableSideBySide', True),
            'sendFinalMetadata': kwargs.get('sendFinalMetadata', True),
            'isReasoning': kwargs.get('isReasoning', False),
            'webpageUrls': kwargs.get('webpageUrls', []),
            'disableTextFollowUps': kwargs.get('disableTextFollowUps', False),
            'responseMetadata': {
                'requestModelDetails': {
                    'modelId': self.model,
                },
            },
            'disableMemory': False,
            'forceSideBySide': False,
            'modelMode': self.model_mode,
            'isAsyncChat': False,
        }

        if kwargs.get('customInstructions'):
            conversation_data['customPersonality'] = kwargs['customInstructions']

        if not extra_data:
            target_url = 'https://grok.com/rest/app-chat/conversations/new'
        else:
            target_url = f'https://grok.com/rest/app-chat/conversations/{extra_data["conversationId"]}/responses'
            if extra_data.get("parentResponseId"):
                conversation_data['parentResponseId'] = extra_data["parentResponseId"]

        convo_request = self.session.post(target_url, json=conversation_data, timeout=120)

        return self._parse_response(convo_request.text, message, extra_data)

    def _parse_response(self, response_text: str, message: str, extra_data: dict = None) -> dict:
        if "modelResponse" in response_text:
            response = conversation_id = parent_response = image_urls = title = None
            stream_response: list = []

            for response_dict in response_text.strip().split('\n'):
                try:
                    data: dict = loads(response_dict)
                except Exception:
                    continue

                result = data.get('result', {})

                # Extract tokens for streaming
                token = result.get('response', {}).get('token')
                if token:
                    stream_response.append(token)

                # Extract conversation ID
                if not conversation_id and result.get('conversation', {}).get('conversationId'):
                    conversation_id = result['conversation']['conversationId']

                # Extract title
                if result.get('title', {}).get('newTitle'):
                    title = result['title']['newTitle']

                # Extract model response
                mr = result.get('response', {}).get('modelResponse') or result.get('modelResponse')
                if mr:
                    if not response and mr.get('message'):
                        response = mr['message']
                    if not parent_response and mr.get('responseId'):
                        parent_response = mr['responseId']
                    if not image_urls and mr.get('generatedImageUrls'):
                        image_urls = mr['generatedImageUrls']

            return {
                "response": response,
                "stream_response": stream_response,
                "images": image_urls,
                "conversationId": conversation_id,
                "responseId": parent_response,
                "title": title,
                "extra_data": {
                    "anon_user": self.anon_user,
                    "cookies": self.session.cookies.get_dict(),
                    "actions": self.actions,
                    "xsid_script": self.xsid_script,
                    "baggage": self.baggage,
                    "sentry_trace": self.sentry_trace,
                    "conversationId": conversation_id,
                    "parentResponseId": parent_response,
                    "privateKey": self.keys["privateKey"]
                }
            }
        else:
            if 'rejected by anti-bot rules' in response_text:
                return {"error": "Request rejected by anti-bot rules. Please try again."}
            elif "Grok is under heavy usage" in response_text:
                return {"error": "Grok is under heavy usage right now. Please try again later."}
            elif "Too many requests" in response_text:
                return {"error": "Too many requests. Please try again later."}

            return {"error": f"Unexpected response from Grok: {response_text[:200]}"}
