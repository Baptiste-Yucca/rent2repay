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

// Configuration des 3 utilisateurs
const USER_CONFIGS = [
    {
        index: 1, // signer index
        name: "User1",
        configuredAmount: "50",
        debtAmount: "1000" // moins que configuré
    },
    {
        index: 2, // signer index
        name: "User2",
        configuredAmount: "100",
        debtAmount: "1000" // plus que configuré
    },
    {
        index: 3, // signer index
        name: "User3",
        configuredAmount: "500",
        debtAmount: "1000" // moins que configuré
    }
];

async function main() {
    console.log(`🔍 Test de batchRent2Repay avec ${SELECTED_TOKEN.name} (${SELECTED_TOKEN.decimals} decimals)\n`);

    // Charger la configuration déployée
    const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");
    if (!fs.existsSync(configPath)) {
        throw new Error("❌ Fichier de configuration non trouvé. Exécutez d'abord le script de déploiement.");
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Récupérer les signers
    const signers = await ethers.getSigners();
    const runnerAddress = signers[9].address; // RUNNER à l'index 9

    console.log("👥 Acteurs du test:");
    USER_CONFIGS.forEach(userConfig => {
        console.log(`   👤 ${userConfig.name}: ${signers[userConfig.index].address}`);
    });
    console.log(`   🏃 Runner: ${runnerAddress}\n`);

    // Charger les contrats
    const token = await ethers.getContractAt("MockERC20", config.contracts[SELECTED_TOKEN.contractKey]);
    const rent2Repay = await ethers.getContractAt("Rent2Repay", config.contracts.Rent2Repay);
    const mockRMM = await ethers.getContractAt("MockRMM", config.contracts.MockRMM);

    // Récupérer la configuration du token depuis Rent2Repay
    let tokenConfig;
    let debtToken;
    try {
        const tokenConfigData = await rent2Repay.tokenConfig(await token.getAddress());
        if (tokenConfigData.token === ethers.ZeroAddress) {
            throw new Error("Token not configured in new system");
        }
        tokenConfig = {
            token: tokenConfigData.token,
            debtToken: tokenConfigData.token, // debtToken is same as token in this case
            supplyToken: tokenConfigData.supplyToken,
            active: tokenConfigData.active
        };
        debtToken = await ethers.getContractAt("MockDebtToken", tokenConfig.debtToken);
    } catch (error) {
        console.log("   ⚠️ Token non configuré dans le nouveau système, utilisation de l'ancien système...");
        debtToken = await ethers.getContractAt("MockDebtToken", config.contracts[SELECTED_TOKEN.debtContractKey]);
        tokenConfig = {
            debtToken: config.contracts[SELECTED_TOKEN.debtContractKey],
            supplyToken: "Non configuré",
            active: "Non configuré"
        };
    }

    console.log("📋 Adresses des contrats:");
    console.log(`   ${SELECTED_TOKEN.name}: ${await token.getAddress()}`);
    console.log(`   Debt${SELECTED_TOKEN.name}: ${tokenConfig.debtToken}`);
    console.log(`   Supply${SELECTED_TOKEN.name}: ${tokenConfig.supplyToken}`);
    console.log(`   Token Active: ${tokenConfig.active}`);
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

    // Mint des tokens pour tous les utilisateurs
    const baseTokenAmount = ethers.parseUnits("10000", SELECTED_TOKEN.decimals);

    for (const userConfig of USER_CONFIGS) {
        const userAddress = signers[userConfig.index].address;
        const debtAmount = ethers.parseUnits(userConfig.debtAmount, SELECTED_TOKEN.decimals);

        console.log(`   👉 Mint de ${ethers.formatUnits(baseTokenAmount, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} pour ${userConfig.name}...`);
        await token.mint(userAddress, baseTokenAmount);

        console.log(`   👉 Mint de ${ethers.formatUnits(debtAmount, SELECTED_TOKEN.decimals)} debt ${SELECTED_TOKEN.name} pour ${userConfig.name}...`);
        await debtToken.mint(userAddress, debtAmount);
    }

    // === ÉTAPE 2: Configuration Rent2Repay pour chaque utilisateur ===
    console.log("\n⚙️ === ÉTAPE 2: Configuration Rent2Repay pour chaque utilisateur ===");

    const periodicity = 5; // 5 secondes pour le test
    const startTimestamp = 0; // timestamp à 0 pour le test

    for (const userConfig of USER_CONFIGS) {
        const userSigner = signers[userConfig.index];
        const configuredAmount = ethers.parseUnits(userConfig.configuredAmount, SELECTED_TOKEN.decimals);

        // Révoquer d'abord au cas où il y aurait une configuration existante
        try {
            await rent2Repay.connect(userSigner).revokeRent2RepayAll();
            console.log(`   ⚠️ Configuration existante révoquée pour ${userConfig.name}`);
        } catch (error) {
            console.log(`   ✅ Aucune configuration existante à révoquer pour ${userConfig.name}`);
        }

        console.log(`   👉 Configuration ${userConfig.name} - limite: ${ethers.formatUnits(configuredAmount, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name}...`);
        await rent2Repay.connect(userSigner).configureRent2Repay(
            [await token.getAddress()],
            [configuredAmount],
            periodicity,
            startTimestamp
        );
        console.log(`   ✅ Configuration réussie pour ${userConfig.name}`);
    }

    // === ÉTAPE 3: Approbations pour tous les utilisateurs ===
    console.log("\n🔓 === ÉTAPE 3: Vérification des approbations ===");

    const rent2RepayAddress = await rent2Repay.getAddress();
    const mockRMMAddress = await mockRMM.getAddress();

    for (const userConfig of USER_CONFIGS) {
        const userSigner = signers[userConfig.index];
        const userAddress = userSigner.address;

        // Approbation token -> Rent2Repay
        const currentTokenAllowance = await token.allowance(userAddress, rent2RepayAddress);
        if (currentTokenAllowance < ethers.MaxUint256) {
            await token.connect(userSigner).approve(rent2RepayAddress, ethers.MaxUint256);
            console.log(`   ✅ Approbation ${SELECTED_TOKEN.name} accordée pour ${userConfig.name}`);
        } else {
            console.log(`   ✅ Approbation ${SELECTED_TOKEN.name} déjà maximale pour ${userConfig.name}`);
        }

        // Approbation debtToken -> MockRMM
        const currentDebtAllowance = await debtToken.allowance(userAddress, mockRMMAddress);
        if (currentDebtAllowance < ethers.MaxUint256) {
            await debtToken.connect(userSigner).approve(mockRMMAddress, ethers.MaxUint256);
            console.log(`   ✅ Approbation debt ${SELECTED_TOKEN.name} accordée pour ${userConfig.name}`);
        } else {
            console.log(`   ✅ Approbation debt ${SELECTED_TOKEN.name} déjà maximale pour ${userConfig.name}`);
        }
    }

    // === ÉTAPE 4: Vérification des configurations onchain ===
    console.log("\n📋 === ÉTAPE 4: Vérification des configurations onchain ===");

    const userAddresses = [];
    for (const userConfig of USER_CONFIGS) {
        const userAddress = signers[userConfig.index].address;
        userAddresses.push(userAddress);

        const maxAmount = await rent2Repay.allowedMaxAmounts(userAddress, await token.getAddress());
        const userPeriodicity = await rent2Repay.periodicity(userAddress, await token.getAddress());
        const lastTimestamp = await rent2Repay.lastRepayTimestamps(userAddress);
        console.log(`   👤 ${userConfig.name}:`);
        console.log(`      📅 Montant configuré: ${ethers.formatUnits(maxAmount, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${maxAmount} Wei)`);
        console.log(`      ⏰ Périodicité: ${userPeriodicity}s`);
        console.log(`      🕐 Dernier timestamp: ${lastTimestamp}`);
    }

    // === ÉTAPE 5: État AVANT remboursement ===
    console.log("\n📊 === ÉTAPE 5: État AVANT remboursement ===");

    const beforeState = {
        users: [],
        runnerTokenBalance: await token.balanceOf(runnerAddress),
        daoTreasuryBalance: await token.balanceOf(daoConfig.treasuryAddress)
    };

    for (let i = 0; i < USER_CONFIGS.length; i++) {
        const userConfig = USER_CONFIGS[i];
        const userAddress = signers[userConfig.index].address;

        const userState = {
            address: userAddress,
            name: userConfig.name,
            tokenBalance: await token.balanceOf(userAddress),
            debtBalance: await debtToken.balanceOf(userAddress),
            configuredAmount: await rent2Repay.allowedMaxAmounts(userAddress, await token.getAddress())
        };

        beforeState.users.push(userState);

        console.log(`   👤 ${userConfig.name}:`);
        console.log(`      ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(userState.tokenBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${userState.tokenBalance} Wei)`);
        console.log(`      Debt ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(userState.debtBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${userState.debtBalance} Wei)`);
        console.log(`      Configured amount: ${ethers.formatUnits(userState.configuredAmount, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${userState.configuredAmount} Wei)`);
    }

    console.log(`   🏃 Runner ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(beforeState.runnerTokenBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${beforeState.runnerTokenBalance} Wei)`);
    console.log(`   🏦 DAO treasury ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(beforeState.daoTreasuryBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${beforeState.daoTreasuryBalance} Wei)`);

    // === ÉTAPE 6: Calcul de l'ATTENDU ===
    console.log("\n🎯 === ÉTAPE 6: Calcul de l'ATTENDU ===");

    // Récupérer les fees depuis le contrat
    const [daoFeesBPS, senderTipsBPS] = await rent2Repay.getFeeConfiguration();
    console.log(`   💰 DAO fees BPS: ${daoFeesBPS}`);
    console.log(`   🎁 Sender tips BPS: ${senderTipsBPS}\n`);

    let totalDaoFees = 0n;
    let totalSenderTips = 0n;
    let totalAmountForRepayment = 0n;
    let totalAmountToRepay = 0n;

    const expectedUserChanges = [];

    for (let i = 0; i < beforeState.users.length; i++) {
        const userState = beforeState.users[i];
        const userConfig = USER_CONFIGS[i];

        // Calculer le montant qui sera remboursé pour cet utilisateur
        const amountToRepay = userState.debtBalance < userState.configuredAmount
            ? userState.debtBalance
            : userState.configuredAmount;

        // Calculer les fees pour cet utilisateur
        const userDaoFees = (amountToRepay * daoFeesBPS) / 10000n;
        const userSenderTips = (amountToRepay * senderTipsBPS) / 10000n;
        const userTotalFees = userDaoFees + userSenderTips;
        const userAmountForRepayment = amountToRepay - userTotalFees;

        // Accumuler les totaux
        totalDaoFees += userDaoFees;
        totalSenderTips += userSenderTips;
        totalAmountForRepayment += userAmountForRepayment;
        totalAmountToRepay += amountToRepay;

        expectedUserChanges.push({
            name: userConfig.name,
            amountToRepay,
            daoFees: userDaoFees,
            senderTips: userSenderTips,
            amountForRepayment: userAmountForRepayment,
            expectedTokenAfter: userState.tokenBalance - amountToRepay,
            expectedDebtAfter: userAmountForRepayment > 0n ? userState.debtBalance - userAmountForRepayment : userState.debtBalance
        });

        console.log(`   👤 ${userConfig.name}:`);
        console.log(`      💸 Montant à rembourser: ${ethers.formatUnits(amountToRepay, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${amountToRepay} Wei)`);
        console.log(`      💰 Fees DAO: ${ethers.formatUnits(userDaoFees, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${userDaoFees} Wei)`);
        console.log(`      🎁 Tips runner: ${ethers.formatUnits(userSenderTips, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${userSenderTips} Wei)`);
        console.log(`      🔄 Montant net pour remboursement: ${ethers.formatUnits(userAmountForRepayment, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${userAmountForRepayment} Wei)`);
    }

    console.log(`\n   📊 TOTAUX ATTENDUS:`);
    console.log(`   💸 Total à rembourser: ${ethers.formatUnits(totalAmountToRepay, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${totalAmountToRepay} Wei)`);
    console.log(`   💰 Total fees DAO: ${ethers.formatUnits(totalDaoFees, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${totalDaoFees} Wei)`);
    console.log(`   🎁 Total tips runner: ${ethers.formatUnits(totalSenderTips, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${totalSenderTips} Wei)`);
    console.log(`   🔄 Total net pour remboursement: ${ethers.formatUnits(totalAmountForRepayment, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${totalAmountForRepayment} Wei)`);

    const expectedRunnerTokenAfter = beforeState.runnerTokenBalance + totalSenderTips;
    const expectedDaoTreasuryAfter = beforeState.daoTreasuryBalance + totalDaoFees;

    console.log(`\n   📋 Changements attendus:`);
    console.log(`   🏃 Runner ${SELECTED_TOKEN.name}: ${ethers.formatUnits(beforeState.runnerTokenBalance, SELECTED_TOKEN.decimals)} → ${ethers.formatUnits(expectedRunnerTokenAfter, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name}`);
    console.log(`   🏦 DAO treasury ${SELECTED_TOKEN.name}: ${ethers.formatUnits(beforeState.daoTreasuryBalance, SELECTED_TOKEN.decimals)} → ${ethers.formatUnits(expectedDaoTreasuryAfter, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name}`);

    // === ÉTAPE 7: Exécution du batchRent2Repay ===
    console.log("\n🚀 === ÉTAPE 7: Exécution du batchRent2Repay ===");

    try {
        console.log("   👉 Exécution de batchRent2Repay()...");
        console.log(`   📋 Utilisateurs: [${userAddresses.join(', ')}]`);
        console.log(`   🪙 Token: ${await token.getAddress()}`);

        const tx = await rent2Repay.connect(signers[9]).batchRent2Repay(
            userAddresses,
            await token.getAddress()
        );
        const receipt = await tx.wait();
        console.log(`   ✅ Transaction réussie! Hash: ${receipt.hash}`);
    } catch (error) {
        console.log("   ❌ Erreur lors du batch remboursement:", error.message);
        return;
    }

    // === ÉTAPE 8: État APRÈS remboursement ===
    console.log("\n📊 === ÉTAPE 8: État APRÈS remboursement ===");

    const afterState = {
        users: [],
        runnerTokenBalance: await token.balanceOf(runnerAddress),
        daoTreasuryBalance: await token.balanceOf(daoConfig.treasuryAddress)
    };

    for (let i = 0; i < USER_CONFIGS.length; i++) {
        const userConfig = USER_CONFIGS[i];
        const userAddress = signers[userConfig.index].address;

        const userState = {
            tokenBalance: await token.balanceOf(userAddress),
            debtBalance: await debtToken.balanceOf(userAddress)
        };

        afterState.users.push(userState);

        console.log(`   👤 ${userConfig.name}:`);
        console.log(`      ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(userState.tokenBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${userState.tokenBalance} Wei)`);
        console.log(`      Debt ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(userState.debtBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${userState.debtBalance} Wei)`);
    }

    console.log(`   🏃 Runner ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(afterState.runnerTokenBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${afterState.runnerTokenBalance} Wei)`);
    console.log(`   🏦 DAO treasury ${SELECTED_TOKEN.name} balance: ${ethers.formatUnits(afterState.daoTreasuryBalance, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${afterState.daoTreasuryBalance} Wei)`);

    // === ÉTAPE 9: Comparaison ATTENDU vs RÉEL ===
    console.log("\n✅ === ÉTAPE 9: Vérification ATTENDU vs RÉEL ===");

    const actualTotalChanges = {
        runnerTokenChange: afterState.runnerTokenBalance - beforeState.runnerTokenBalance,
        daoTreasuryChange: afterState.daoTreasuryBalance - beforeState.daoTreasuryBalance
    };

    console.log("   📊 Comparaison des changements:");

    let allOK = true;

    // Vérification pour chaque utilisateur
    for (let i = 0; i < beforeState.users.length; i++) {
        const beforeUser = beforeState.users[i];
        const afterUser = afterState.users[i];
        const expected = expectedUserChanges[i];

        const actualUserTokenChange = beforeUser.tokenBalance - afterUser.tokenBalance;
        const actualUserDebtChange = beforeUser.debtBalance - afterUser.debtBalance;

        const userTokenOK = actualUserTokenChange === expected.amountToRepay;
        const userDebtOK = actualUserDebtChange === expected.amountForRepayment;

        console.log(`   👤 ${expected.name}:`);
        console.log(`      ${userTokenOK ? '✅' : '❌'} ${SELECTED_TOKEN.name} changement: ${ethers.formatUnits(actualUserTokenChange, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (attendu: ${ethers.formatUnits(expected.amountToRepay, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name})`);
        console.log(`      ${userDebtOK ? '✅' : '❌'} Debt changement: ${ethers.formatUnits(actualUserDebtChange, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (attendu: ${ethers.formatUnits(expected.amountForRepayment, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name})`);

        if (!userTokenOK || !userDebtOK) allOK = false;
    }

    // Vérifications globales
    const runnerTokenOK = actualTotalChanges.runnerTokenChange === totalSenderTips;
    const daoTreasuryOK = actualTotalChanges.daoTreasuryChange === totalDaoFees;

    console.log(`\n   📊 Changements globaux:`);
    console.log(`   ${runnerTokenOK ? '✅' : '❌'} Runner ${SELECTED_TOKEN.name} changement: ${ethers.formatUnits(actualTotalChanges.runnerTokenChange, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (attendu: ${ethers.formatUnits(totalSenderTips, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name})`);
    console.log(`   ${daoTreasuryOK ? '✅' : '❌'} DAO treasury changement: ${ethers.formatUnits(actualTotalChanges.daoTreasuryChange, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (attendu: ${ethers.formatUnits(totalDaoFees, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name})`);

    if (!runnerTokenOK || !daoTreasuryOK) allOK = false;

    console.log(`\n${allOK ? '🎉' : '⚠️'} === RÉSULTAT FINAL ===`);
    if (allOK) {
        console.log("✅ Tous les tests sont RÉUSSIS! Le batchRent2Repay fonctionne parfaitement.");
    } else {
        console.log("❌ Certains tests ont ÉCHOUÉ. Vérifiez les calculs ci-dessus.");
    }

    console.log(`📊 Token testé: ${SELECTED_TOKEN.name} (${SELECTED_TOKEN.decimals} decimals)`);
    console.log(`👥 Nombre d'utilisateurs: ${USER_CONFIGS.length}`);
    console.log(`💰 Total remboursé: ${ethers.formatUnits(totalAmountToRepay, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${totalAmountToRepay} Wei)`);
    console.log(`💸 Total des fees: ${ethers.formatUnits(totalDaoFees + totalSenderTips, SELECTED_TOKEN.decimals)} ${SELECTED_TOKEN.name} (${totalDaoFees + totalSenderTips} Wei)`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }); 