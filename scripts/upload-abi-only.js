const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

async function main() {
    const contractAddress = "0xf0e6c35ad6ee589fc6f39ec35aad348fead3217b";

    // Charger l'ABI compilé
    const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "Rent2Repay.sol", "Rent2Repay.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    console.log(" Tentative d'upload ABI...");
    console.log(`   Adresse: ${contractAddress}`);
    console.log(`   Project: ${process.env.TENDERLY_PROJECT_SLUG}`);
    console.log(`   Account: ${process.env.TENDERLY_ACCOUNT_SLUG}`);

    try {
        const response = await axios.post(
            `https://api.tenderly.co/api/v1/account/${process.env.TENDERLY_ACCOUNT_SLUG}/project/${process.env.TENDERLY_PROJECT_SLUG}/contracts`,
            {
                address: contractAddress,
                network_id: "100",
                contract_name: "Rent2Repay",
                abi: artifact.abi,
                source_code: artifact.source
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Access-Key": process.env.TENDERLY_ACCESS_KEY
                }
            }
        );

        console.log("✅ ABI uploadé sur Tenderly !");
        console.log("   Réponse:", response.status, response.statusText);

    } catch (error) {
        console.log("❌ Erreur upload:", error.response?.data || error.message);
    }
}
