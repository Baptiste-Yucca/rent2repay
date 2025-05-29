const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Déploiement du contrat Rent2Repay avec intégration RMM...\n");

    // Récupération des signers
    const [deployer, admin, emergency, operator] = await ethers.getSigners();

    console.log("👤 Comptes utilisés pour le déploiement :");
    console.log("Deployer:", deployer.address);
    console.log("Admin:", admin.address);
    console.log("Emergency:", emergency.address);
    console.log("Operator:", operator.address);
    console.log();

    // 1. Déploiement du token de repayment (MockERC20 pour les tests)
    console.log("💰 Déploiement du token de repayment...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const repaymentToken = await MockERC20.deploy("USD Coin", "USDC");
    await repaymentToken.waitForDeployment();
    const repaymentTokenAddress = await repaymentToken.getAddress();
    console.log("✅ Token de repayment déployé à:", repaymentTokenAddress);

    // 2. Déploiement du MockRMM
    console.log("🏦 Déploiement du MockRMM...");
    const MockRMM = await ethers.getContractFactory("MockRMM");
    const mockRMM = await MockRMM.deploy();
    await mockRMM.waitForDeployment();
    const mockRMMAddress = await mockRMM.getAddress();
    console.log("✅ MockRMM déployé à:", mockRMMAddress);

    // 3. Déploiement du contrat Rent2Repay
    console.log("🏠 Déploiement du contrat Rent2Repay...");
    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2Repay = await Rent2Repay.deploy(
        admin.address,
        emergency.address,
        operator.address,
        mockRMMAddress,
        repaymentTokenAddress
    );

    await rent2Repay.waitForDeployment();
    const rent2RepayAddress = await rent2Repay.getAddress();
    console.log("✅ Contrat Rent2Repay déployé à:", rent2RepayAddress);
    console.log();

    // Vérification des configurations
    console.log("🔍 Vérification des configurations :");
    console.log("- Token de repayment:", await rent2Repay.repaymentToken());
    console.log("- Adresse RMM:", await rent2Repay.rmm());
    console.log("- Contract paused:", await rent2Repay.paused());
    console.log();

    // Mint des tokens de test
    console.log("🪙 Distribution de tokens de test...");
    const mintAmount = ethers.parseEther("10000");

    // Mint pour le deployer
    await repaymentToken.mint(deployer.address, mintAmount);
    console.log(`✅ ${ethers.formatEther(mintAmount)} USDC mintés pour le deployer`);

    // Mint pour l'admin (pour les tests)
    await repaymentToken.mint(admin.address, mintAmount);
    console.log(`✅ ${ethers.formatEther(mintAmount)} USDC mintés pour l'admin`);
    console.log();

    console.log("📋 Résumé du déploiement :");
    console.log(`📍 Rent2Repay: ${rent2RepayAddress}`);
    console.log(`💰 RepaymentToken (USDC): ${repaymentTokenAddress}`);
    console.log(`🏦 MockRMM: ${mockRMMAddress}`);
    console.log(`👤 Admin: ${admin.address}`);
    console.log(`🚨 Emergency: ${emergency.address}`);
    console.log(`⚙️  Operator: ${operator.address}`);
    console.log();

    console.log("🎉 Déploiement terminé avec succès !");
    console.log("Le système Rent2Repay est prêt à fonctionner avec intégration RMM complète.");
}

// Gestion des erreurs
main()
    .then(() => {
        console.log("\n✨ Déploiement réussi !");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 Erreur lors du déploiement :", error);
        process.exit(1);
    }); 