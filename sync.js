const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const FormData = require("form-data");

const API = "https://garden-horions-api-production.up.railway.app";

const BASE = "./assets/garden_horizons";

const folders = ["gear", "plant", "weather"];

const HASH_FILE = "hash.json";

function md5(file) {
  const data = fs.readFileSync(file);
  return crypto.createHash("md5").update(data).digest("hex");
}

// Đệ quy lấy tất cả file trong folder (kể cả subfolder)
function getAllFiles(dir, baseDir = dir) {
  const results = [];
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      // Đệ quy vào subfolder
      results.push(...getAllFiles(full, baseDir));
    } else if (stat.isFile()) {
      results.push(full);
    }
  }

  return results;
}

let oldHash = {};

if (fs.existsSync(HASH_FILE)) {
  try {
    oldHash = JSON.parse(fs.readFileSync(HASH_FILE));
  } catch (e) {
    console.warn("Warning: Could not parse hash file, starting fresh.");
    oldHash = {};
  }
}

let newHash = {};
let uploadList = [];
let deleteList = [];

folders.forEach(folder => {
  const dir = path.join(BASE, folder);

  if (!fs.existsSync(dir)) {
    console.warn("Warning: folder not found:", dir);
    return;
  }

  const files = getAllFiles(dir);

  files.forEach(full => {
    try {
      const hash = md5(full);

      // Key là relative path từ garden_horizons, dùng forward slash
      const key = path.relative(BASE, full).split(path.sep).join("/");

      newHash[key] = hash;

      if (oldHash[key] !== hash) {
        uploadList.push({ full, key });
      }
    } catch (e) {
      console.error("Error hashing file:", full, e.message);
    }
  });
});

// Tìm file đã bị xóa
Object.keys(oldHash).forEach(file => {
  if (!newHash[file]) {
    deleteList.push(file);
  }
});

async function run() {
  console.log("Upload:", uploadList.length, "file(s)");
  console.log("Delete:", deleteList.length, "file(s)");

  // Xóa file đã bị remove
  for (const file of deleteList) {
    try {
      await axios.post(API + "/delete?file=" + encodeURIComponent(file));
      console.log("Deleted:", file);
    } catch (e) {
      console.error("Failed to delete:", file, e.message);
    }
  }

  // Upload file mới hoặc đã thay đổi
  if (uploadList.length > 0) {
    const form = new FormData();

    uploadList.forEach(({ full, key }) => {
      // Append với key làm filename để giữ folder structure (gear/img.png)
      form.append("files", fs.createReadStream(full), key);
    });

    try {
      await axios.post(API + "/upload", form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      console.log("Uploaded", uploadList.length, "file(s)");
    } catch (e) {
      console.error("Upload failed:", e.message);
      // Không ghi hash nếu upload lỗi
      return;
    }
  }

  // Chỉ ghi hash sau khi sync thành công
  fs.writeFileSync(HASH_FILE, JSON.stringify(newHash, null, 2));

  generateJSON();

  console.log("Sync done!");
}

function generateJSON() {
  const result = {};

  folders.forEach(folder => {
    result[folder] = [];
  });

  Object.keys(newHash).forEach(file => {
    const parts = file.split("/");
    const folder = parts[0];
    if (result[folder] !== undefined) {
      result[folder].push(file);
    }
  });

  fs.writeFileSync("images.json", JSON.stringify(result, null, 2));
  console.log("Generated images.json");
}

run();
