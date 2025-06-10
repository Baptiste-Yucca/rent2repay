// Script pour configurer une dette pour User1 dans le MockRMM
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("💳 CONFIGURATION DETTE POUR USER1");
    console.log("=".repeat(40));

    // Charger la configuration
    const configContent = fs.readFileSync('contract-addresses.json', 'utf8');
    const config = JSON.parse(configContent);

    console.log("📋 Configuration:");
    console.log(`   RMM: ${config.RMM}`);
    console.log(`   WXDAI: ${config.WXDAI}`);
    console.log(`   USDC: ${config.USDC}`);

    // Se connecter au réseau
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    // Récupérer les signers
    const signers = await ethers.getSigners();
    const deployer = signers[0]; // Deployer pour configurer la dette
    const user1 = signers[1]; // User1

    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`👤 User1: ${user1.address}`);

    // ABI pour le MockRMM
    const mockRMMABI = [
        "function setDebt(address borrower, address asset, uint256 amount)",
        "function getDebt(address borrower, address asset) view returns (uint256)"
    ];

    try {
        // Contrat MockRMM
        const mockRMMContract = new ethers.Contract(config.RMM, mockRMMABI, deployer);

        // Montants de dette à configurer (simule que User1 doit rembourser)
        const debtWXDAI = ethers.parseUnits("1000", 18); // 1000 WXDAI de dette
        const debtUSDC = ethers.parseUnits("500", 18);   // 500 USDC de dette

        console.log("\n🔧 Configuration des dettes...");

        // Configurer dette WXDAI pour User1
        console.log("   Configurer dette WXDAI...");
        const wxdaiDebtTx = await mockRMMContract.setDebt(user1.address, config.WXDAI, debtWXDAI);
        await wxdaiDebtTx.wait();
        console.log(`✅ Dette WXDAI configurée: ${ethers.formatUnits(debtWXDAI, 18)} WXDAI`);

        // Configurer dette USDC pour User1
        console.log("   Configurer dette USDC...");
        const usdcDebtTx = await mockRMMContract.setDebt(user1.address, config.USDC, debtUSDC);
        await usdcDebtTx.wait();
        console.log(`✅ Dette USDC configurée: ${ethers.formatUnits(debtUSDC, 18)} USDC`);

        // Vérification des dettes configurées
        console.log("\n🔍 Vérification des dettes:");
        const verifyWXDAIDebt = await mockRMMContract.getDebt(user1.address, config.WXDAI);
        const verifyUSDCDebt = await mockRMMContract.getDebt(user1.address, config.USDC);

        console.log(`   User1 dette WXDAI: ${ethers.formatUnits(verifyWXDAIDebt, 18)}`);
        console.log(`   User1 dette USDC: ${ethers.formatUnits(verifyUSDCDebt, 18)}`);

        console.log("\n🎉 CONFIGURATION RÉUSSIE!");
        console.log("User1 a maintenant des dettes à rembourser dans le MockRMM");
        console.log("Les remboursements via Rent2Repay peuvent maintenant fonctionner");

    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        process.exit(1);
    }
}

main()
    .then(() => {
        console.log("\n✅ Configuration terminée!");
        process.exit(0);
    })
    .catch(error => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    }); 