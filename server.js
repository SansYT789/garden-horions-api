const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());

const upload = multer({ dest:"temp/" });

const STORAGE="uploads";

fs.ensureDirSync(STORAGE);

app.post("/upload", upload.array("files"), async (req,res)=>{

 for(const file of req.files){

   const dest = path.join(STORAGE,file.originalname);

   await fs.ensureDir(path.dirname(dest));

   await fs.move(file.path,dest,{overwrite:true});

 }

 res.json({status:"ok"});
});

app.post("/delete", async (req,res)=>{

 const file=req.query.file;

 await fs.remove(path.join(STORAGE,file));

 res.json({deleted:file});

});

app.use("/files", express.static(STORAGE,{
 maxAge:"365d",
 etag:true
}));

const port=process.env.PORT||3000;

app.listen(port,()=>{

 console.log("Server running "+port);

});