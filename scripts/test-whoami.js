const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔍 Test manuel de whoami() avec ABI forcée");

    const abiPath = path.join(__dirname, "../artifacts/contracts/Rent2Repay.sol/Rent2Repay.json");
    const abi = JSON.parse(fs.readFileSync(abiPath, "utf8")).abi;

    const contractAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
    console.log("✅ Chargement du contrat :", contractAddress);

    const signers = await ethers.getSigners();

    for (let i = 0; i < 10; i++) {
        const signer = signers[i];
        const address = signer.address;
        const contract = new ethers.Contract(contractAddress, abi, signer);

        try {
            const [isAdmin, isOperator, isEmergency] = await contract.whoami();
            console.log(`\n#${i} ${address}`);
            console.log("   ➤ Admin:", isAdmin);
            console.log("   ➤ Operator:", isOperator);
            console.log("   ➤ Emergency:", isEmergency);
        } catch (err) {
            console.log(`\n#${i} ${address}`);
            console.error("   ❌ Erreur whoami():", err.shortMessage || err.message);
        }
    }
}

main().catch(console.error);
