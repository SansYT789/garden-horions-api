const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());

const upload = multer({ dest: "temp/" });

const STORAGE = "uploads";

fs.ensureDirSync(STORAGE);

// clear server
app.post("/clear", async (req, res) => {

  await fs.emptyDir(STORAGE);

  res.json({
    status: "server cleared"
  });

});

// upload files
app.post("/upload", upload.array("files"), async (req, res) => {

  for (const file of req.files) {

    const dest = path.join(STORAGE, file.originalname);

    await fs.move(file.path, dest, { overwrite: true });

  }

  res.json({
    status: "uploaded",
    count: req.files.length
  });

});

app.use("/files", express.static(STORAGE));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running " + PORT);
});