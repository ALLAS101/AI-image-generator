import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Perchance Website Proxy for Restricted
  app.get("/api/proxy/perchance-restricted", async (req, res) => {
    try {
      const resp = await fetch("https://perchance.org/ai-image-generator-restricted");
      let html = await resp.text();
      html = html.replace("<head>", `<head><base href="https://perchance.org/">`);
      res.set("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      console.error("Restricted Proxy Error:", error);
      res.status(500).send("Failed to proxy the restricted generator.");
    }
  });

  // Perchance Website Proxy for Unrestricted
  app.get("/api/proxy/perchance-unrestricted", async (req, res) => {
    try {
      const resp = await fetch("https://perchance.org/ai-image-generator-unrestricted");
      let html = await resp.text();
      html = html.replace("<head>", `<head><base href="https://perchance.org/">`);
      res.set("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      console.error("Unrestricted Proxy Error:", error);
      res.status(500).send("Failed to proxy the unrestricted generator.");
    }
  });

  // Perchance Website Proxy
  app.get("/api/proxy/perchance", async (req, res) => {
    try {
      const resp = await fetch("https://perchance.org/ai-text-to-image-generator");
      let html = await resp.text();
      // Inject base tag to handle relative assets and absolute links on the target domain
      html = html.replace("<head>", `<head><base href="https://perchance.org/">`);
      // Add a small script to try and fix CORS for their internal fetches if possible, 
      // though this is limited in an iframe.
      res.set("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      console.error("Website Proxy Error:", error);
      res.status(500).send("Failed to proxy the website.");
    }
  });

  // Perchance Proxy (Following Step 6: Handling CORS Issues from tutorial)
  app.post("/api/perchance/generate", async (req, res) => {
    try {
      const { 
        prompt, 
        negativePrompt = "", 
        guidanceScale = 7, 
        seed = -1, 
        aspectRatio = "1:1",
        generatorName = "ai-text-to-image-generator" 
      } = req.body;
      
      // Verification Key Handshake
      const keyRes = await fetch("https://perchance.org/api/getVerificationKey", {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
      });
      const userKey = (await keyRes.text()).trim();

      // Step 2: Use the official /api-run endpoint
      const params = new URLSearchParams();
      params.append("prompt", prompt);
      params.append("negativePrompt", negativePrompt);
      params.append("guidanceScale", guidanceScale.toString());
      if (seed !== -1) params.append("seed", seed.toString());
      
      // Dimensions
      let width = 1024, height = 1024;
      if (aspectRatio === "3:4") { width = 768; height = 1024; }
      else if (aspectRatio === "4:3") { width = 1024; height = 768; }
      else if (aspectRatio === "16:9") { width = 1024; height = 576; }
      else if (aspectRatio === "9:16") { width = 576; height = 1024; }
      
      params.append("width", width.toString());
      params.append("height", height.toString());
      params.append("userKey", userKey);
      params.append("requestId", Math.random().toString(36).substring(7));
      
      const genRes = await fetch(`https://experimental.perchance.org/api-run/${generatorName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "origin": "https://perchance.org",
          "referer": `https://perchance.org/${generatorName}`,
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: params.toString()
      });

      const genText = await genRes.text();
      
      // Extract result URL or data
      const urlRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif|svg))/i;
      const dataUrlRegex = /(data:image\/[a-zA-Z]*;base64,[^\s"'<>]+)/i;
      const match = genText.match(dataUrlRegex) || genText.match(urlRegex);
      
      if (match) {
        const finalUrl = match[0];
        try {
          const imgRes = await fetch(finalUrl);
          const buffer = await imgRes.arrayBuffer();
          const base64Image = Buffer.from(buffer).toString('base64');
          const mimeType = imgRes.headers.get('content-type') || 'image/png';
          return res.json([`data:${mimeType};base64,${base64Image}`]);
        } catch (e) {
          return res.json([finalUrl]);
        }
      } else {
        const fallbackSeed = Math.floor(Math.random() * 1000000);
        const fallback = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?seed=${fallbackSeed}&nologo=true`;
        res.json([fallback]);
      }
    } catch (error) {
      console.error("Perchance Proxy Error:", error);
      const fallbackSeed = Math.floor(Math.random() * 1000000);
      res.json([`https://pollinations.ai/p/${encodeURIComponent(req.body.prompt)}?seed=${fallbackSeed}&nologo=true`]);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
