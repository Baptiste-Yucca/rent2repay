// Script pour distribuer des tokens de test et setup l'environnement
const { ethers } = require("hardhat");

// Adresses des contrats déployés (à mettre à jour après chaque déploiement)
const CONTRACTS = {
    RENT2REPAY: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    RMM: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    WXDAI: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    USDC: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"
};

async function main() {
    console.log("🎮 Configuration de l'environnement de test Rent2Repay");
    console.log("=".repeat(60));

    const [deployer, user1, user2, user3, user4] = await ethers.getSigners();

    console.log("👥 Utilisateurs de test :");
    console.log(`Deployer/Admin: ${deployer.address}`);
    console.log(`User1: ${user1.address}`);
    console.log(`User2: ${user2.address}`);
    console.log(`User3: ${user3.address}`);
    console.log(`User4: ${user4.address}`);
    console.log();

    // Obtenir les contrats
    const wxdai = await ethers.getContractAt("MockERC20", CONTRACTS.WXDAI);
    const usdc = await ethers.getContractAt("MockERC20", CONTRACTS.USDC);
    const rent2repay = await ethers.getContractAt("Rent2Repay", CONTRACTS.RENT2REPAY);

    console.log("💰 Distribution des tokens de test...");

    // Distribuer des tokens à tous les utilisateurs
    const users = [deployer, user1, user2, user3, user4];
    const mintAmount = ethers.parseUnits("10000", 18); // 10,000 tokens

    for (const user of users) {
        // Mint WXDAI
        await wxdai.mint(user.address, mintAmount);
        console.log(`✅ ${await wxdai.symbol()} mintés pour ${user.address.substring(0, 8)}...`);

        // Mint USDC
        await usdc.mint(user.address, mintAmount);
        console.log(`✅ ${await usdc.symbol()} mintés pour ${user.address.substring(0, 8)}...`);
    }

    console.log();
    console.log("✅ Tous les tokens distribués !");
    console.log();

    // Afficher les balances
    console.log("💼 Vérification des balances :");
    for (const user of users.slice(0, 3)) { // Afficher seulement les 3 premiers
        const wxdaiBalance = await wxdai.balanceOf(user.address);
        const usdcBalance = await usdc.balanceOf(user.address);
        const ethBalance = await ethers.provider.getBalance(user.address);

        console.log(`👤 ${user.address.substring(0, 8)}...:`);
        console.log(`   ETH: ${ethers.formatEther(ethBalance)} ETH`);
        console.log(`   WXDAI: ${ethers.formatUnits(wxdaiBalance, 18)} WXDAI`);
        console.log(`   USDC: ${ethers.formatUnits(usdcBalance, 18)} USDC`);
        console.log();
    }

    // Configuration d'exemple pour User1
    console.log("⚙️  Configuration d'exemple pour User1...");

    // Connecter avec User1
    const user1Connected = rent2repay.connect(user1);
    const wxdaiUser1 = wxdai.connect(user1);
    const usdcUser1 = usdc.connect(user1);

    // Approuver les tokens pour Rent2Repay
    const approveAmount = ethers.parseUnits("1000", 18);
    await wxdaiUser1.approve(CONTRACTS.RENT2REPAY, approveAmount);
    await usdcUser1.approve(CONTRACTS.RENT2REPAY, approveAmount);
    console.log("✅ Approbations configurées pour User1");

    // Configurer des limites hebdomadaires
    const weeklyLimitWXDAI = ethers.parseUnits("100", 18);
    const weeklyLimitUSDC = ethers.parseUnits("50", 18);

    await user1Connected.configureRent2Repay(
        [CONTRACTS.WXDAI, CONTRACTS.USDC],
        [weeklyLimitWXDAI, weeklyLimitUSDC]
    );
    console.log("✅ Limites hebdomadaires configurées pour User1");
    console.log(`   WXDAI: 100 tokens/semaine`);
    console.log(`   USDC: 50 tokens/semaine`);
    console.log();

    // Résumé final
    console.log("📋 RÉSUMÉ DE LA CONFIGURATION");
    console.log("=".repeat(40));
    console.log(`🏠 Rent2Repay: ${CONTRACTS.RENT2REPAY}`);
    console.log(`🏦 MockRMM: ${CONTRACTS.RMM}`);
    console.log(`💰 WXDAI: ${CONTRACTS.WXDAI}`);
    console.log(`💰 USDC: ${CONTRACTS.USDC}`);
    console.log();
    console.log("✅ Environnement de test prêt !");
    console.log();
    console.log("🔗 Pour utiliser l'interface web :");
    console.log("1. Ouvrez test/front_local/index.html");
    console.log("2. Connectez-vous avec Rabby/MetaMask");
    console.log("3. Utilisez l'adresse du contrat Rent2Repay ci-dessus");
    console.log();
    console.log("🧪 Comptes de test configurés :");
    console.log(`   User1 (${user1.address}) a des limites configurées`);
    console.log(`   User2-4 ont des tokens mais pas de limites`);
    console.log();

    // Sauvegarder les adresses pour l'interface web
    const addressesConfig = {
        network: "localhost",
        chainId: 31337,
        contracts: CONTRACTS,
        deployed_at: new Date().toISOString(),
        test_users: {
            deployer: deployer.address,
            user1: user1.address,
            user2: user2.address,
            user3: user3.address,
            user4: user4.address
        }
    };

    // Écrire dans localStorage pour l'interface web (sera lu par l'interface)
    console.log("💾 Configuration sauvegardée pour l'interface web");
    console.log("📄 Copiez ces adresses dans l'interface si nécessaire :");
    console.log(JSON.stringify(CONTRACTS, null, 2));
}

main()
    .then(() => {
        console.log("\n🎉 Configuration terminée avec succès !");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Erreur :", error);
        process.exit(1);
    }); 