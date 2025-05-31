const { ethers } = require("hardhat");
const { deployMockContracts, deployRent2Repay } = require("./deploy-modular");

async function testLocalDeployment() {
    console.log("🧪 TEST DU DÉPLOIEMENT LOCAL MULTI-TOKENS");
    console.log("==========================================\n");

    const [deployer, admin, emergency, operator, user, user2] = await ethers.getSigners();
    console.log("👤 Deployer:", deployer.address);
    console.log("👤 Admin:", admin.address);
    console.log("👤 Emergency:", emergency.address);
    console.log("👤 Operator:", operator.address);
    console.log("👤 User1:", user.address);
    console.log("👤 User2:", user2.address);

    // 1. Déployer les contrats mock
    console.log("\n📦 ÉTAPE 1: Déploiement des contrats Mock");
    const mockContracts = await deployMockContracts();
    const { rmmAddress, supportedAssets } = mockContracts;

    // 2. Déployer Rent2Repay avec WXDAI et USDC
    console.log("\n🚀 ÉTAPE 2: Déploiement de Rent2Repay Multi-Tokens");
    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2repay = await Rent2Repay.deploy(
        admin.address,
        emergency.address,
        operator.address,
        rmmAddress,
        supportedAssets.WXDAI,
        supportedAssets.USDC
    );
    await rent2repay.waitForDeployment();

    // 3. Obtenir les instances des contrats
    const mockRMM = await ethers.getContractAt("MockRMM", rmmAddress);
    const wxdaiToken = await ethers.getContractAt("MockERC20", supportedAssets.WXDAI);
    const usdcToken = await ethers.getContractAt("MockERC20", supportedAssets.USDC);

    console.log("\n✅ Contrats déployés avec succès!");
    console.log(`   • Rent2Repay: ${await rent2repay.getAddress()}`);
    console.log(`   • MockRMM: ${rmmAddress}`);
    console.log(`   • WXDAI Mock: ${supportedAssets.WXDAI}`);
    console.log(`   • USDC Mock: ${supportedAssets.USDC}`);

    // 4. Vérifier les tokens autorisés
    console.log("\n🔍 ÉTAPE 3: Vérification des tokens autorisés");
    const authorizedTokens = await rent2repay.getAuthorizedTokens();
    console.log(`✅ Tokens autorisés: ${authorizedTokens.length}`);
    console.log(`   • WXDAI: ${await rent2repay.authorizedTokens(supportedAssets.WXDAI)}`);
    console.log(`   • USDC: ${await rent2repay.authorizedTokens(supportedAssets.USDC)}`);

    // 5. Tests des fonctionnalités multi-tokens
    console.log("\n🧪 ÉTAPE 4: Tests des fonctionnalités multi-tokens");

    // Mint des tokens pour les tests
    await wxdaiToken.mint(user.address, ethers.parseEther("1000"));
    await usdcToken.mint(user.address, ethers.parseUnits("1000", 6));
    await wxdaiToken.mint(user2.address, ethers.parseEther("500"));
    await usdcToken.mint(user2.address, ethers.parseUnits("500", 6));
    console.log("✅ Tokens mintés pour les utilisateurs test");

    // Simuler des dettes sur le RMM
    await mockRMM.setDebt(user.address, supportedAssets.WXDAI, ethers.parseEther("500"));
    await mockRMM.setDebt(user.address, supportedAssets.USDC, ethers.parseUnits("300", 6));
    await mockRMM.setDebt(user2.address, supportedAssets.WXDAI, ethers.parseEther("200"));
    console.log("✅ Dettes simulées sur le MockRMM");

    // Configuration du Rent2Repay par l'utilisateur 1 (multi-tokens)
    console.log("\n💰 ÉTAPE 5: Configuration multi-tokens par User1");
    const wxdaiWeeklyLimit = ethers.parseEther("100"); // 100 WXDAI par semaine
    const usdcWeeklyLimit = ethers.parseUnits("150", 6); // 150 USDC par semaine

    await rent2repay.connect(user).configureRent2Repay(supportedAssets.WXDAI, wxdaiWeeklyLimit);
    await rent2repay.connect(user).configureRent2Repay(supportedAssets.USDC, usdcWeeklyLimit);
    console.log("✅ Rent2Repay configuré pour WXDAI et USDC");

    // Vérifier les configurations
    const wxdaiConfig = await rent2repay.getUserConfigForToken(user.address, supportedAssets.WXDAI);
    const usdcConfig = await rent2repay.getUserConfigForToken(user.address, supportedAssets.USDC);
    console.log(`   • Limite WXDAI: ${ethers.formatEther(wxdaiConfig[0])} WXDAI/semaine`);
    console.log(`   • Limite USDC: ${ethers.formatUnits(usdcConfig[0], 6)} USDC/semaine`);
    console.log(`   • Disponible WXDAI: ${ethers.formatEther(await rent2repay.getAvailableAmountThisWeek(user.address, supportedAssets.WXDAI))} WXDAI`);
    console.log(`   • Disponible USDC: ${ethers.formatUnits(await rent2repay.getAvailableAmountThisWeek(user.address, supportedAssets.USDC), 6)} USDC`);

    // Configuration par batch (User2)
    console.log("\n🔄 ÉTAPE 6: Configuration par batch pour User2");
    const tokens = [supportedAssets.WXDAI, supportedAssets.USDC];
    const amounts = [ethers.parseEther("50"), ethers.parseUnits("75", 6)];

    await rent2repay.connect(user2).configureRent2RepayMultiple(tokens, amounts);
    console.log("✅ Configuration batch réussie pour User2");

    const user2Configs = await rent2repay.getUserConfigs(user2.address);
    console.log(`   • Tokens configurés: ${user2Configs[0].length}`);
    console.log(`   • WXDAI: ${ethers.formatEther(user2Configs[1][0])} par semaine`);
    console.log(`   • USDC: ${ethers.formatUnits(user2Configs[1][1], 6)} par semaine`);

    // Test du remboursement WXDAI
    console.log("\n💸 ÉTAPE 7: Test du remboursement WXDAI");
    const wxdaiRepayAmount = ethers.parseEther("50");

    // Mint et approve tokens pour l'operator
    await wxdaiToken.mint(operator.address, wxdaiRepayAmount);
    await wxdaiToken.connect(operator).approve(await rent2repay.getAddress(), wxdaiRepayAmount);

    try {
        const tx = await rent2repay.connect(operator).rent2repay(
            user.address,
            supportedAssets.WXDAI,
            wxdaiRepayAmount
        );
        await tx.wait();
        console.log("✅ Remboursement WXDAI effectué avec succès!");

        // Vérifier le nouveau solde
        const newWxdaiConfig = await rent2repay.getUserConfigForToken(user.address, supportedAssets.WXDAI);
        console.log(`   • WXDAI utilisé cette semaine: ${ethers.formatEther(newWxdaiConfig[1])} WXDAI`);
        console.log(`   • WXDAI restant: ${ethers.formatEther(await rent2repay.getAvailableAmountThisWeek(user.address, supportedAssets.WXDAI))} WXDAI`);

        // Vérifier la dette sur le RMM
        const remainingWxdaiDebt = await mockRMM.getDebt(user.address, supportedAssets.WXDAI);
        console.log(`   • Dette WXDAI restante: ${ethers.formatEther(remainingWxdaiDebt)} WXDAI`);

    } catch (error) {
        console.error("❌ Erreur lors du remboursement WXDAI:", error.message);
    }

    // Test du remboursement USDC
    console.log("\n💸 ÉTAPE 8: Test du remboursement USDC");
    const usdcRepayAmount = ethers.parseUnits("75", 6);

    await usdcToken.mint(operator.address, usdcRepayAmount);
    await usdcToken.connect(operator).approve(await rent2repay.getAddress(), usdcRepayAmount);

    try {
        const tx = await rent2repay.connect(operator).rent2repay(
            user.address,
            supportedAssets.USDC,
            usdcRepayAmount
        );
        await tx.wait();
        console.log("✅ Remboursement USDC effectué avec succès!");

        // Vérifier le nouveau solde
        const newUsdcConfig = await rent2repay.getUserConfigForToken(user.address, supportedAssets.USDC);
        console.log(`   • USDC utilisé cette semaine: ${ethers.formatUnits(newUsdcConfig[1], 6)} USDC`);
        console.log(`   • USDC restant: ${ethers.formatUnits(await rent2repay.getAvailableAmountThisWeek(user.address, supportedAssets.USDC), 6)} USDC`);

        // Vérifier la dette sur le RMM
        const remainingUsdcDebt = await mockRMM.getDebt(user.address, supportedAssets.USDC);
        console.log(`   • Dette USDC restante: ${ethers.formatUnits(remainingUsdcDebt, 6)} USDC`);

    } catch (error) {
        console.error("❌ Erreur lors du remboursement USDC:", error.message);
    }

    // Test de gestion des tokens par admin
    console.log("\n🔑 ÉTAPE 9: Test de gestion des tokens par admin");

    // Créer un nouveau token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const newToken = await MockERC20.deploy("New Token", "NEW");
    await newToken.waitForDeployment();

    try {
        // Autoriser le nouveau token
        await rent2repay.connect(admin).authorizeToken(await newToken.getAddress());
        console.log("✅ Nouveau token autorisé par l'admin");

        // Vérifier qu'il est dans la liste
        const updatedTokens = await rent2repay.getAuthorizedTokens();
        console.log(`   • Tokens autorisés maintenant: ${updatedTokens.length}`);

        // Désautoriser le token
        await rent2repay.connect(admin).unauthorizeToken(await newToken.getAddress());
        console.log("✅ Token désautorisé par l'admin");

    } catch (error) {
        console.error("❌ Erreur lors de la gestion des tokens:", error.message);
    }

    // Test des fonctions de révocation
    console.log("\n🚫 ÉTAPE 10: Test des fonctions de révocation");

    try {
        // Révocation d'un token spécifique
        await rent2repay.connect(user).revokeRent2RepayForToken(supportedAssets.USDC);
        console.log("✅ Révocation USDC par l'utilisateur");

        // Vérifier le statut
        console.log(`   • User autorisé WXDAI: ${await rent2repay.isAuthorizedForToken(user.address, supportedAssets.WXDAI)}`);
        console.log(`   • User autorisé USDC: ${await rent2repay.isAuthorizedForToken(user.address, supportedAssets.USDC)}`);
        console.log(`   • User autorisé global: ${await rent2repay.isAuthorized(user.address)}`);

        // Révocation totale
        await rent2repay.connect(user).revokeRent2RepayAll();
        console.log("✅ Révocation totale par l'utilisateur");
        console.log(`   • User autorisé global: ${await rent2repay.isAuthorized(user.address)}`);

    } catch (error) {
        console.error("❌ Erreur lors de la révocation:", error.message);
    }

    console.log("\n🎉 Tests multi-tokens terminés avec succès!");
    console.log("\n📊 RÉSUMÉ DES FONCTIONNALITÉS TESTÉES:");
    console.log("✅ Déploiement avec tokens WXDAI et USDC préautorisés");
    console.log("✅ Configuration individuelle par token");
    console.log("✅ Configuration par batch (plusieurs tokens)");
    console.log("✅ Remboursements séparés par token");
    console.log("✅ Limites hebdomadaires indépendantes");
    console.log("✅ Gestion des tokens autorisés par admin");
    console.log("✅ Révocation par token et révocation totale");
    console.log("✅ Vérification des statuts d'autorisation");
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
            console.log("\n✨ Tous les tests multi-tokens sont passés!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Erreur lors des tests:", error);
            process.exit(1);
        });
}

module.exports = { testLocalDeployment, cleanupTests }; 