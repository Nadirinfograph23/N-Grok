import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data, content_type, filename } = req.body;

    if (!data) {
      return res.status(400).json({ error: "No image data provided" });
    }

    const dataUri = `data:${content_type || "image/png"};base64,${data}`;

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({
      data_uri: dataUri,
      filename: filename || "upload",
    });
  } catch (err) {
    return res.status(500).json({ error: "Upload failed", details: String(err) });
  }
}
