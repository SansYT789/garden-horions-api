const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const API = "https://garden-horions-api-production.up.railway.app";

const BASE = "./local_assets/garden_horizons";

const folders = ["gear", "plant", "weather"];

async function sync() {

  console.log("Clearing server...");

  await axios.post(API + "/clear");

  const form = new FormData();

  folders.forEach(folder => {

    const dir = path.join(BASE, folder);

    const files = fs.readdirSync(dir);

    files.forEach(file => {

      const filePath = path.join(dir, file);

      form.append("files", fs.createReadStream(filePath), folder + "/" + file);

    });

  });

  console.log("Uploading images...");

  await axios.post(API + "/upload", form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity
  });

  console.log("Upload complete");

}

sync();