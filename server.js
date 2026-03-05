const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "temp/" });

const STORAGE = "uploads";

fs.ensureDirSync(STORAGE);

// Helper: tính md5 của file
function md5(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(data).digest("hex");
}

// Helper: đệ quy lấy tất cả file trong folder
function getAllFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      results.push(...getAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

// ─── GET /list ────────────────────────────────────────────────────────────────
// Trả về { "gear/img.png": "md5hash", ... }
// Client dùng để biết server đang có gì, so sánh để sync 2 chiều
app.get("/list", (req, res) => {
  try {
    const files = getAllFiles(STORAGE);
    const result = {};
    for (const full of files) {
      const key = path.relative(STORAGE, full).split(path.sep).join("/");
      result[key] = md5(full);
    }
    res.json(result);
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /upload ─────────────────────────────────────────────────────────────
// Nhận file từ client, giữ nguyên folder structure (gear/img.png)
app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    for (const file of req.files) {
      const safePath = path.normalize(file.originalname).replace(/^(\.\.(\/|\\|$))+/, "");
      const dest = path.join(STORAGE, safePath);

      if (!path.resolve(dest).startsWith(path.resolve(STORAGE))) {
        await fs.remove(file.path);
        return res.status(400).json({ error: "Invalid path: " + file.originalname });
      }

      await fs.ensureDir(path.dirname(dest));
      await fs.move(file.path, dest, { overwrite: true });
    }
    res.json({ status: "ok", uploaded: req.files.length });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /delete ─────────────────────────────────────────────────────────────
app.post("/delete", async (req, res) => {
  try {
    const file = req.query.file;
    if (!file) return res.status(400).json({ error: "Missing file parameter" });

    const safePath = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(STORAGE, safePath);

    if (!path.resolve(fullPath).startsWith(path.resolve(STORAGE))) {
      return res.status(400).json({ error: "Invalid path" });
    }

    await fs.remove(fullPath);
    res.json({ deleted: safePath });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /files/* ─────────────────────────────────────────────────────────────
// Serve static — client dùng để download file về máy
app.use("/files", express.static(STORAGE, {
  maxAge: "365d",
  etag: true
}));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port " + port));
