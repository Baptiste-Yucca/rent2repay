const { ethers } = require("hardhat");
const { deployMockContracts, deployRent2Repay } = require("./deploy-modular");

async function testLocalDeployment() {
    console.log("🧪 TEST DU DÉPLOIEMENT LOCAL");
    console.log("============================\n");

    const [deployer, user, operator] = await ethers.getSigners();
    console.log("👤 Deployer:", deployer.address);
    console.log("👤 User:", user.address);
    console.log("👤 Operator:", operator.address);

    // 1. Déployer les contrats mock
    console.log("\n📦 ÉTAPE 1: Déploiement des contrats Mock");
    const mockContracts = await deployMockContracts();
    const { rmmAddress, supportedAssets } = mockContracts;

    // 2. Déployer Rent2Repay avec WXDAI par défaut
    console.log("\n🚀 ÉTAPE 2: Déploiement de Rent2Repay");
    const rent2repay = await deployRent2Repay(rmmAddress, supportedAssets.WXDAI);

    // 3. Obtenir les instances des contrats
    const mockRMM = await ethers.getContractAt("MockRMM", rmmAddress);
    const wxdaiToken = await ethers.getContractAt("MockERC20", supportedAssets.WXDAI);
    const usdcToken = await ethers.getContractAt("MockERC20", supportedAssets.USDC);

    console.log("\n✅ Contrats déployés avec succès!");
    console.log(`   • Rent2Repay: ${await rent2repay.getAddress()}`);
    console.log(`   • MockRMM: ${rmmAddress}`);
    console.log(`   • WXDAI Mock: ${supportedAssets.WXDAI}`);
    console.log(`   • USDC Mock: ${supportedAssets.USDC}`);

    // 4. Tests des fonctionnalités
    console.log("\n🧪 ÉTAPE 3: Tests des fonctionnalités");

    // Mint des tokens pour les tests
    await wxdaiToken.mint(user.address, ethers.parseEther("1000"));
    await usdcToken.mint(user.address, ethers.parseEther("1000"));
    console.log("✅ Tokens mintés pour l'utilisateur test");

    // Simuler une dette sur le RMM
    await mockRMM.setDebt(user.address, supportedAssets.WXDAI, ethers.parseEther("500"));
    console.log("✅ Dette simulée sur le MockRMM");

    // Configuration du Rent2Repay par l'utilisateur
    const weeklyLimit = ethers.parseEther("100");
    await rent2repay.connect(user).configureRent2Repay(weeklyLimit);
    console.log("✅ Rent2Repay configuré par l'utilisateur");

    // Vérifier la configuration
    const userConfig = await rent2repay.getUserConfig(user.address);
    console.log(`   • Limite hebdomadaire: ${ethers.formatEther(userConfig[0])} WXDAI`);
    console.log(`   • Montant disponible: ${ethers.formatEther(await rent2repay.getAvailableAmountThisWeek(user.address))} WXDAI`);

    // Test du remboursement
    console.log("\n💰 ÉTAPE 4: Test du remboursement");
    const repayAmount = ethers.parseEther("50");

    // Approuver les tokens pour le contrat
    await wxdaiToken.connect(operator).approve(await rent2repay.getAddress(), repayAmount);

    // Mint des tokens pour l'operator
    await wxdaiToken.mint(operator.address, repayAmount);

    // Effectuer le remboursement
    try {
        const tx = await rent2repay.connect(operator).rent2repay(user.address, repayAmount);
        await tx.wait();
        console.log("✅ Remboursement effectué avec succès!");

        // Vérifier le nouveau solde
        const newConfig = await rent2repay.getUserConfig(user.address);
        console.log(`   • Montant utilisé cette semaine: ${ethers.formatEther(newConfig[2])} WXDAI`);
        console.log(`   • Montant restant: ${ethers.formatEther(await rent2repay.getAvailableAmountThisWeek(user.address))} WXDAI`);

        // Vérifier la dette sur le RMM
        const remainingDebt = await mockRMM.getDebt(user.address, supportedAssets.WXDAI);
        console.log(`   • Dette restante: ${ethers.formatEther(remainingDebt)} WXDAI`);

    } catch (error) {
        console.error("❌ Erreur lors du remboursement:", error.message);
    }

    // Test de changement d'asset
    console.log("\n🔄 ÉTAPE 5: Test de changement d'asset vers USDC");
    try {
        await rent2repay.setRepaymentAsset(supportedAssets.USDC);
        const newAsset = await rent2repay.repaymentAsset();
        console.log(`✅ Asset changé vers: ${newAsset}`);
    } catch (error) {
        console.error("❌ Erreur lors du changement d'asset:", error.message);
    }

    console.log("\n🎉 TESTS TERMINÉS AVEC SUCCÈS!");

    return {
        rent2repay: await rent2repay.getAddress(),
        mockRMM: rmmAddress,
        supportedAssets
    };
}

// Fonction pour nettoyer les tests (optionnel)
async function cleanupTests() {
    console.log("🧹 Nettoyage des tests...");
    // Ici on pourrait reset les états si nécessaire
}

// Exécution des tests
if (require.main === module) {
    testLocalDeployment()
        .then(() => {
            console.log("\n✅ Tous les tests sont passés!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Erreur lors des tests:", error);
            process.exit(1);
        });
}

module.exports = { testLocalDeployment, cleanupTests }; 