const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const axios=require("axios");
const FormData=require("form-data");

const API="https://garden-horions-api-production.up.railway.app";

const BASE="./assets/garden_horizons";

const folders=["gear","plant","weather"];

const HASH_FILE="hash.json";

function md5(file){

 const data=fs.readFileSync(file);

 return crypto.createHash("md5").update(data).digest("hex");

}

let oldHash={};

if(fs.existsSync(HASH_FILE))
 oldHash=JSON.parse(fs.readFileSync(HASH_FILE));

let newHash={};

let uploadList=[];
let deleteList=[];

folders.forEach(folder=>{

 const dir=path.join(BASE,folder);

 const files=fs.readdirSync(dir);

 files.forEach(file=>{

   const full=path.join(dir,file);

   const hash=md5(full);

   const key=folder+"/"+file;

   newHash[key]=hash;

   if(oldHash[key]!==hash){

    uploadList.push(full);

   }

 });

});

Object.keys(oldHash).forEach(file=>{

 if(!newHash[file]){

  deleteList.push(file);

 }

});

async function run(){

 console.log("upload:",uploadList.length);
 console.log("delete:",deleteList.length);

 for(const file of deleteList){

  await axios.post(API+"/delete?file="+file);

 }

 const form=new FormData();

 uploadList.forEach(file=>{

  const rel=file.split("garden_horizons/")[1];

  form.append("files",fs.createReadStream(file),rel);

 });

 if(uploadList.length>0){

 await axios.post(API+"/upload",form,{
  headers:form.getHeaders(),
  maxBodyLength:Infinity
 });

 }

 fs.writeFileSync(HASH_FILE,JSON.stringify(newHash,null,2));

 generateJSON();

 console.log("sync done");

}

function generateJSON(){

 const result={};

 folders.forEach(folder=>{

   result[folder]=[];

 });

 Object.keys(newHash).forEach(file=>{

  const parts=file.split("/");

  result[parts[0]].push(file);

 });

 fs.writeFileSync("images.json",JSON.stringify(result,null,2));

}

run();