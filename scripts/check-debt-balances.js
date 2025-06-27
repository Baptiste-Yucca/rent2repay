const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔍 Vérification des balances de dette...\n");

    // Charger la configuration déployée
    const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");
    if (!fs.existsSync(configPath)) {
        throw new Error("❌ Fichier de configuration non trouvé. Exécutez d'abord le script de déploiement.");
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Récupérer les signers pour avoir les adresses
    const signers = await ethers.getSigners();
    const userAddress = signers[1].address; // USER est à l'index 1

    // Charger les contrats de dette
    const mockDebtUSDC = await ethers.getContractAt("MockDebtToken", config.contracts.MockDebtUSDC);
    const mockDebtWXDAI = await ethers.getContractAt("MockDebtToken", config.contracts.MockDebtWXDAI);

    // Vérifier les adresses des contrats
    console.log("📋 Adresses des contrats:");
    console.log(`   MockDebtUSDC: ${await mockDebtUSDC.getAddress()}`);
    console.log(`   MockDebtWXDAI: ${await mockDebtWXDAI.getAddress()}\n`);

    // Vérifier les tokens sous-jacents
    console.log("🔗 Tokens sous-jacents:");
    console.log(`   USDC: ${await mockDebtUSDC.getUnderlyingAsset()}`);
    console.log(`   WXDAI: ${await mockDebtWXDAI.getUnderlyingAsset()}\n`);

    // Vérifier les balances initiales
    console.log("💰 Balances de dette initiales pour", userAddress);
    const initialDebtUSDCBalance = await mockDebtUSDC.balanceOf(userAddress);
    const initialDebtWXDAIBalance = await mockDebtWXDAI.balanceOf(userAddress);

    console.log(`   Dette USDC: ${ethers.formatEther(initialDebtUSDCBalance)} armmv3USDC`);
    console.log(`   Dette WXDAI: ${ethers.formatEther(initialDebtWXDAIBalance)} armmv3WXDAI\n`);

    // Mint des tokens de dette
    console.log("🏦 Mint de 100 tokens de dette de chaque type...");
    const mintAmount = ethers.parseEther("100");

    await mockDebtUSDC.mint(userAddress, mintAmount);
    console.log("   ✅ Dette USDC mintée");

    await mockDebtWXDAI.mint(userAddress, mintAmount);
    console.log("   ✅ Dette WXDAI mintée\n");

    // Vérifier les nouvelles balances
    console.log("💰 Nouvelles balances de dette pour", userAddress);
    const newDebtUSDCBalance = await mockDebtUSDC.balanceOf(userAddress);
    const newDebtWXDAIBalance = await mockDebtWXDAI.balanceOf(userAddress);

    console.log(`   Dette USDC: ${ethers.formatEther(newDebtUSDCBalance)} armmv3USDC`);
    console.log(`   Dette WXDAI: ${ethers.formatEther(newDebtWXDAIBalance)} armmv3WXDAI`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }); 