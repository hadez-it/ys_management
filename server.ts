import app from "./api/index";
import path from "path";
import express from "express";

const PORT = Number(process.env.PORT) || 3000;

// Vite Setup on Express for Local Development & Cloud Run
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Local development server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
