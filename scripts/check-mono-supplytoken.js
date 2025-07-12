const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Configuration des supply tokens - armmWXDAI et armmUSDC
const SUPPLY_TOKEN_CONFIGS = [
    {
        name: "armmWXDAI",
        baseToken: "WXDAI",
        symbol: "armmWXDAI",
        decimals: 18,
        baseContractKey: "MockWXDAI",
        supplyContractKey: "armmWXDAI",
        debtContractKey: "MockDebtWXDAI"
    },
    {
        name: "armmUSDC",
        baseToken: "USDC",
        symbol: "armmUSDC",
        decimals: 6,
        baseContractKey: "MockUSDC",
        supplyContractKey: "armmUSDC",
        debtContractKey: "MockDebtUSDC"
    }
];

// Sélectionner le supply token à tester (0 = armmWXDAI, 1 = armmUSDC)
const SELECTED_TOKEN_INDEX = 0;
const SELECTED_TOKEN = SUPPLY_TOKEN_CONFIGS[SELECTED_TOKEN_INDEX];

async function main() {
    console.log(`🔍 Test de remboursement via supply token ${SELECTED_TOKEN.name} (${SELECTED_TOKEN.decimals} decimals)\n`);

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
    const baseToken = await ethers.getContractAt("MockERC20", config.contracts[SELECTED_TOKEN.baseContractKey]);
    const supplyToken = await ethers.getContractAt("MockERC20", config.contracts[SELECTED_TOKEN.supplyContractKey]);
    const rent2Repay = await ethers.getContractAt("Rent2Repay", config.contracts.Rent2Repay);
    const mockRMM = await ethers.getContractAt("MockRMM", config.contracts.MockRMM);

    // Récupérer la configuration du token depuis Rent2Repay
    let tokenConfig;
    let debtToken;
    try {
        // Essayer d'abord avec le supply token
        const [tokenAddress, debtTokenAddress, supplyTokenAddress, active] = await rent2Repay.getTokenConfig(await supplyToken.getAddress());
        if (supplyTokenAddress === ethers.ZeroAddress) {
            throw new Error("Supply token not configured");
        }
        tokenConfig = {
            token: tokenAddress,
            debtToken: debtTokenAddress,
            supplyToken: supplyTokenAddress,
            active: active
        };
        debtToken = await ethers.getContractAt("MockDebtToken", tokenConfig.debtToken);
    } catch (error) {
        console.log("   ⚠️ Supply token non configuré dans le système, tentative de configuration...");

        // Essayer de configurer le supply token
        try {
            const debtTokenAddress = config.contracts[SELECTED_TOKEN.debtContractKey];
            const supplyTokenAddress = config.contracts[SELECTED_TOKEN.supplyContractKey];

            console.log(`   👉 Configuration du trio: ${await baseToken.getAddress()} / ${debtTokenAddress} / ${supplyTokenAddress}`);

            // Configurer le token triple (base, debt, supply)
            await rent2Repay.authorizeTokenTriple(
                await baseToken.getAddress(),
                debtTokenAddress,
                supplyTokenAddress
            );

            console.log("   ✅ Token triple configuré avec succès");

            // Récupérer la configuration mise à jour
            try {
                const [tokenAddress, debtTokenAddress, supplyTokenAddress, active] = await rent2Repay.getTokenConfig(await supplyToken.getAddress());
                tokenConfig = {
                    token: tokenAddress,
                    debtToken: debtTokenAddress,
                    supplyToken: supplyTokenAddress,
                    active: active
                };
                debtToken = await ethers.getContractAt("MockDebtToken", tokenConfig.debtToken);
            } catch (getConfigError) {
                // Si ça ne marche toujours pas, utiliser la configuration manuelle
                console.log("   ⚠️ Utilisation de la configuration manuelle...");
                tokenConfig = {
                    token: await baseToken.getAddress(),
                    debtToken: config.contracts[SELECTED_TOKEN.debtContractKey],
                    supplyToken: config.contracts[SELECTED_TOKEN.supplyContractKey],
                    active: true
                };
                debtToken = await ethers.getContractAt("MockDebtToken", tokenConfig.debtToken);
            }
        } catch (configError) {
            console.log("   ❌ Échec de la configuration du supply token:", configError.message);
            return;
        }
    }

    console.log("📋 Adresses des contrats:");
    console.log(`   ${SELECTED_TOKEN.baseToken} (base): ${await baseToken.getAddress()}`);
    console.log(`   ${SELECTED_TOKEN.name} (supply): ${await supplyToken.getAddress()}`);
    console.log(`   Debt${SELECTED_TOKEN.baseToken}: ${tokenConfig.debtToken}`);
    console.log(`   Supply token configuré: ${tokenConfig.supplyToken}`);
    console.log(`   Token Active: ${tokenConfig.active}`);
    console.log(`   Rent2Repay: ${await rent2Repay.getAddress()}`);
    console.log(`   MockRMM: ${await mockRMM.getAddress()}\n`);

    // Vérifier que le supply token configuré correspond au contrat chargé
    if (tokenConfig.supplyToken !== await supplyToken.getAddress()) {
        console.log("❌ Supply token configuré ne correspond pas au contrat chargé");
        return;
    }

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
    const supplyTokenAmount = ethers.parseUnits("10000", SELECTED_TOKEN.decimals);
    const debtAmount = ethers.parseUnits("300", SELECTED_TOKEN.decimals);

    console.log(`   👉 Mint de ${ethers.formatUnits(supplyTokenAmount, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${supplyTokenAmount} Wei) à l'utilisateur...`);
    await supplyToken.mint(userAddress, supplyTokenAmount);

    console.log(`   👉 Mint de ${ethers.formatUnits(debtAmount, SELECTED_TOKEN.decimals)} debt ${SELECTED_TOKEN.baseToken} (${debtAmount} Wei) à l'utilisateur...`);
    await debtToken.mint(userAddress, debtAmount);

    // === ÉTAPE 2: Configuration Rent2Repay ===
    console.log("\n⚙️ === ÉTAPE 2: Configuration Rent2Repay ===");

    const weeklyLimit = ethers.parseUnits("100", SELECTED_TOKEN.decimals);
    const periodicity = 1; // 1 seconde pour le test

    // Révoquer d'abord au cas où il y aurait une configuration existante
    try {
        await rent2Repay.connect(signers[1]).revokeRent2RepayAll();
        console.log("   ⚠️ Configuration existante révoquée");
    } catch (error) {
        // Si pas de configuration existante, on continue
        console.log("   ✅ Aucune configuration existante à révoquer");
    }

    console.log(`   👉 Configuration limite hebdomadaire: ${ethers.formatUnits(weeklyLimit, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${weeklyLimit} Wei)...`);
    await rent2Repay.connect(signers[1]).configureRent2Repay(
        [await supplyToken.getAddress()],
        [weeklyLimit],
        periodicity,
        Math.floor(Date.now() / 1000) // timestamp actuel
    );
    console.log("   ✅ Configuration Rent2Repay réussie!");

    // === ÉTAPE 3: Approbations ===
    console.log("\n🔓 === ÉTAPE 3: Vérification des approbations ===");

    const rent2RepayAddress = await rent2Repay.getAddress();
    const mockRMMAddress = await mockRMM.getAddress();

    // Approbation supplyToken -> Rent2Repay
    const currentSupplyAllowance = await supplyToken.allowance(userAddress, rent2RepayAddress);
    if (currentSupplyAllowance < ethers.MaxUint256) {
        await supplyToken.connect(signers[1]).approve(rent2RepayAddress, ethers.MaxUint256);
        console.log(`   ✅ Approbation maximale ${SELECTED_TOKEN.name} accordée au contrat Rent2Repay`);
    } else {
        console.log(`   ✅ Approbation ${SELECTED_TOKEN.name} déjà maximale pour Rent2Repay`);
    }

    // Approbation debtToken -> MockRMM
    const currentDebtAllowance = await debtToken.allowance(userAddress, mockRMMAddress);
    if (currentDebtAllowance < ethers.MaxUint256) {
        await debtToken.connect(signers[1]).approve(mockRMMAddress, ethers.MaxUint256);
        console.log(`   ✅ Approbation maximale debt ${SELECTED_TOKEN.baseToken} accordée au MockRMM`);
    } else {
        console.log(`   ✅ Approbation debt ${SELECTED_TOKEN.baseToken} déjà maximale pour MockRMM`);
    }

    // Attendre la fin de la périodicité
    await new Promise(resolve => setTimeout(resolve, periodicity * 1000));

    // === ÉTAPE 4: État AVANT remboursement ===
    console.log("\n📊 === ÉTAPE 4: État AVANT remboursement ===");

    const beforeState = {
        userSupplyTokenBalance: await supplyToken.balanceOf(userAddress),
        userDebtBalance: await debtToken.balanceOf(userAddress),
        runnerSupplyTokenBalance: await supplyToken.balanceOf(runnerAddress),
        daoTreasuryBalance: await supplyToken.balanceOf(daoConfig.treasuryAddress),
        userConfiguredAmount: (await rent2Repay.getUserConfigForToken(userAddress, await supplyToken.getAddress()))[0]
    };

    console.log("   État initial :");
    console.log(`   👤 User ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(beforeState.userSupplyTokenBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${beforeState.userSupplyTokenBalance} Wei)`);
    console.log(`   👤 User debt ${SELECTED_TOKEN.baseToken} balance: ${ethers.formatUnits(beforeState.userDebtBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.baseToken} (${beforeState.userDebtBalance} Wei)`);
    console.log(`   🏃 Runner ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(beforeState.runnerSupplyTokenBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${beforeState.runnerSupplyTokenBalance} Wei)`);
    console.log(`   🏦 DAO treasury ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(beforeState.daoTreasuryBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${beforeState.daoTreasuryBalance} Wei)`);
    console.log(`   ⚙️ User configured amount: ${ethers.formatUnits(beforeState.userConfiguredAmount, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${beforeState.userConfiguredAmount} Wei)`);

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
    console.log("   🎯 ATTENDU du remboursement via supply token :");
    console.log(`   💸 Montant à rembourser: ${ethers.formatUnits(amountToRepay, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${amountToRepay} Wei)`);
    console.log(`   💰 Fees DAO attendues: ${ethers.formatUnits(expectedDaoFees, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${expectedDaoFees} Wei)`);
    console.log(`   🎁 Tips runner attendues: ${ethers.formatUnits(expectedSenderTips, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${expectedSenderTips} Wei)`);
    console.log(`   💰 Total des fees: ${ethers.formatUnits(expectedTotalFees, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${expectedTotalFees} Wei)`);
    console.log(`   🔄 Montant net pour remboursement: ${ethers.formatUnits(expectedAmountForRepayment, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.baseToken} (${expectedAmountForRepayment} Wei)`);
    console.log("");
    console.log("   📊 Changements attendus:");
    const expectedUserSupplyTokenAfter = beforeState.userSupplyTokenBalance - amountToRepay;
    const expectedUserDebtAfter = expectedAmountForRepayment > 0n ? beforeState.userDebtBalance - expectedAmountForRepayment : beforeState.userDebtBalance;
    const expectedRunnerSupplyTokenAfter = beforeState.runnerSupplyTokenBalance + expectedSenderTips;
    const expectedDaoTreasuryAfter = beforeState.daoTreasuryBalance + expectedDaoFees;

    console.log(`   👤 User ${SELECTED_TOKEN.name}: ${ethers.formatUnits(beforeState.userSupplyTokenBalance, SELECTED_TOKEN.decimals)} → ${ethers.formatUnits(expectedUserSupplyTokenAfter, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${beforeState.userSupplyTokenBalance} → ${expectedUserSupplyTokenAfter} Wei)`);
    console.log(`   👤 User debt ${SELECTED_TOKEN.baseToken}: ${ethers.formatUnits(beforeState.userDebtBalance, SELECTED_TOKEN.decimals)} → ${ethers.formatUnits(expectedUserDebtAfter, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.baseToken} (${beforeState.userDebtBalance} → ${expectedUserDebtAfter} Wei)`);
    console.log(`   🏃 Runner ${SELECTED_TOKEN.name}: ${ethers.formatUnits(beforeState.runnerSupplyTokenBalance, SELECTED_TOKEN.decimals)} → ${ethers.formatUnits(expectedRunnerSupplyTokenAfter, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${beforeState.runnerSupplyTokenBalance} → ${expectedRunnerSupplyTokenAfter} Wei)`);
    console.log(`   🏦 DAO treasury ${SELECTED_TOKEN.name}: ${ethers.formatUnits(beforeState.daoTreasuryBalance, SELECTED_TOKEN.decimals)} → ${ethers.formatUnits(expectedDaoTreasuryAfter, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${beforeState.daoTreasuryBalance} → ${expectedDaoTreasuryAfter} Wei)`);

    // === ÉTAPE 6: Exécution du remboursement via supply token ===
    console.log("\n🚀 === ÉTAPE 6: Exécution du remboursement via supply token ===");

    try {
        console.log("   👉 Exécution de rent2repay() avec supply token...");
        const tx = await rent2Repay.connect(signers[2]).rent2repay(
            userAddress,
            await supplyToken.getAddress() // On utilise l'adresse du supply token pour activer le mode supply
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
        userSupplyTokenBalance: await supplyToken.balanceOf(userAddress),
        userDebtBalance: await debtToken.balanceOf(userAddress),
        runnerSupplyTokenBalance: await supplyToken.balanceOf(runnerAddress),
        daoTreasuryBalance: await supplyToken.balanceOf(daoConfig.treasuryAddress)
    };

    console.log("   État final :");
    console.log(`   👤 User ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(afterState.userSupplyTokenBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${afterState.userSupplyTokenBalance} Wei)`);
    console.log(`   👤 User debt ${SELECTED_TOKEN.baseToken} balance: ${ethers.formatUnits(afterState.userDebtBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.baseToken} (${afterState.userDebtBalance} Wei)`);
    console.log(`   🏃 Runner ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(afterState.runnerSupplyTokenBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${afterState.runnerSupplyTokenBalance} Wei)`);
    console.log(`   🏦 DAO treasury ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(afterState.daoTreasuryBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${afterState.daoTreasuryBalance} Wei)`);

    // === ÉTAPE 8: Comparaison ATTENDU vs RÉEL ===
    console.log("\n✅ === ÉTAPE 8: Vérification ATTENDU vs RÉEL ===");

    const actualChanges = {
        userSupplyTokenChange: beforeState.userSupplyTokenBalance - afterState.userSupplyTokenBalance,
        userDebtChange: beforeState.userDebtBalance - afterState.userDebtBalance,
        runnerSupplyTokenChange: afterState.runnerSupplyTokenBalance - beforeState.runnerSupplyTokenBalance,
        daoTreasuryChange: afterState.daoTreasuryBalance - beforeState.daoTreasuryBalance
    };

    console.log("   📊 Comparaison des changements:");

    // Vérifications
    const userSupplyTokenOK = actualChanges.userSupplyTokenChange === amountToRepay;
    const userDebtOK = actualChanges.userDebtChange === expectedAmountForRepayment;
    const runnerSupplyTokenOK = actualChanges.runnerSupplyTokenChange === expectedSenderTips;
    const daoTreasuryOK = actualChanges.daoTreasuryChange === expectedDaoFees;

    console.log(`   ${userSupplyTokenOK ? '✅' : '❌'} User ${SELECTED_TOKEN.name} changement: ${ethers.formatUnits(actualChanges.userSupplyTokenChange, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (attendu: ${ethers.formatUnits(amountToRepay, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name}) [${actualChanges.userSupplyTokenChange} Wei vs ${amountToRepay} Wei]`);
    console.log(`   ${userDebtOK ? '✅' : '❌'} User debt changement: ${ethers.formatUnits(actualChanges.userDebtChange, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.baseToken} (attendu: ${ethers.formatUnits(expectedAmountForRepayment, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.baseToken}) [${actualChanges.userDebtChange} Wei vs ${expectedAmountForRepayment} Wei]`);
    console.log(`   ${runnerSupplyTokenOK ? '✅' : '❌'} Runner ${SELECTED_TOKEN.name} changement: ${ethers.formatUnits(actualChanges.runnerSupplyTokenChange, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (attendu: ${ethers.formatUnits(expectedSenderTips, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name}) [${actualChanges.runnerSupplyTokenChange} Wei vs ${expectedSenderTips} Wei]`);
    console.log(`   ${daoTreasuryOK ? '✅' : '❌'} DAO treasury changement: ${ethers.formatUnits(actualChanges.daoTreasuryChange, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (attendu: ${ethers.formatUnits(expectedDaoFees, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name}) [${actualChanges.daoTreasuryChange} Wei vs ${expectedDaoFees} Wei]`);

    const allOK = userSupplyTokenOK && userDebtOK && runnerSupplyTokenOK && daoTreasuryOK;

    console.log(`\n${allOK ? '🎉' : '⚠️'} === RÉSULTAT FINAL ===`);
    if (allOK) {
        console.log("✅ Tous les tests sont RÉUSSIS! Le remboursement via supply token fonctionne parfaitement.");
    } else {
        console.log("❌ Certains tests ont ÉCHOUÉ. Vérifiez les calculs ci-dessus.");
    }

    console.log(`📊 Supply token testé: ${SELECTED_TOKEN.name} (${SELECTED_TOKEN.decimals} decimals)`);
    console.log(`📊 Token de base: ${SELECTED_TOKEN.baseToken} (${SELECTED_TOKEN.decimals} decimals)`);
    console.log(`💰 Montant prélevé: ${ethers.formatUnits(amountToRepay, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${amountToRepay} Wei)`);
    console.log(`💸 Total des fees: ${ethers.formatUnits(expectedTotalFees, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${expectedTotalFees} Wei)`);
    console.log(`🔄 Remboursement effectué avec: ${SELECTED_TOKEN.name} (supply token)`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }); 