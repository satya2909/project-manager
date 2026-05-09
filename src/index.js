import dotenv from "dotenv";
import express from "express";
import connectDB from "./db/database.js";

dotenv.config({
    path: "./.env",
});

const port = process.env.PORT || 3000;


connectDB().then(() => {
  console.log('Example app listening on port http://localhost:${port}');
  
}).catch((err) => {
  console.error("Mongo Connection error", err);
  process.exit(1);
  
})
