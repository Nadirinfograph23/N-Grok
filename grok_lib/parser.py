from re import findall, search
from json import loads
from base64 import b64decode
from typing import Optional
from curl_cffi import requests
from grok_lib.utils import between


class Parser:

    @staticmethod
    def parse_values(html: str, loading: int = 0, scriptId: str = "") -> tuple:

        d_values = loads(findall(r'\[\[{"color".*?}\]\]', html)[0])[loading]
        svg_data = "M 10,30 C" + " C".join(
            f" {item['color'][0]},{item['color'][1]} {item['color'][2]},{item['color'][3]} {item['color'][4]},{item['color'][5]}"
            f" h {item['deg']}"
            f" s {item['bezier'][0]},{item['bezier'][1]} {item['bezier'][2]},{item['bezier'][3]}"
            for item in d_values
        )

        if scriptId:
            # Handle both relative and CDN-absolute URLs
            if scriptId.startswith("http"):
                script_link = scriptId
            elif scriptId.startswith("static/chunks/"):
                script_link = f'https://cdn.grok.com/_next/{scriptId}'
            else:
                script_link = f'https://grok.com/_next/{scriptId}'

            script_content: str = requests.get(script_link, impersonate="chrome136").text
            numbers: list = [int(x) for x in findall(r'x\[(\d+)\]\s*,\s*16', script_content)]

            return svg_data, numbers
        else:
            return svg_data

    @staticmethod
    def get_anim(html: str, verification: str = "grok-site-verification") -> tuple[str, int]:

        verification_token: str = between(html, f'"name":"{verification}","content":"', '"')
        array: list = list(b64decode(verification_token))
        anim: int = int(array[5] % 4)

        return verification_token, anim

    @staticmethod
    def parse_grok(scripts: list) -> tuple[list, str]:

        script_content1 = None
        script_content2 = None
        action_script = None

        for script in scripts:
            # Handle both relative and CDN-absolute script URLs
            if script.startswith("http"):
                url = script
            else:
                url = f'https://grok.com{script}'

            content: str = requests.get(url, impersonate="chrome136").text

            if "anonPrivateKey" in content:
                script_content1 = content
                action_script = script
            elif "880932)" in content:
                script_content2 = content

            if script_content1 and script_content2:
                break

        if not script_content1 or not script_content2:
            raise Exception("Could not find required Grok scripts")

        actions: list = findall(r'createServerReference\)\("([a-f0-9]+)"', script_content1)
        xsid_match = search(r'"(static/chunks/[^"]+\.js)"[^}]*?\(880932\)', script_content2)
        xsid_script: str = xsid_match.group(1) if xsid_match else ""

        if not actions or not xsid_script:
            raise Exception("Could not parse actions or xsid script")

        return actions, xsid_script
