#!/usr/bin/env node

const path = require("path");
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log("🔍 Variables d'environnement:");
console.log("   TENDERLY_RPC_URL:", process.env.TENDERLY_RPC_URL ? "✅" : "❌");
console.log("   TENDERLY_PROJECT_SLUG:", process.env.TENDERLY_PROJECT_SLUG ? "✅" : "❌");
console.log("   TENDERLY_ACCOUNT_SLUG:", process.env.TENDERLY_ACCOUNT_SLUG ? "✅" : "❌");
console.log("   TENDERLY_ACCESS_KEY:", process.env.TENDERLY_ACCESS_KEY ? "✅" : "❌");
console.log("   PRIVATE_KEY:", process.env.PRIVATE_KEY ? "✅" : "❌");

if (process.env.TENDERLY_RPC_URL) {
    console.log("   RPC URL:", process.env.TENDERLY_RPC_URL.substring(0, 50) + "...");
}
