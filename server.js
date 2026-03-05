const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "temp/" });

const STORAGE = "uploads";

fs.ensureDirSync(STORAGE);

app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    for (const file of req.files) {
      // Dùng fieldname hoặc originalname để giữ folder structure (gear/img.png)
      const relativePath = file.originalname;

      // Sanitize: chặn path traversal
      const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
      const dest = path.join(STORAGE, safePath);

      // Đảm bảo dest nằm trong STORAGE
      if (!path.resolve(dest).startsWith(path.resolve(STORAGE))) {
        await fs.remove(file.path);
        return res.status(400).json({ error: "Invalid file path: " + relativePath });
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

app.post("/delete", async (req, res) => {
  try {
    const file = req.query.file;

    if (!file) {
      return res.status(400).json({ error: "Missing file parameter" });
    }

    // Sanitize: chặn path traversal
    const safePath = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(STORAGE, safePath);

    // Đảm bảo fullPath nằm trong STORAGE
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

app.use("/files", express.static(STORAGE, {
  maxAge: "365d",
  etag: true
}));

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Server running on port " + port);
});
