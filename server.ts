
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

console.log("--- SERVER STARTING ---");
const checkKey = (key: string) => {
  const val = process.env[key];
  if (!val) return "MISSING (Not in .env)";
  if (val.trim() === "") return "EMPTY (Key is there but has no value)";
  return "LOADED ✅";
};

console.log("GEMINI_API_KEY:", checkKey("GEMINI_API_KEY") === "LOADED ✅" ? "LOADED ✅" : checkKey("API_KEY"));
console.log("NVIDIA_API_KEY:", checkKey("NVIDIA_API_KEY"));
console.log("OPENAI_API_KEY:", checkKey("OPENAI_API_KEY"));
console.log("------------------------");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy for NVIDIA Flux Image Generation
  app.post("/api/generate-image", async (req, res) => {
    const { prompt, aspectRatio } = req.body;
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "NVIDIA_API_KEY is not configured on the server." });
    }

    try {
      const response = await fetch("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-1-schnell", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: aspectRatio || "16:9",
          mode: "high-quality"
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `NVIDIA API Error: ${errText}` });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for OpenAI TTS
  app.post("/api/generate-audio", async (req, res) => {
    const { text, voice } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
    }

    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: voice || "onyx",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `OpenAI API Error: ${errText}` });
      }

      const arrayBuffer = await response.arrayBuffer();
      res.set("Content-Type", "audio/mpeg");
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check API Keys Status
  app.get("/api/keys-status", (req, res) => {
    res.json({
      gemini: !!process.env.GEMINI_API_KEY || !!process.env.API_KEY,
      nvidia: !!process.env.NVIDIA_API_KEY,
      openai: !!process.env.OPENAI_API_KEY
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
