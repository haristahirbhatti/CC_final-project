/**
 * W++ Token Analyzer - Backend Server
 * Compiler Construction CS-310 - Spring 2K26
 *
 * Run:  node server.js
 * API:  POST /api/analyze  (body: { source: "...", filename: "..." })
 *       GET  /api/health
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const { tokenize } = require("./tokenizer");

const app = express();
const PORT = process.env.PORT || 5001;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Multer for .wpp file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = [".wpp", ".txt", ".c", ".cpp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only .wpp, .txt, .c, .cpp files are allowed"));
  }
});

// ── Routes ──────────────────────────────────────────────────────────────────

/** Health check */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "W++ Token Analyzer API is running" });
});

/**
 * Analyze W++ source code sent as JSON body
 * Body: { source: string, filename?: string }
 */
app.post("/api/analyze", (req, res) => {
  try {
    const { source, filename } = req.body;

    if (!source || typeof source !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'source' field" });
    }

    const result = tokenize(source);
    result.filename = filename || "untitled.wpp";

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ error: "Tokenization failed: " + err.message });
  }
});

/**
 * Analyze W++ source code uploaded as a file
 * Form field: file
 */
app.post("/api/analyze/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const source = req.file.buffer.toString("utf-8");
    const filename = req.file.originalname;

    const result = tokenize(source);
    result.filename = filename;

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Upload analysis error:", err);
    res.status(500).json({ error: "Tokenization failed: " + err.message });
  }
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: "File upload error: " + err.message });
  }
  res.status(500).json({ error: err.message });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  W++ Token Analyzer API running at http://localhost:${PORT}`);
  console.log(`   POST /api/analyze         → analyze source from JSON body`);
  console.log(`   POST /api/analyze/upload  → analyze uploaded .wpp file`);
  console.log(`   GET  /api/health          → health check\n`);
});
