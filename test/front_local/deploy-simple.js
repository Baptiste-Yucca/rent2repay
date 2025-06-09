// Script de déploiement ultra-simple pour les tests
const { ethers } = require("hardhat");
const { updateConfig } = require('./update-config.js');

async function main() {
    console.log("🚀 DÉPLOIEMENT SIMPLE POUR TESTS");
    console.log("=".repeat(40));

    const [deployer, user1] = await ethers.getSigners();
    console.log(`👤 Déployeur: ${deployer.address}`);
    console.log(`👤 User1: ${user1.address}`);

    // 1. Déployer MockRMM
    console.log("\n📦 1. Déploiement MockRMM...");
    const MockRMM = await ethers.getContractFactory("MockRMM");
    const rmm = await MockRMM.deploy();
    await rmm.waitForDeployment();
    const rmmAddress = await rmm.getAddress();
    console.log(`✅ MockRMM déployé: ${rmmAddress}`);

    // 2. Déployer WXDAI
    console.log("\n📦 2. Déploiement WXDAI...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const wxdai = await MockERC20.deploy("Wrapped xDAI", "WXDAI");
    await wxdai.waitForDeployment();
    const wxdaiAddress = await wxdai.getAddress();
    console.log(`✅ WXDAI déployé: ${wxdaiAddress}`);

    // 3. Déployer USDC
    console.log("\n📦 3. Déploiement USDC...");
    const usdc = await MockERC20.deploy("USD Coin", "USDC");
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log(`✅ USDC déployé: ${usdcAddress}`);

    // 4. Déployer Rent2Repay
    console.log("\n📦 4. Déploiement Rent2Repay...");
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
    console.log(`✅ Rent2Repay déployé: ${rent2repayAddress}`);

    // 5. Déployer tokens de dette
    console.log("\n📦 5. Déploiement tokens de dette...");
    const debtWxdai = await MockERC20.deploy("Debt Token WXDAI", "debtWXDAI");
    await debtWxdai.waitForDeployment();
    const debtWxdaiAddress = await debtWxdai.getAddress();

    const debtUsdc = await MockERC20.deploy("Debt Token USDC", "debtUSDC");
    await debtUsdc.waitForDeployment();
    const debtUsdcAddress = await debtUsdc.getAddress();

    console.log(`✅ debtWXDAI déployé: ${debtWxdaiAddress}`);
    console.log(`✅ debtUSDC déployé: ${debtUsdcAddress}`);

    // 6. Mint des tokens pour les tests
    console.log("\n🪙 6. Mint des tokens pour les tests...");
    const mintAmount = ethers.parseUnits("10000", 18);
    const users = [deployer, user1];

    for (const user of users) {
        await wxdai.mint(user.address, mintAmount);
        await usdc.mint(user.address, mintAmount);
        await debtWxdai.mint(user.address, ethers.parseUnits("1000", 18));
        await debtUsdc.mint(user.address, ethers.parseUnits("1000", 18));
    }
    console.log("✅ Tokens mintés pour deployer et user1");

    // 7. Configuration User1 avec des dettes
    console.log("\n⚙️ 7. Configuration User1...");
    await debtWxdai.mint(user1.address, ethers.parseUnits("150", 18));
    await debtUsdc.mint(user1.address, ethers.parseUnits("20", 18));

    const user1Connected = rent2repay.connect(user1);
    await user1Connected.configureRent2Repay(
        [wxdaiAddress, usdcAddress],
        [ethers.parseUnits("100", 18), ethers.parseUnits("50", 18)]
    );
    console.log("✅ User1 configuré avec 100 WXDAI et 50 USDC par semaine");

    // 8. Mettre à jour config.js automatiquement
    console.log("\n📝 8. Mise à jour de config.js...");
    const addresses = {
        rent2repay: rent2repayAddress,
        rmm: rmmAddress,
        wxdai: wxdaiAddress,
        usdc: usdcAddress,
        debtWxdai: debtWxdaiAddress,
        debtUsdc: debtUsdcAddress
    };

    updateConfig(addresses);

    // 9. Afficher les adresses finales
    console.log("\n📋 ADRESSES DÉPLOYÉES:");
    console.log("=".repeat(40));
    console.log(`Rent2Repay: ${rent2repayAddress}`);
    console.log(`MockRMM:    ${rmmAddress}`);
    console.log(`WXDAI:      ${wxdaiAddress}`);
    console.log(`USDC:       ${usdcAddress}`);
    console.log(`debtWXDAI:  ${debtWxdaiAddress}`);
    console.log(`debtUSDC:   ${debtUsdcAddress}`);

    console.log("\n🎉 DÉPLOIEMENT RÉUSSI !");
    console.log("✅ config.js automatiquement mis à jour");
    console.log("🚀 Vous pouvez maintenant ouvrir test/front_local/index.html");

    return addresses;
}

main()
    .then(() => {
        console.log("\n✅ Script terminé avec succès");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }); 