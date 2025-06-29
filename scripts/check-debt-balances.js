const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Configuration des tokens - Modifier l'indice pour changer de token
const TOKEN_CONFIGS = [
    {
        name: "WXDAI",
        symbol: "WXDAI",
        decimals: 18,
        contractKey: "MockWXDAI",
        debtContractKey: "MockDebtWXDAI"
    },
    {
        name: "USDC",
        symbol: "USDC",
        decimals: 6,
        contractKey: "MockUSDC",
        debtContractKey: "MockDebtUSDC"
    }
];

// Sélectionner le token à tester (0 = WXDAI, 1 = USDC)
const SELECTED_TOKEN_INDEX = 0;
const SELECTED_TOKEN = TOKEN_CONFIGS[SELECTED_TOKEN_INDEX];

async function main() {
    console.log(`🔍 Test de remboursement avec ${SELECTED_TOKEN.name} (${SELECTED_TOKEN.decimals} decimals)\n`);

    // Charger la configuration déployée
    const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");
    if (!fs.existsSync(configPath)) {
        throw new Error("❌ Fichier de configuration non trouvé. Exécutez d'abord le script de déploiement.");
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Récupérer les signers
    const signers = await ethers.getSigners();
    const userAddress = signers[1].address; // USER à l'index 1
    const runnerAddress = signers[2].address; // RUNNER à l'index 2

    console.log("👥 Acteurs du test:");
    console.log(`   👤 Utilisateur: ${userAddress}`);
    console.log(`   🏃 Runner: ${runnerAddress}\n`);

    // Charger les contrats
    const token = await ethers.getContractAt("MockERC20", config.contracts[SELECTED_TOKEN.contractKey]);
    const debtToken = await ethers.getContractAt("MockDebtToken", config.contracts[SELECTED_TOKEN.debtContractKey]);
    const rent2Repay = await ethers.getContractAt("Rent2Repay", config.contracts.Rent2Repay);
    const mockRMM = await ethers.getContractAt("MockRMM", config.contracts.MockRMM);

    console.log("📋 Adresses des contrats:");
    console.log(`   ${SELECTED_TOKEN.name}: ${await token.getAddress()}`);
    console.log(`   Debt${SELECTED_TOKEN.name}: ${await debtToken.getAddress()}`);
    console.log(`   Rent2Repay: ${await rent2Repay.getAddress()}`);
    console.log(`   MockRMM: ${await mockRMM.getAddress()}\n`);

    // === ÉTAPE 1: Préparation des données ===
    console.log("🔧 === ÉTAPE 1: Préparation des données ===");

    // Vérifier et configurer l'adresse DAO treasury si nécessaire
    console.log("   👉 Vérification de l'adresse DAO treasury...");
    const daoConfig = await rent2Repay.getDaoFeeReductionConfiguration();
    if (daoConfig.treasuryAddress === ethers.ZeroAddress) {
        console.log("   ⚠️ Adresse DAO treasury non définie, configuration avec l'adresse #10...");
        const daoTreasuryAddress = signers[10].address;
        await rent2Repay.updateDaoTreasuryAddress(daoTreasuryAddress);
        console.log(`   ✅ Adresse DAO treasury configurée: ${daoTreasuryAddress}`);
    } else {
        console.log(`   ✅ Adresse DAO treasury déjà configurée: ${daoConfig.treasuryAddress}`);
    }

    // Mint des tokens nécessaires
    const tokenAmount = ethers.parseUnits("10000", SELECTED_TOKEN.decimals);
    const debtAmount = ethers.parseUnits("300", SELECTED_TOKEN.decimals);

    console.log(`   👉 Mint de ${tokenAmount} ${SELECTED_TOKEN.name} à l'utilisateur...`);
    await token.mint(userAddress, tokenAmount);

    console.log(`   👉 Mint de ${debtAmount} debt ${SELECTED_TOKEN.name} à l'utilisateur...`);
    await debtToken.mint(userAddress, debtAmount);

    // === ÉTAPE 2: Configuration Rent2Repay ===
    console.log("\n⚙️ === ÉTAPE 2: Configuration Rent2Repay ===");

    const weeklyLimit = ethers.parseUnits("100", SELECTED_TOKEN.decimals);
    const periodicity = 1; // 1 seconde pour le test

    // Révoquer d'abord au cas où il y aurait une configuration existante
    await rent2Repay.connect(signers[1]).revokeRent2RepayForToken(await token.getAddress());

    console.log(`   👉 Configuration limite hebdomadaire: ${weeklyLimit} wei...`);
    await rent2Repay.connect(signers[1]).configureRent2Repay(
        [await token.getAddress()],
        [weeklyLimit],
        periodicity
    );
    console.log("   ✅ Configuration Rent2Repay réussie!");

    // === ÉTAPE 3: Approbations ===
    console.log("\n🔓 === ÉTAPE 3: Vérification des approbations ===");

    const rent2RepayAddress = await rent2Repay.getAddress();
    const mockRMMAddress = await mockRMM.getAddress();

    // Approbation token -> Rent2Repay
    const currentTokenAllowance = await token.allowance(userAddress, rent2RepayAddress);
    if (currentTokenAllowance < ethers.MaxUint256) {
        await token.connect(signers[1]).approve(rent2RepayAddress, ethers.MaxUint256);
        console.log(`   ✅ Approbation maximale ${SELECTED_TOKEN.name} accordée au contrat Rent2Repay`);
    } else {
        console.log(`   ✅ Approbation ${SELECTED_TOKEN.name} déjà maximale pour Rent2Repay`);
    }

    // Approbation debtToken -> MockRMM
    const currentDebtAllowance = await debtToken.allowance(userAddress, mockRMMAddress);
    if (currentDebtAllowance < ethers.MaxUint256) {
        await debtToken.connect(signers[1]).approve(mockRMMAddress, ethers.MaxUint256);
        console.log(`   ✅ Approbation maximale debt ${SELECTED_TOKEN.name} accordée au MockRMM`);
    } else {
        console.log(`   ✅ Approbation debt ${SELECTED_TOKEN.name} déjà maximale pour MockRMM`);
    }

    // Attendre la fin de la périodicité
    await new Promise(resolve => setTimeout(resolve, periodicity * 1000));

    // === ÉTAPE 4: État AVANT remboursement ===
    console.log("\n📊 === ÉTAPE 4: État AVANT remboursement ===");

    const beforeState = {
        userTokenBalance: await token.balanceOf(userAddress),
        userDebtBalance: await debtToken.balanceOf(userAddress),
        runnerTokenBalance: await token.balanceOf(runnerAddress),
        daoTreasuryBalance: await token.balanceOf(daoConfig.treasuryAddress),
        userConfiguredAmount: (await rent2Repay.getUserConfigForToken(userAddress, await token.getAddress()))[0]
    };

    console.log("   État initial (en wei):");
    console.log(`   👤 User ${SELECTED_TOKEN.name} balance: ${beforeState.userTokenBalance}`);
    console.log(`   👤 User debt ${SELECTED_TOKEN.name} balance: ${beforeState.userDebtBalance}`);
    console.log(`   🏃 Runner ${SELECTED_TOKEN.name} balance: ${beforeState.runnerTokenBalance}`);
    console.log(`   🏦 DAO treasury ${SELECTED_TOKEN.name} balance: ${beforeState.daoTreasuryBalance}`);
    console.log(`   ⚙️ User configured amount: ${beforeState.userConfiguredAmount}`);

    // === ÉTAPE 5: Calcul de l'ATTENDU ===
    console.log("\n🎯 === ÉTAPE 5: Calcul de l'ATTENDU ===");

    // Récupérer les fees depuis le contrat
    const [daoFeesBPS, senderTipsBPS] = await rent2Repay.getFeeConfiguration();

    // Calculer le montant qui sera remboursé
    const amountToRepay = beforeState.userDebtBalance < beforeState.userConfiguredAmount
        ? beforeState.userDebtBalance
        : beforeState.userConfiguredAmount;

    // Calculer les fees
    const expectedDaoFees = (amountToRepay * daoFeesBPS) / 10000n;
    const expectedSenderTips = (amountToRepay * senderTipsBPS) / 10000n;
    const expectedTotalFees = expectedDaoFees + expectedSenderTips;
    const expectedAmountForRepayment = amountToRepay - expectedTotalFees;

    console.log("   📋 Paramètres de fees onchain:");
    console.log(`   💰 DAO fees BPS: ${daoFeesBPS}`);
    console.log(`   🎁 Sender tips BPS: ${senderTipsBPS}`);
    console.log("");
    console.log("   🎯 ATTENDU du remboursement (en wei):");
    console.log(`   💸 Montant à rembourser: ${amountToRepay}`);
    console.log(`   💰 Fees DAO attendues: ${expectedDaoFees}`);
    console.log(`   🎁 Tips runner attendues: ${expectedSenderTips}`);
    console.log(`   💰 Total des fees: ${expectedTotalFees}`);
    console.log(`   🔄 Montant net pour remboursement: ${expectedAmountForRepayment}`);
    console.log("");
    console.log("   📊 Changements attendus:");
    console.log(`   👤 User ${SELECTED_TOKEN.name}: ${beforeState.userTokenBalance} → ${beforeState.userTokenBalance - amountToRepay}`);
    console.log(`   👤 User debt ${SELECTED_TOKEN.name}: ${beforeState.userDebtBalance} → ${expectedAmountForRepayment > 0n ? beforeState.userDebtBalance - expectedAmountForRepayment : beforeState.userDebtBalance}`);
    console.log(`   🏃 Runner ${SELECTED_TOKEN.name}: ${beforeState.runnerTokenBalance} → ${beforeState.runnerTokenBalance + expectedSenderTips}`);
    console.log(`   🏦 DAO treasury ${SELECTED_TOKEN.name}: ${beforeState.daoTreasuryBalance} → ${beforeState.daoTreasuryBalance + expectedDaoFees}`);

    // === ÉTAPE 6: Exécution du remboursement ===
    console.log("\n🚀 === ÉTAPE 6: Exécution du remboursement ===");

    try {
        console.log("   👉 Exécution de rent2repay()...");
        const tx = await rent2Repay.connect(signers[2]).rent2repay(
            userAddress,
            await token.getAddress()
        );
        const receipt = await tx.wait();
        console.log(`   ✅ Transaction réussie! Hash: ${receipt.hash}`);
    } catch (error) {
        console.log("   ❌ Erreur lors du remboursement:", error.message);
        return;
    }

    // === ÉTAPE 7: État APRÈS remboursement ===
    console.log("\n📊 === ÉTAPE 7: État APRÈS remboursement ===");

    const afterState = {
        userTokenBalance: await token.balanceOf(userAddress),
        userDebtBalance: await debtToken.balanceOf(userAddress),
        runnerTokenBalance: await token.balanceOf(runnerAddress),
        daoTreasuryBalance: await token.balanceOf(daoConfig.treasuryAddress)
    };

    console.log("   État final (en wei):");
    console.log(`   👤 User ${SELECTED_TOKEN.name} balance: ${afterState.userTokenBalance}`);
    console.log(`   👤 User debt ${SELECTED_TOKEN.name} balance: ${afterState.userDebtBalance}`);
    console.log(`   🏃 Runner ${SELECTED_TOKEN.name} balance: ${afterState.runnerTokenBalance}`);
    console.log(`   🏦 DAO treasury ${SELECTED_TOKEN.name} balance: ${afterState.daoTreasuryBalance}`);

    // === ÉTAPE 8: Comparaison ATTENDU vs RÉEL ===
    console.log("\n✅ === ÉTAPE 8: Vérification ATTENDU vs RÉEL ===");

    const actualChanges = {
        userTokenChange: beforeState.userTokenBalance - afterState.userTokenBalance,
        userDebtChange: beforeState.userDebtBalance - afterState.userDebtBalance,
        runnerTokenChange: afterState.runnerTokenBalance - beforeState.runnerTokenBalance,
        daoTreasuryChange: afterState.daoTreasuryBalance - beforeState.daoTreasuryBalance
    };

    console.log("   📊 Comparaison des changements:");

    // Vérifications
    const userTokenOK = actualChanges.userTokenChange === amountToRepay;
    const userDebtOK = actualChanges.userDebtChange === expectedAmountForRepayment;
    const runnerTokenOK = actualChanges.runnerTokenChange === expectedSenderTips;
    const daoTreasuryOK = actualChanges.daoTreasuryChange === expectedDaoFees;

    console.log(`   ${userTokenOK ? '✅' : '❌'} User ${SELECTED_TOKEN.name} changement: ${actualChanges.userTokenChange} (attendu: ${amountToRepay})`);
    console.log(`   ${userDebtOK ? '✅' : '❌'} User debt changement: ${actualChanges.userDebtChange} (attendu: ${expectedAmountForRepayment})`);
    console.log(`   ${runnerTokenOK ? '✅' : '❌'} Runner ${SELECTED_TOKEN.name} changement: ${actualChanges.runnerTokenChange} (attendu: ${expectedSenderTips})`);
    console.log(`   ${daoTreasuryOK ? '✅' : '❌'} DAO treasury changement: ${actualChanges.daoTreasuryChange} (attendu: ${expectedDaoFees})`);

    const allOK = userTokenOK && userDebtOK && runnerTokenOK && daoTreasuryOK;

    console.log(`\n${allOK ? '🎉' : '⚠️'} === RÉSULTAT FINAL ===`);
    if (allOK) {
        console.log("✅ Tous les tests sont RÉUSSIS! Le remboursement fonctionne parfaitement.");
    } else {
        console.log("❌ Certains tests ont ÉCHOUÉ. Vérifiez les calculs ci-dessus.");
    }

    console.log(`📊 Token testé: ${SELECTED_TOKEN.name} (${SELECTED_TOKEN.decimals} decimals)`);
    console.log(`💰 Montant remboursé: ${amountToRepay} wei`);
    console.log(`💸 Total des fees: ${expectedTotalFees} wei`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }); 