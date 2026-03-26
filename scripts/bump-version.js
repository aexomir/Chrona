#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

// Read app.json
const appJsonPath = path.join(__dirname, "..", "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

// Parse current version
const currentVersion = packageJson.version;
const versionParts = currentVersion.split(".").map(Number);

// Bump patch version
versionParts[2] += 1;
const newVersion = versionParts.join(".");

// Update package.json
packageJson.version = newVersion;

// Update app.json
appJson.expo.version = newVersion;

// Write back to package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

// Write back to app.json
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");

console.log(`Version bumped from ${currentVersion} to ${newVersion}`);
console.log(`Updated package.json and app.json`);
// Version bump script completed successfully
