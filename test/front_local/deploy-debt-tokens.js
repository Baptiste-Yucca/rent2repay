// Script pour déployer des tokens de dette mock pour les tests locaux
const { ethers } = require("hardhat");

// Adresse du contrat Rent2Repay
const RENT2REPAY_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
const WXDAI_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const USDC_ADDRESS = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";

async function main() {
    console.log("🚀 Déploiement des Tokens de Dette Mock");
    console.log("=".repeat(50));

    const [deployer, user1, user2, user3] = await ethers.getSigners();
    console.log(`👤 Déployeur: ${deployer.address}`);
    console.log(`👤 User1 (à configurer): ${user1.address}`);

    // Déployer le token de dette WXDAI
    console.log("\n📦 Déploiement debtWXDAI...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const debtWxdai = await MockERC20.deploy("Debt Token WXDAI", "debtWXDAI");
    await debtWxdai.waitForDeployment();
    const debtWxdaiAddress = await debtWxdai.getAddress();
    console.log(`✅ debtWXDAI déployé à: ${debtWxdaiAddress}`);

    // Déployer le token de dette USDC
    console.log("\n📦 Déploiement debtUSDC...");
    const debtUsdc = await MockERC20.deploy("Debt Token USDC", "debtUSDC");
    await debtUsdc.waitForDeployment();
    const debtUsdcAddress = await debtUsdc.getAddress();
    console.log(`✅ debtUSDC déployé à: ${debtUsdcAddress}`);

    // Mint des tokens de dette standards pour les tests
    console.log("\n🪙 Mint initial pour les tests...");
    const mintAmount = ethers.parseUnits("1000", 18);

    const testUsers = [deployer, user1, user2, user3];

    for (const user of testUsers) {
        if (user !== user1) { // User1 aura une configuration spéciale
            // Mint debtWXDAI
            await debtWxdai.mint(user.address, mintAmount);
            // Mint debtUSDC  
            await debtUsdc.mint(user.address, mintAmount);

            console.log(`   ✅ Tokens mintés pour ${user.address.substring(0, 8)}...`);
        }
    }

    // Configuration spéciale pour User1
    console.log("\n⚙️  Configuration spéciale pour User1...");

    // 1. Mint les bonnes quantités de tokens de dette pour User1
    const user1DebtWxdai = ethers.parseUnits("150", 18); // 150 debtWXDAI
    const user1DebtUsdc = ethers.parseUnits("20", 18);   // 20 debtUSDC

    await debtWxdai.mint(user1.address, user1DebtWxdai);
    await debtUsdc.mint(user1.address, user1DebtUsdc);
    console.log(`   💰 User1 reçoit: 150 debtWXDAI + 20 debtUSDC`);

    // 2. Configurer Rent2Repay pour User1
    console.log("\n🔧 Configuration Rent2Repay pour User1...");

    try {
        const rent2repay = await ethers.getContractAt("Rent2Repay", RENT2REPAY_ADDRESS);

        // Configuration des limites: 100 WXDAI, 50 USDC
        const wxdaiLimit = ethers.parseUnits("100", 18);
        const usdcLimit = ethers.parseUnits("50", 18);

        const user1Connected = rent2repay.connect(user1);
        await user1Connected.configureRent2Repay(
            [WXDAI_ADDRESS, USDC_ADDRESS],
            [wxdaiLimit, usdcLimit]
        );

        console.log(`   ✅ User1 configuré avec:`);
        console.log(`      - WXDAI: 100 tokens/semaine`);
        console.log(`      - USDC: 50 tokens/semaine`);

        // Vérifier la configuration
        const configs = await rent2repay.getUserConfigs(user1.address);
        console.log(`   📊 Vérification: ${configs[0].length} tokens configurés`);

    } catch (error) {
        console.log(`   ⚠️  Erreur configuration Rent2Repay: ${error.message}`);
        console.log(`   💡 Assurez-vous que le contrat Rent2Repay est déployé`);
    }

    // Résumé final
    console.log("\n📋 RÉSUMÉ DES DÉPLOIEMENTS");
    console.log("=".repeat(40));
    console.log(`🏷️  debtWXDAI: ${debtWxdaiAddress}`);
    console.log(`🏷️  debtUSDC: ${debtUsdcAddress}`);

    console.log("\n👤 CONFIGURATION USER1");
    console.log("=".repeat(25));
    console.log(`📍 Adresse: ${user1.address}`);
    console.log(`💰 Tokens de dette:`);
    console.log(`   • 150 debtWXDAI`);
    console.log(`   • 20 debtUSDC`);
    console.log(`⚙️  Limites Rent2Repay:`);
    console.log(`   • 100 WXDAI/semaine`);
    console.log(`   • 50 USDC/semaine`);

    console.log("\n📝 Pour utiliser dans l'interface :");
    console.log("1. Mettez à jour config.js avec ces nouvelles adresses");
    console.log("2. Connectez-vous avec User1 pour voir sa configuration");
    console.log("\n🔧 Adresses à copier dans config.js :");
    console.log(`DEBT_WXDAI: "${debtWxdaiAddress}",`);
    console.log(`DEBT_USDC: "${debtUsdcAddress}",`);

    // Sauvegarder dans un fichier JSON
    const addresses = {
        DEBT_WXDAI: debtWxdaiAddress,
        DEBT_USDC: debtUsdcAddress,
        user1_configuration: {
            address: user1.address,
            debt_balances: {
                debtWXDAI: "150",
                debtUSDC: "20"
            },
            rent2repay_limits: {
                WXDAI: "100",
                USDC: "50"
            }
        },
        deployed_at: new Date().toISOString(),
        network: "localhost"
    };

    console.log("\n💾 Configuration générée :");
    console.log(JSON.stringify(addresses, null, 2));

    return addresses;
}

main()
    .then((addresses) => {
        console.log("\n🎉 Tokens de dette déployés et User1 configuré avec succès !");
        console.log("Vous pouvez maintenant utiliser ces adresses dans l'interface web");
        console.log("Connectez-vous avec User1 pour voir sa configuration complète");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Erreur :", error);
        process.exit(1);
    }); 