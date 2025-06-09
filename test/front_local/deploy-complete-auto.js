// Script de déploiement complet avec mise à jour automatique de config.js
const { ethers } = require("hardhat");
const { updateConfig } = require("./update-config");

async function main() {
    console.log("🚀 DÉPLOIEMENT COMPLET AUTOMATIQUE");
    console.log("=".repeat(50));

    const [deployer, user1, user2, user3] = await ethers.getSigners();
    console.log(`👤 Déployeur: ${deployer.address}`);
    console.log(`👤 User1 (sera configuré): ${user1.address}`);

    const deployedAddresses = {};

    // 1. Déployer MockRMM
    console.log("\n📦 1. Déploiement MockRMM...");
    const MockRMM = await ethers.getContractFactory("MockRMM");
    const rmm = await MockRMM.deploy();
    await rmm.waitForDeployment();
    const rmmAddress = await rmm.getAddress();
    deployedAddresses.RMM = rmmAddress;
    console.log(`✅ MockRMM: ${rmmAddress}`);

    // 2. Déployer les tokens WXDAI et USDC
    console.log("\n📦 2. Déploiement des tokens...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");

    const wxdai = await MockERC20.deploy("Wrapped xDAI", "WXDAI");
    await wxdai.waitForDeployment();
    const wxdaiAddress = await wxdai.getAddress();
    deployedAddresses.WXDAI = wxdaiAddress;
    console.log(`✅ WXDAI: ${wxdaiAddress}`);

    const usdc = await MockERC20.deploy("USD Coin", "USDC");
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    deployedAddresses.USDC = usdcAddress;
    console.log(`✅ USDC: ${usdcAddress}`);

    // 3. Déployer Rent2Repay
    console.log("\n📦 3. Déploiement Rent2Repay...");
    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2repay = await Rent2Repay.deploy(
        deployer.address, // admin
        deployer.address, // emergency
        deployer.address, // operator
        rmmAddress,       // rmm
        wxdaiAddress,     // wxdai
        usdcAddress       // usdc
    );
    await rent2repay.waitForDeployment();
    const rent2repayAddress = await rent2repay.getAddress();
    deployedAddresses.RENT2REPAY = rent2repayAddress;
    console.log(`✅ Rent2Repay: ${rent2repayAddress}`);

    // 4. Déployer les tokens de dette
    console.log("\n📦 4. Déploiement des tokens de dette...");
    const debtWxdai = await MockERC20.deploy("Debt Token WXDAI", "debtWXDAI");
    await debtWxdai.waitForDeployment();
    const debtWxdaiAddress = await debtWxdai.getAddress();
    deployedAddresses.DEBT_WXDAI = debtWxdaiAddress;
    console.log(`✅ debtWXDAI: ${debtWxdaiAddress}`);

    const debtUsdc = await MockERC20.deploy("Debt Token USDC", "debtUSDC");
    await debtUsdc.waitForDeployment();
    const debtUsdcAddress = await debtUsdc.getAddress();
    deployedAddresses.DEBT_USDC = debtUsdcAddress;
    console.log(`✅ debtUSDC: ${debtUsdcAddress}`);

    // 5. Configuration initiale
    console.log("\n⚙️  5. Configuration initiale...");

    // Mint des tokens pour les tests
    const mintAmount = ethers.parseUnits("10000", 18);
    const testUsers = [deployer, user1, user2, user3];

    for (const user of testUsers) {
        await wxdai.mint(user.address, mintAmount);
        await usdc.mint(user.address, mintAmount);

        if (user !== user1) {
            await debtWxdai.mint(user.address, ethers.parseUnits("1000", 18));
            await debtUsdc.mint(user.address, ethers.parseUnits("1000", 18));
        }
    }
    console.log("✅ Tokens mintés pour tous les utilisateurs");

    // 6. Configuration spéciale User1
    console.log("\n🎯 6. Configuration User1...");

    // Mint des tokens de dette spécifiques pour User1
    await debtWxdai.mint(user1.address, ethers.parseUnits("150", 18));
    await debtUsdc.mint(user1.address, ethers.parseUnits("20", 18));
    console.log("✅ Tokens de dette mintés pour User1");

    // Configurer Rent2Repay pour User1
    const wxdaiLimit = ethers.parseUnits("100", 18);
    const usdcLimit = ethers.parseUnits("50", 18);

    const user1Connected = rent2repay.connect(user1);
    await user1Connected.configureRent2Repay(
        [wxdaiAddress, usdcAddress],
        [wxdaiLimit, usdcLimit]
    );
    console.log("✅ User1 configuré dans Rent2Repay");

    // 7. Mettre à jour config.js automatiquement
    console.log("\n🔄 7. Mise à jour config.js...");
    updateConfig(deployedAddresses);

    // 8. Résumé final
    console.log("\n📋 RÉSUMÉ DU DÉPLOIEMENT");
    console.log("=".repeat(40));
    console.log(`🏷️  Rent2Repay: ${rent2repayAddress}`);
    console.log(`🏷️  MockRMM: ${rmmAddress}`);
    console.log(`🏷️  WXDAI: ${wxdaiAddress}`);
    console.log(`🏷️  USDC: ${usdcAddress}`);
    console.log(`🏷️  debtWXDAI: ${debtWxdaiAddress}`);
    console.log(`🏷️  debtUSDC: ${debtUsdcAddress}`);

    console.log("\n👤 USER1 CONFIGURÉ");
    console.log("=".repeat(20));
    console.log(`📍 Adresse: ${user1.address}`);
    console.log(`💰 Tokens de dette: 150 debtWXDAI + 20 debtUSDC`);
    console.log(`⚙️  Limites: 100 WXDAI/semaine + 50 USDC/semaine`);

    console.log("\n✅ PRÊT POUR L'INTERFACE WEB");
    console.log("config.js a été automatiquement mis à jour !");
    console.log("Vous pouvez maintenant ouvrir l'interface web");

    return deployedAddresses;
}

main()
    .then((addresses) => {
        console.log("\n🎉 Déploiement complet terminé avec succès !");
        console.log("L'interface web est prête à être utilisée");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Erreur :", error);
        process.exit(1);
    }); 