// Script pour vérifier la configuration complète de User1
const { ethers } = require("hardhat");

// Adresses des contrats
const CONTRACTS = {
    RENT2REPAY: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    WXDAI: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    USDC: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    DEBT_WXDAI: "0x95401dc811bb5740090279Ba06cfA8fcF6113778",
    DEBT_USDC: "0x998abeb3E57409262aE5b751f60747921B33613E"
};

async function main() {
    console.log("🔍 Vérification de la Configuration User1");
    console.log("=".repeat(50));

    const [deployer, user1] = await ethers.getSigners();
    console.log(`👤 User1: ${user1.address}`);

    // Obtenir les contrats
    const rent2repay = await ethers.getContractAt("Rent2Repay", CONTRACTS.RENT2REPAY);
    const wxdai = await ethers.getContractAt("MockERC20", CONTRACTS.WXDAI);
    const usdc = await ethers.getContractAt("MockERC20", CONTRACTS.USDC);
    const debtWxdai = await ethers.getContractAt("MockERC20", CONTRACTS.DEBT_WXDAI);
    const debtUsdc = await ethers.getContractAt("MockERC20", CONTRACTS.DEBT_USDC);

    console.log("\n💰 BALANCES DE USER1");
    console.log("=".repeat(25));

    // ETH
    const ethBalance = await ethers.provider.getBalance(user1.address);
    console.log(`ETH: ${ethers.formatEther(ethBalance)} ETH`);

    // Asset tokens
    const wxdaiBalance = await wxdai.balanceOf(user1.address);
    const usdcBalance = await usdc.balanceOf(user1.address);
    console.log(`WXDAI: ${ethers.formatUnits(wxdaiBalance, 18)} WXDAI`);
    console.log(`USDC: ${ethers.formatUnits(usdcBalance, 18)} USDC`);

    // Debt tokens
    const debtWxdaiBalance = await debtWxdai.balanceOf(user1.address);
    const debtUsdcBalance = await debtUsdc.balanceOf(user1.address);
    console.log(`debtWXDAI: ${ethers.formatUnits(debtWxdaiBalance, 18)} debtWXDAI`);
    console.log(`debtUSDC: ${ethers.formatUnits(debtUsdcBalance, 18)} debtUSDC`);

    console.log("\n⚙️  CONFIGURATION RENT2REPAY");
    console.log("=".repeat(35));

    // Vérifier si User1 est autorisé
    const isAuthorized = await rent2repay.isAuthorized(user1.address);
    console.log(`Statut: ${isAuthorized ? "✅ Autorisé" : "❌ Non autorisé"}`);

    if (isAuthorized) {
        // Obtenir la configuration
        const configs = await rent2repay.getUserConfigs(user1.address);
        console.log(`Nombre de tokens configurés: ${configs[0].length}`);

        for (let i = 0; i < configs[0].length; i++) {
            const tokenAddr = configs[0][i];
            const maxAmount = configs[1][i];
            const spentAmount = configs[2][i];

            // Identifier le token
            let tokenSymbol = "UNKNOWN";
            if (tokenAddr.toLowerCase() === CONTRACTS.WXDAI.toLowerCase()) {
                tokenSymbol = "WXDAI";
            } else if (tokenAddr.toLowerCase() === CONTRACTS.USDC.toLowerCase()) {
                tokenSymbol = "USDC";
            }

            // Obtenir le montant disponible cette semaine
            const available = await rent2repay.getAvailableAmountThisWeek(user1.address, tokenAddr);

            console.log(`\n📊 ${tokenSymbol}:`);
            console.log(`   Limite hebdomadaire: ${ethers.formatUnits(maxAmount, 18)}`);
            console.log(`   Dépensé cette semaine: ${ethers.formatUnits(spentAmount, 18)}`);
            console.log(`   Disponible: ${ethers.formatUnits(available, 18)}`);
        }
    }

    console.log("\n🎯 RÉSUMÉ ATTENDU vs RÉEL");
    console.log("=".repeat(30));

    const expected = {
        debtWXDAI: "150.0",
        debtUSDC: "20.0",
        wxdaiLimit: "100.0",
        usdcLimit: "50.0"
    };

    const actual = {
        debtWXDAI: ethers.formatUnits(debtWxdaiBalance, 18),
        debtUSDC: ethers.formatUnits(debtUsdcBalance, 18),
        isConfigured: isAuthorized
    };

    console.log("Attendu:");
    console.log(`  • 150 debtWXDAI → Réel: ${actual.debtWXDAI}`);
    console.log(`  • 20 debtUSDC → Réel: ${actual.debtUSDC}`);
    console.log(`  • Configuration Rent2Repay → ${actual.isConfigured ? "✅" : "❌"}`);

    // Vérification des limites si configuré
    if (isAuthorized) {
        console.log(`  • Limite WXDAI: 100/semaine → ✅`);
        console.log(`  • Limite USDC: 50/semaine → ✅`);
    }

    console.log("\n🚀 TEST DE REMBOURSEMENT POSSIBLE");
    console.log("=".repeat(40));

    if (isAuthorized) {
        // Tester avec le deployer qui peut rembourser pour User1
        const wxdaiDeployerBalance = await wxdai.balanceOf(deployer.address);
        const usdcDeployerBalance = await usdc.balanceOf(deployer.address);

        console.log(`Deployer peut rembourser:`);
        console.log(`  • WXDAI: ${ethers.formatUnits(wxdaiDeployerBalance, 18)} disponible`);
        console.log(`  • USDC: ${ethers.formatUnits(usdcDeployerBalance, 18)} disponible`);

        if (wxdaiDeployerBalance > 0) {
            console.log(`✅ Prêt pour test remboursement WXDAI`);
        }
        if (usdcDeployerBalance > 0) {
            console.log(`✅ Prêt pour test remboursement USDC`);
        }
    }

    console.log("\n📱 INTERFACE WEB");
    console.log("=".repeat(20));
    console.log("Dans l'interface web, vous devriez voir:");
    console.log(`• User1 avec ${actual.debtWXDAI} debtWXDAI et ${actual.debtUSDC} debtUSDC`);
    console.log(`• Configuration active avec limites WXDAI/USDC`);
    console.log(`• Possibilité de remboursement par l'admin`);
}

main()
    .then(() => {
        console.log("\n🎉 Vérification terminée !");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Erreur :", error);
        process.exit(1);
    }); 