import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Health route
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "TBW AI BACKEND ✅",
    status: "running 🚀",
    time: new Date().toISOString()
  });
});

// Catch-all route
app.get("*", (req, res) => {
  res.send("TBW AI BACKEND LIVE ✅");
});

export default app;
