import { between } from "./utils";

async function fetchText(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    },
  });
  return resp.text();
}

export function getAnim(
  html: string,
  verification: string = "grok-site-verification"
): { verificationToken: string; anim: number } {
  const verificationToken = between(
    html,
    `"name":"${verification}","content":"`,
    '"'
  );
  const array = Array.from(Buffer.from(verificationToken, "base64"));
  const anim = array[5] % 4;
  return { verificationToken, anim };
}

export async function parseValuesAsync(
  html: string,
  loading: number,
  scriptId: string
): Promise<{ svgData: string; numbers: number[] }> {
  const colorMatch = html.match(/\[\[{"color".*?}\]\]/);
  if (!colorMatch) throw new Error("Could not find color data in response");

  const dValues = JSON.parse(colorMatch[0])[loading];
  let svgData = "M 10,30 C";
  const parts: string[] = [];
  for (const item of dValues) {
    parts.push(
      ` ${item.color[0]},${item.color[1]} ${item.color[2]},${item.color[3]} ${item.color[4]},${item.color[5]}` +
        ` h ${item.deg}` +
        ` s ${item.bezier[0]},${item.bezier[1]} ${item.bezier[2]},${item.bezier[3]}`
    );
  }
  svgData += parts.join(" C");

  if (scriptId) {
    const scriptLink = scriptId.startsWith("http") ? scriptId : `https://cdn.grok.com/_next/${scriptId}`;
    const scriptContent = await fetchText(scriptLink);
    const matches = scriptContent.match(/x\[(\d+)\]\s*,\s*16/g) || [];
    const numbers = matches.map((m: string) => {
      const numMatch = m.match(/x\[(\d+)\]/);
      return numMatch ? parseInt(numMatch[1], 10) : 0;
    });
    return { svgData, numbers };
  }

  return { svgData, numbers: [] };
}

export async function parseGrokAsync(
  scripts: string[]
): Promise<{ actions: string[]; xsidScript: string }> {
  let scriptContent1 = "";
  let scriptContent2 = "";

  for (const script of scripts) {
    const scriptUrl = script.startsWith("http") ? script : `https://grok.com${script}`;
    const content = await fetchText(scriptUrl);
    if (content.includes("anonPrivateKey")) {
      scriptContent1 = content;
    } else if (content.includes("880932)")) {
      scriptContent2 = content;
    }
    if (scriptContent1 && scriptContent2) break;
  }

  if (!scriptContent1 || !scriptContent2) {
    throw new Error("Could not find required Grok scripts");
  }

  const actionMatches =
    scriptContent1.match(/createServerReference\)\("([a-f0-9]+)"/g) || [];
  const actions = actionMatches.map((m: string) => {
    const match = m.match(/createServerReference\)\("([a-f0-9]+)"/);
    return match ? match[1] : "";
  });

  const xsidMatch = scriptContent2.match(
    /"(static\/chunks\/[^"]+\.js)"[^}]*?\(880932\)/
  );
  const xsidScript = xsidMatch ? xsidMatch[1] : "";

  if (!actions.length || !xsidScript) {
    throw new Error("Could not parse actions or xsid script");
  }

  return { actions, xsidScript };
}
