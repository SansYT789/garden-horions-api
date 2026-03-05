const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const FormData = require("form-data");

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const API = "https://garden-horions-api-production.up.railway.app";

// Đường dẫn local trên Android (Termux có quyền truy cập /storage/emulated/0)
const BASE = "/storage/emulated/0/Download/garden_horizons";

const FOLDERS = ["gear", "plant", "weather"];

const HASH_FILE = path.join(__dirname, "hash.json");

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function md5(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(data).digest("hex");
}

// Đệ quy lấy tất cả file trong folder
function getAllFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    try {
      if (fs.statSync(full).isDirectory()) {
        results.push(...getAllFiles(full));
      } else {
        results.push(full);
      }
    } catch (e) {
      console.warn("Skip:", full, e.message);
    }
  }
  return results;
}

// Đảm bảo folder tồn tại
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── LOAD LOCAL HASH ──────────────────────────────────────────────────────────

let savedHash = {};
if (fs.existsSync(HASH_FILE)) {
  try {
    savedHash = JSON.parse(fs.readFileSync(HASH_FILE, "utf8"));
  } catch (e) {
    console.warn("Cannot read hash file, starting fresh.");
  }
}

// ─── SCAN LOCAL FILES ─────────────────────────────────────────────────────────

let localHash = {};

FOLDERS.forEach(folder => {
  const dir = path.join(BASE, folder);
  if (!fs.existsSync(dir)) {
    console.warn("Folder not found (sẽ tạo khi download):", dir);
    return;
  }
  getAllFiles(dir).forEach(full => {
    try {
      const key = path.relative(BASE, full).split(path.sep).join("/");
      localHash[key] = md5(full);
    } catch (e) {
      console.error("Error hashing:", full, e.message);
    }
  });
});

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("\n🔄 Bắt đầu sync 2 chiều...\n");

  // 1. Lấy danh sách file hiện có trên server
  let serverHash = {};
  try {
    const res = await axios.get(API + "/list");
    serverHash = res.data;
    console.log("📡 Server có", Object.keys(serverHash).length, "file(s)");
  } catch (e) {
    console.error("❌ Không lấy được danh sách server:", e.message);
    process.exit(1);
  }

  // ── CHIỀU 1: LOCAL → SERVER ──────────────────────────────────────────────
  // Upload file nếu: có ở local nhưng server chưa có, hoặc hash khác nhau

  const toUpload = [];
  const toDeleteOnServer = [];

  for (const [key, hash] of Object.entries(localHash)) {
    if (serverHash[key] !== hash) {
      toUpload.push(key);
    }
  }

  // File đã xóa ở local (so với lần sync trước) → xóa trên server luôn
  for (const key of Object.keys(savedHash)) {
    if (!localHash[key] && serverHash[key]) {
      toDeleteOnServer.push(key);
    }
  }

  console.log("\n⬆️  Upload lên server:", toUpload.length, "file(s)");
  console.log("🗑️  Xóa trên server:", toDeleteOnServer.length, "file(s)");

  // Xóa trên server
  for (const key of toDeleteOnServer) {
    try {
      await axios.post(API + "/delete?file=" + encodeURIComponent(key));
      console.log("  Deleted on server:", key);
      delete serverHash[key];
    } catch (e) {
      console.error("  ❌ Xóa thất bại:", key, e.message);
    }
  }

  // Upload lên server (batch)
  if (toUpload.length > 0) {
    const form = new FormData();
    for (const key of toUpload) {
      const full = path.join(BASE, key.split("/").join(path.sep));
      form.append("files", fs.createReadStream(full), key);
    }
    try {
      await axios.post(API + "/upload", form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      console.log("  ✅ Upload xong", toUpload.length, "file(s)");
      // Cập nhật serverHash sau upload
      for (const key of toUpload) {
        serverHash[key] = localHash[key];
      }
    } catch (e) {
      console.error("  ❌ Upload thất bại:", e.message);
    }
  }

  // ── CHIỀU 2: SERVER → LOCAL ──────────────────────────────────────────────
  // Download file nếu: có trên server nhưng local chưa có, hoặc hash khác nhau

  const toDownload = [];
  const toDeleteLocal = [];

  for (const [key, hash] of Object.entries(serverHash)) {
    // Chỉ xử lý các folder trong FOLDERS
    const folder = key.split("/")[0];
    if (!FOLDERS.includes(folder)) continue;

    if (localHash[key] !== hash) {
      toDownload.push(key);
    }
  }

  // File bị xóa trên server (so với lần sync trước) → xóa local
  for (const key of Object.keys(savedHash)) {
    if (!serverHash[key] && localHash[key]) {
      toDeleteLocal.push(key);
    }
  }

  console.log("\n⬇️  Download về máy:", toDownload.length, "file(s)");
  console.log("🗑️  Xóa trên máy:", toDeleteLocal.length, "file(s)");

  // Xóa local
  for (const key of toDeleteLocal) {
    const full = path.join(BASE, key.split("/").join(path.sep));
    try {
      fs.unlinkSync(full);
      console.log("  Deleted local:", key);
      delete localHash[key];
    } catch (e) {
      console.warn("  ⚠️  Không xóa được:", key, e.message);
    }
  }

  // Download từ server
  for (const key of toDownload) {
    const url = API + "/files/" + key.split("/").map(encodeURIComponent).join("/");
    const dest = path.join(BASE, key.split("/").join(path.sep));

    try {
      ensureDir(dest);
      const res = await axios.get(url, { responseType: "arraybuffer" });
      fs.writeFileSync(dest, Buffer.from(res.data));
      localHash[key] = md5(dest);
      console.log("  ✅ Downloaded:", key);
    } catch (e) {
      console.error("  ❌ Download thất bại:", key, e.message);
    }
  }

  // ── LƯU HASH & GENERATE JSON ──────────────────────────────────────────────

  // Merge: hash cuối = những gì thực sự có ở local sau sync
  const finalHash = {};
  FOLDERS.forEach(folder => {
    const dir = path.join(BASE, folder);
    getAllFiles(dir).forEach(full => {
      try {
        const key = path.relative(BASE, full).split(path.sep).join("/");
        finalHash[key] = md5(full);
      } catch (e) {}
    });
  });

  fs.writeFileSync(HASH_FILE, JSON.stringify(finalHash, null, 2));

  generateJSON(finalHash);

  console.log("\n✅ Sync hoàn tất!\n");
}

function generateJSON(hashMap) {
  const result = {};
  FOLDERS.forEach(f => result[f] = []);

  for (const key of Object.keys(hashMap)) {
    const folder = key.split("/")[0];
    if (result[folder] !== undefined) {
      result[folder].push(key);
    }
  }

  const outPath = path.join(__dirname, "images.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log("📄 Generated images.json");
}

run().catch(e => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
