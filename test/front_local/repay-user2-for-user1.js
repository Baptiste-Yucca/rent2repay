// Script pour que User2 déclenche un remboursement de 100 USDC pour User1
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("💸 REMBOURSEMENT USER2 → USER1");
    console.log("=".repeat(35));

    // Charger la configuration
    const configContent = fs.readFileSync('contract-addresses.json', 'utf8');
    const config = JSON.parse(configContent);

    console.log("📋 Configuration:");
    console.log(`   RENT2REPAY: ${config.RENT2REPAY}`);
    console.log(`   USDC: ${config.USDC}`);

    // Se connecter au réseau
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    // Récupérer les signers
    const signers = await ethers.getSigners();
    const user1 = signers[1]; // User1 (bénéficiaire du remboursement)
    const user2 = signers[2]; // User2 (celui qui déclenche)

    console.log(`👤 User1 (bénéficiaire): ${user1.address}`);
    console.log(`👤 User2 (exécuteur): ${user2.address}`);

    // ABI pour les contrats
    const erc20ABI = [
        "function balanceOf(address owner) view returns (uint256)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function symbol() view returns (string)"
    ];

    const rent2repayABI = [
        "function rent2repay(address user, address token, uint256 amount) returns (bool)",
        "function getUserConfigForToken(address user, address token) view returns (uint256, uint256, uint256)",
        "function getAvailableAmountThisWeek(address user, address token) view returns (uint256)"
    ];

    // Montant à rembourser (50 USDC pour respecter la limite)
    const repayAmount = ethers.parseUnits("50", 18);
    console.log(`💰 Montant à rembourser: 50 USDC`);

    try {
        // Contrats
        const usdcContract = new ethers.Contract(config.USDC, erc20ABI, provider);
        const rent2repayContract = new ethers.Contract(config.RENT2REPAY, rent2repayABI, user2);

        // Vérifications préalables
        console.log("\n🔍 Vérifications préalables...");

        // 1. Balance User1
        const user1Balance = await usdcContract.balanceOf(user1.address);
        console.log(`   User1 USDC balance: ${ethers.formatUnits(user1Balance, 18)}`);

        // 2. Allowance User1 vers Rent2Repay
        const allowance = await usdcContract.allowance(user1.address, config.RENT2REPAY);
        console.log(`   User1 USDC allowance: ${ethers.formatUnits(allowance, 18)}`);

        // 3. Configuration User1 dans Rent2Repay
        const userConfig = await rent2repayContract.getUserConfigForToken(user1.address, config.USDC);
        console.log(`   User1 limite USDC/semaine: ${ethers.formatUnits(userConfig[0], 18)}`);
        console.log(`   User1 déjà dépensé cette semaine: ${ethers.formatUnits(userConfig[1], 18)}`);

        // 4. Montant disponible cette semaine
        const availableAmount = await rent2repayContract.getAvailableAmountThisWeek(user1.address, config.USDC);
        console.log(`   Montant disponible cette semaine: ${ethers.formatUnits(availableAmount, 18)}`);

        // Vérifications de sécurité
        if (user1Balance < repayAmount) {
            throw new Error(`User1 n'a pas assez d'USDC (${ethers.formatUnits(user1Balance, 18)} < 50)`);
        }

        if (allowance < repayAmount) {
            throw new Error(`User1 n'a pas approuvé assez d'USDC (${ethers.formatUnits(allowance, 18)} < 50)`);
        }

        if (availableAmount < repayAmount) {
            throw new Error(`Limite hebdomadaire dépassée (disponible: ${ethers.formatUnits(availableAmount, 18)})`);
        }

        console.log("✅ Toutes les vérifications passent!");

        // Balances avant remboursement
        console.log("\n📊 Balances AVANT remboursement:");
        const user1BalanceBefore = await usdcContract.balanceOf(user1.address);
        const user2BalanceBefore = await usdcContract.balanceOf(user2.address);
        const contractBalanceBefore = await usdcContract.balanceOf(config.RENT2REPAY);

        console.log(`   User1: ${ethers.formatUnits(user1BalanceBefore, 18)} USDC`);
        console.log(`   User2: ${ethers.formatUnits(user2BalanceBefore, 18)} USDC`);
        console.log(`   Contrat: ${ethers.formatUnits(contractBalanceBefore, 18)} USDC`);

        // Exécuter le remboursement
        console.log("\n🚀 Exécution du remboursement...");
        console.log(`   User2 déclenche rent2repay(${user1.address}, ${config.USDC}, 50)`);

        const tx = await rent2repayContract.rent2repay(
            user1.address,    // user (bénéficiaire)
            config.USDC,      // token
            repayAmount       // amount
        );

        console.log(`⏳ Transaction envoyée: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmée en ${receipt.gasUsed} gas`);

        // Balances après remboursement
        console.log("\n📊 Balances APRÈS remboursement:");
        const user1BalanceAfter = await usdcContract.balanceOf(user1.address);
        const user2BalanceAfter = await usdcContract.balanceOf(user2.address);
        const contractBalanceAfter = await usdcContract.balanceOf(config.RENT2REPAY);

        console.log(`   User1: ${ethers.formatUnits(user1BalanceAfter, 18)} USDC (${ethers.formatUnits(user1BalanceAfter - user1BalanceBefore, 18)})`);
        console.log(`   User2: ${ethers.formatUnits(user2BalanceAfter, 18)} USDC (${ethers.formatUnits(user2BalanceAfter - user2BalanceBefore, 18)})`);
        console.log(`   Contrat: ${ethers.formatUnits(contractBalanceAfter, 18)} USDC (${ethers.formatUnits(contractBalanceAfter - contractBalanceBefore, 18)})`);

        // Configuration mise à jour
        console.log("\n📈 Configuration User1 mise à jour:");
        const userConfigAfter = await rent2repayContract.getUserConfigForToken(user1.address, config.USDC);
        console.log(`   Dépensé cette semaine: ${ethers.formatUnits(userConfigAfter[1], 18)} USDC`);

        const availableAfter = await rent2repayContract.getAvailableAmountThisWeek(user1.address, config.USDC);
        console.log(`   Reste disponible: ${ethers.formatUnits(availableAfter, 18)} USDC`);

        console.log("\n🎉 REMBOURSEMENT RÉUSSI!");
        console.log("User2 a successfully déclenché un remboursement pour User1");

    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        if (error.code === 'CALL_EXCEPTION') {
            console.error("💡 Vérifiez que User1 a bien configuré Rent2Repay et approuvé les tokens");
        }
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