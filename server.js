import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "TBW AI BACKEND",
    status: "running ✅",
    time: new Date().toISOString()
  });
});

// Default homepage
app.get("/", (req, res) => {
  res.send("TBW BACKEND LIVE ✅");
});

// Vercel requires export instead of app.listen()
export default app;
