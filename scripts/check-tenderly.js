const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 Vérification du déploiement Tenderly");
    console.log("=".repeat(50));

    // Charger les informations de déploiement
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(fs.readFileSync("scripts/tmp/deployed-gnosis.json", "utf8"));
    } catch (error) {
        console.log("❌ Fichier deployed-gnosis.json non trouvé");
        console.log("Exécutez d'abord: npm run deploy:tenderly");
        process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    console.log(`👤 Signeur: ${signer.address}`);

    // Vérifier le réseau
    const network = await signer.provider.getNetwork();
    console.log(`🌐 Réseau: ${network.name} (${network.chainId})`);

    // Récupérer le contrat
    const rent2Repay = await ethers.getContractAt("Rent2Repay", deploymentInfo.rent2RepayAddress);
    console.log(`📦 Contrat: ${deploymentInfo.rent2RepayAddress}`);

    // Vérifications de base
    console.log("\n🔍 Vérifications de base...");

    // 1. Vérifier les rôles
    const adminRole = await rent2Repay.ADMIN_ROLE();
    const emergencyRole = await rent2Repay.EMERGENCY_ROLE();
    const operatorRole = await rent2Repay.OPERATOR_ROLE();

    const isAdmin = await rent2Repay.hasRole(adminRole, deploymentInfo.adminAddress);
    const isEmergency = await rent2Repay.hasRole(emergencyRole, deploymentInfo.emergencyAddress);
    const isOperator = await rent2Repay.hasRole(operatorRole, deploymentInfo.operatorAddress);

    console.log(`✅ Admin role: ${isAdmin}`);
    console.log(`✅ Emergency role: ${isEmergency}`);
    console.log(`✅ Operator role: ${isOperator}`);

    // 2. Vérifier la configuration RMM
    const rmm = await rent2Repay.rmm();
    console.log(`✅ RMM: ${rmm}`);

    // 3. Vérifier les tokens configurés
    const wxdaiConfig = await rent2Repay.tokenConfig(deploymentInfo.wxdaiToken);
    const usdcConfig = await rent2Repay.tokenConfig(deploymentInfo.usdcToken);

    console.log(`✅ WXDAI configuré: ${wxdaiConfig.active}`);
    console.log(`✅ USDC configuré: ${usdcConfig.active}`);

    // 4. Vérifier les fees
    const [daoFees, senderTips] = await rent2Repay.getFeeConfiguration();
    console.log(`✅ DAO fees: ${daoFees} BPS`);
    console.log(`✅ Sender tips: ${senderTips} BPS`);

    // 5. Vérifier le trésor DAO
    const treasury = await rent2Repay.daoTreasuryAddress();
    console.log(`✅ Treasury: ${treasury}`);

    // 6. Vérifier les tokens actifs
    const activeTokens = await rent2Repay.getActiveTokens();
    console.log(`✅ Tokens actifs: ${activeTokens.length}`);

    // Tests de fonctionnalité
    console.log("\n🧪 Tests de fonctionnalité...");

    // Test 1: Vérifier que le contrat n'est pas en pause
    const isPaused = await rent2Repay.paused();
    console.log(`✅ Contrat non en pause: ${!isPaused}`);

    // Test 2: Vérifier les rôles du signeur actuel
    const signerIsAdmin = await rent2Repay.hasRole(adminRole, signer.address);
    const signerIsEmergency = await rent2Repay.hasRole(emergencyRole, signer.address);
    const signerIsOperator = await rent2Repay.hasRole(operatorRole, signer.address);

    console.log(`👤 Signeur est admin: ${signerIsAdmin}`);
    console.log(`👤 Signeur est emergency: ${signerIsEmergency}`);
    console.log(`👤 Signeur est operator: ${signerIsOperator}`);

    // Test 3: Vérifier la version
    const version = await rent2Repay.version();
    console.log(`✅ Version: ${version}`);

    // Résumé
    console.log("\n" + "=".repeat(50));
    console.log("📊 RÉSUMÉ DE LA VÉRIFICATION");
    console.log("=".repeat(50));
    console.log(`📍 Contrat: ${deploymentInfo.rent2RepayAddress}`);
    console.log(`🌐 Réseau: ${network.name} (${network.chainId})`);
    console.log(`💰 RMM: ${rmm}`);
    console.log(`🏛️  Admin: ${deploymentInfo.adminAddress} (${isAdmin ? "✅" : "❌"})`);
    console.log(`🚨 Emergency: ${deploymentInfo.emergencyAddress} (${isEmergency ? "✅" : "❌"})`);
    console.log(`⚙️  Operator: ${deploymentInfo.operatorAddress} (${isOperator ? "✅" : "❌"})`);
    console.log(`💼 Treasury: ${treasury}`);
    console.log(`🎫 Tokens actifs: ${activeTokens.length}`);
    console.log(`⏸️  Pause: ${isPaused ? "Oui" : "Non"}`);
    console.log(`📦 Version: ${version}`);

    // Liens utiles
    console.log("\n🔗 Liens utiles:");
    console.log(`   📊 Explorer: https://gnosisscan.io/address/${deploymentInfo.rent2RepayAddress}`);
    console.log(`   🧪 Tenderly: https://dashboard.tenderly.co/battistu/rent2repay/infrastructure`);
    console.log("=".repeat(50));

    // Vérifications critiques
    if (!isAdmin || !isEmergency || !isOperator) {
        console.log("\n⚠️  ATTENTION: Certains rôles ne sont pas correctement configurés!");
    }

    if (isPaused) {
        console.log("\n⚠️  ATTENTION: Le contrat est en pause!");
    }

    if (activeTokens.length === 0) {
        console.log("\n⚠️  ATTENTION: Aucun token actif configuré!");
    }

    console.log("\n✅ Vérification terminée!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Erreur lors de la vérification:", error);
        process.exit(1);
    }); 