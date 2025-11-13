import fs from "fs";
import path from "path";

const sogniCache = path.join(process.env.HOME || process.env.USERPROFILE, ".sogni");

if (fs.existsSync(sogniCache)) {
  fs.rmSync(sogniCache, { recursive: true, force: true });
  console.log("🧹 Sogni cache removed successfully!");
} else {
  console.log("✅ No Sogni cache found, clean start!");
}
