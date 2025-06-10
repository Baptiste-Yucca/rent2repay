// Script pour approuver 100 WXDAI et 100 USDC pour User1
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("💰 APPROVAL TOKENS POUR USER1");
    console.log("=".repeat(35));

    // Charger la configuration
    const configContent = fs.readFileSync('contract-addresses.json', 'utf8');
    const config = JSON.parse(configContent);

    console.log("📋 Configuration:");
    console.log(`   RENT2REPAY: ${config.RENT2REPAY}`);
    console.log(`   WXDAI: ${config.WXDAI}`);
    console.log(`   USDC: ${config.USDC}`);

    // Se connecter au réseau
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    // Récupérer les signers
    const signers = await ethers.getSigners();
    const user1 = signers[1]; // User1 est le deuxième signer

    console.log(`👤 User1: ${user1.address}`);

    // ABI pour les tokens ERC20
    const erc20ABI = [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function symbol() view returns (string)"
    ];

    // Montants à approuver (100 tokens)
    const approveAmount = ethers.parseUnits("100", 18);
    console.log(`💡 Montant à approuver: 100 tokens chacun`);

    try {
        // Approval WXDAI
        console.log("\n🔧 Approval WXDAI...");
        const wxdaiContract = new ethers.Contract(config.WXDAI, erc20ABI, user1);

        // Vérifier l'allowance actuelle
        const currentWxdaiAllowance = await wxdaiContract.allowance(user1.address, config.RENT2REPAY);
        console.log(`   Allowance actuelle: ${ethers.formatUnits(currentWxdaiAllowance, 18)} WXDAI`);

        // Faire l'approval
        const wxdaiApproveTx = await wxdaiContract.approve(config.RENT2REPAY, approveAmount);
        await wxdaiApproveTx.wait();
        console.log(`✅ WXDAI approuvé: transaction ${wxdaiApproveTx.hash}`);

        // Approval USDC
        console.log("\n🔧 Approval USDC...");
        const usdcContract = new ethers.Contract(config.USDC, erc20ABI, user1);

        // Vérifier l'allowance actuelle
        const currentUsdcAllowance = await usdcContract.allowance(user1.address, config.RENT2REPAY);
        console.log(`   Allowance actuelle: ${ethers.formatUnits(currentUsdcAllowance, 18)} USDC`);

        // Faire l'approval
        const usdcApproveTx = await usdcContract.approve(config.RENT2REPAY, approveAmount);
        await usdcApproveTx.wait();
        console.log(`✅ USDC approuvé: transaction ${usdcApproveTx.hash}`);

        // Vérification finale
        console.log("\n🔍 Vérification finale...");
        const finalWxdaiAllowance = await wxdaiContract.allowance(user1.address, config.RENT2REPAY);
        const finalUsdcAllowance = await usdcContract.allowance(user1.address, config.RENT2REPAY);

        console.log(`✅ WXDAI allowance: ${ethers.formatUnits(finalWxdaiAllowance, 18)}`);
        console.log(`✅ USDC allowance: ${ethers.formatUnits(finalUsdcAllowance, 18)}`);

        console.log("\n🎉 APPROVALS TERMINÉS AVEC SUCCÈS!");
        console.log("User1 peut maintenant utiliser Rent2Repay avec ces tokens");

    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        process.exit(1);
    }
}

main()
    .then(() => {
        console.log("\n✅ Script terminé!");
        process.exit(0);
    })
    .catch(error => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    }); 