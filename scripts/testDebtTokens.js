const { ethers } = require("hardhat");
const {
    getDebtTokenBalance,
    getDebtTokenInfo,
    mintDebtTokens,
    burnDebtTokens
} = require("./debtTokenUtils");

async function main() {
    console.log("🚀 Test des tokens de dette armmv3WXDAI et armmv3USDC");
    console.log("=".repeat(60));

    // Obtenir les signers
    const [deployer, user1, user2] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log(`User1: ${user1.address}`);
    console.log(`User2: ${user2.address}`);
    console.log("");

    // Ces adresses seront affichées après le déploiement
    // Vous devrez les remplacer par les vraies adresses après déploiement
    const DEBT_TOKENS = {
        armmv3WXDAI: "REMPLACER_PAR_ADRESSE_DEPLOYEE",
        armmv3USDC: "REMPLACER_PAR_ADRESSE_DEPLOYEE"
    };

    console.log("📋 Adresses des tokens de dette:");
    console.log(`armmv3WXDAI: ${DEBT_TOKENS.armmv3WXDAI}`);
    console.log(`armmv3USDC: ${DEBT_TOKENS.armmv3USDC}`);
    console.log("");

    // Si les adresses ne sont pas encore définies, arrêter ici
    if (DEBT_TOKENS.armmv3WXDAI === "REMPLACER_PAR_ADRESSE_DEPLOYEE") {
        console.log("⚠️  Veuillez d'abord déployer les contrats et mettre à jour les adresses dans ce script");
        console.log("💡 Commande de déploiement: npx hardhat ignition deploy ignition/modules/DebtTokens.js --network localhost");
        return;
    }

    try {
        // Test 1: Obtenir les informations des tokens
        console.log("📊 Test 1: Informations des tokens de dette");
        console.log("-".repeat(40));

        await getDebtTokenInfo(DEBT_TOKENS.armmv3WXDAI);
        console.log("");
        await getDebtTokenInfo(DEBT_TOKENS.armmv3USDC);
        console.log("");

        // Test 2: Vérifier les soldes initiaux
        console.log("💰 Test 2: Soldes initiaux");
        console.log("-".repeat(40));

        await getDebtTokenBalance(DEBT_TOKENS.armmv3WXDAI, deployer.address);
        await getDebtTokenBalance(DEBT_TOKENS.armmv3USDC, deployer.address);
        await getDebtTokenBalance(DEBT_TOKENS.armmv3WXDAI, user1.address);
        await getDebtTokenBalance(DEBT_TOKENS.armmv3USDC, user1.address);
        console.log("");

        // Test 3: Simuler un emprunt (mint de tokens de dette)
        console.log("🏦 Test 3: Simulation d'emprunt (mint de tokens de dette)");
        console.log("-".repeat(40));

        await mintDebtTokens(DEBT_TOKENS.armmv3WXDAI, user1.address, "1000");
        await mintDebtTokens(DEBT_TOKENS.armmv3USDC, user1.address, "500");
        console.log("");

        // Test 4: Vérifier les nouveaux soldes
        console.log("📈 Test 4: Soldes après emprunt");
        console.log("-".repeat(40));

        await getDebtTokenBalance(DEBT_TOKENS.armmv3WXDAI, user1.address);
        await getDebtTokenBalance(DEBT_TOKENS.armmv3USDC, user1.address);
        console.log("");

        // Test 5: Simuler un remboursement partiel (burn de tokens de dette)
        console.log("💸 Test 5: Simulation de remboursement partiel");
        console.log("-".repeat(40));

        await burnDebtTokens(DEBT_TOKENS.armmv3WXDAI, user1.address, "300");
        await burnDebtTokens(DEBT_TOKENS.armmv3USDC, user1.address, "100");
        console.log("");

        // Test 6: Soldes finaux
        console.log("📊 Test 6: Soldes finaux");
        console.log("-".repeat(40));

        await getDebtTokenBalance(DEBT_TOKENS.armmv3WXDAI, user1.address);
        await getDebtTokenBalance(DEBT_TOKENS.armmv3USDC, user1.address);
        console.log("");

        console.log("✅ Tous les tests sont terminés avec succès!");

    } catch (error) {
        console.error("❌ Erreur lors des tests:", error.message);
    }
}

// Exécuter le script seulement si appelé directement
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { main }; 