const { ethers } = require("hardhat");

async function demonstrateMultiTokenApproach() {
    console.log("🚀 DÉMONSTRATION: APPROCHE MULTI-TOKENS RENT2REPAY");
    console.log("==================================================\n");

    const [admin, emergency, operator, alice, bob] = await ethers.getSigners();

    // Déployer les tokens de test
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const wxdai = await MockERC20.deploy("Wrapped XDAI", "WXDAI");
    const usdc = await MockERC20.deploy("USD Coin", "USDC");
    await wxdai.waitForDeployment();
    await usdc.waitForDeployment();

    // Déployer le MockRMM
    const MockRMM = await ethers.getContractFactory("MockRMM");
    const mockRMM = await MockRMM.deploy();
    await mockRMM.waitForDeployment();

    // Déployer Rent2Repay avec multi-tokens
    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2repay = await Rent2Repay.deploy(
        admin.address,
        emergency.address,
        operator.address,
        await mockRMM.getAddress(),
        await wxdai.getAddress(),
        await usdc.getAddress()
    );
    await rent2repay.waitForDeployment();

    console.log("📋 CONTRATS DÉPLOYÉS:");
    console.log(`   • Rent2Repay: ${await rent2repay.getAddress()}`);
    console.log(`   • WXDAI Token: ${await wxdai.getAddress()}`);
    console.log(`   • USDC Token: ${await usdc.getAddress()}\n`);

    // Configuration des tokens par les utilisateurs
    console.log("👥 CONFIGURATION DES UTILISATEURS:");

    // Alice configure 100 WXDAI et 200 USDC par semaine
    await rent2repay.connect(alice).configureRent2Repay([await wxdai.getAddress()], [ethers.parseEther("100")]);
    await rent2repay.connect(alice).configureRent2Repay([await usdc.getAddress()], [ethers.parseUnits("200", 6)]);
    console.log("✅ Alice: 100 WXDAI + 200 USDC par semaine");

    // Bob utilise la configuration batch: 50 WXDAI et 75 USDC
    const tokens = [await wxdai.getAddress(), await usdc.getAddress()];
    const amounts = [ethers.parseEther("50"), ethers.parseUnits("75", 6)];
    await rent2repay.connect(bob).configureRent2Repay(tokens, amounts);
    console.log("✅ Bob: 50 WXDAI + 75 USDC par semaine (config batch)\n");

    // Simulation de remboursements
    console.log("💰 SIMULATION DES REMBOURSEMENTS:");

    // Mint tokens pour les tests
    await wxdai.mint(operator.address, ethers.parseEther("1000"));
    await usdc.mint(operator.address, ethers.parseUnits("1000", 6));

    // Simuler des dettes
    await mockRMM.setDebt(alice.address, await wxdai.getAddress(), ethers.parseEther("500"));
    await mockRMM.setDebt(alice.address, await usdc.getAddress(), ethers.parseUnits("300", 6));

    // Remboursement WXDAI pour Alice
    await wxdai.connect(operator).approve(await rent2repay.getAddress(), ethers.parseEther("60"));
    await rent2repay.connect(operator).rent2repay(alice.address, await wxdai.getAddress(), ethers.parseEther("60"));
    console.log("✅ Alice: 60 WXDAI remboursés (reste 40 WXDAI disponible cette semaine)");

    // Remboursement USDC pour Alice
    await usdc.connect(operator).approve(await rent2repay.getAddress(), ethers.parseUnits("150", 6));
    await rent2repay.connect(operator).rent2repay(alice.address, await usdc.getAddress(), ethers.parseUnits("150", 6));
    console.log("✅ Alice: 150 USDC remboursés (reste 50 USDC disponible cette semaine)\n");

    // Vérification des limites séparées
    console.log("📊 VÉRIFICATION DES LIMITES SÉPARÉES:");
    const aliceWxdaiAvailable = await rent2repay.getAvailableAmountThisWeek(alice.address, await wxdai.getAddress());
    const aliceUsdcAvailable = await rent2repay.getAvailableAmountThisWeek(alice.address, await usdc.getAddress());

    console.log(`   • Alice WXDAI restant: ${ethers.formatEther(aliceWxdaiAvailable)} WXDAI`);
    console.log(`   • Alice USDC restant: ${ethers.formatUnits(aliceUsdcAvailable, 6)} USDC`);

    const bobWxdaiAvailable = await rent2repay.getAvailableAmountThisWeek(bob.address, await wxdai.getAddress());
    const bobUsdcAvailable = await rent2repay.getAvailableAmountThisWeek(bob.address, await usdc.getAddress());

    console.log(`   • Bob WXDAI disponible: ${ethers.formatEther(bobWxdaiAvailable)} WXDAI`);
    console.log(`   • Bob USDC disponible: ${ethers.formatUnits(bobUsdcAvailable, 6)} USDC\n`);

    // Démonstration de la révocation granulaire
    console.log("🚫 RÉVOCATION GRANULAIRE:");

    // Alice révoque seulement USDC
    await rent2repay.connect(alice).revokeRent2RepayForToken(await usdc.getAddress());
    console.log("✅ Alice révoque USDC (garde WXDAI)");

    console.log(`   • Alice autorisée WXDAI: ${await rent2repay.isAuthorizedForToken(alice.address, await wxdai.getAddress())}`);
    console.log(`   • Alice autorisée USDC: ${await rent2repay.isAuthorizedForToken(alice.address, await usdc.getAddress())}`);
    console.log(`   • Alice autorisée globalement: ${await rent2repay.isAuthorized(alice.address)}\n`);

    // Gestion des tokens par l'admin
    console.log("🔑 GESTION DES TOKENS PAR ADMIN:");

    // Créer un nouveau token
    const daiToken = await MockERC20.deploy("DAI Stablecoin", "DAI");
    await daiToken.waitForDeployment();

    // L'admin autorise le nouveau token
    await rent2repay.connect(admin).authorizeToken(await daiToken.getAddress());
    console.log("✅ Admin autorise DAI");

    // Vérifier la liste des tokens autorisés
    const authorizedTokens = await rent2repay.getAuthorizedTokens();
    console.log(`   • Tokens autorisés: ${authorizedTokens.length} (WXDAI, USDC, DAI)\n`);

    console.log("🎯 AVANTAGES DE L'APPROCHE MULTI-TOKENS:");
    console.log("==========================================");
    console.log("✅ Limites indépendantes par token (pas de conversion USD)");
    console.log("✅ Gestion native des décimales (WXDAI: 18, USDC: 6)");
    console.log("✅ Configuration flexible (individuelle ou batch)");
    console.log("✅ Révocation granulaire par token");
    console.log("✅ Extensibilité (ajout facile de nouveaux tokens)");
    console.log("✅ Pas de dépendance aux oracles de prix");
    console.log("✅ Gas optimisé (pas de calculs de conversion)");
    console.log("✅ Simplicité d'implémentation et de maintenance\n");

    console.log("🚀 DÉMONSTRATION TERMINÉE AVEC SUCCÈS!");
}

// Exécution de la démonstration
if (require.main === module) {
    demonstrateMultiTokenApproach()
        .then(() => {
            console.log("\n✨ Démonstration multi-tokens réussie!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Erreur lors de la démonstration:", error);
            process.exit(1);
        });
}

module.exports = { demonstrateMultiTokenApproach }; 