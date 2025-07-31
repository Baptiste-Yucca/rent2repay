const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Configuration fixe pour armmWXDAI
const SUPPLY_TOKEN_CONFIG = {
    name: "armmWXDAI",
    baseToken: "WXDAI",
    symbol: "armmWXDAI",
    decimals: 18,
    baseContractKey: "MockWXDAI",
    supplyContractKey: "armmWXDAI",
    debtContractKey: "MockDebtWXDAI"
};

// Configuration des utilisateurs pour le test batch
const USERS_CONFIG = [
    {
        userIndex: 1,
        supplyTokenAmount: "1000", // en armmWXDAI
        debtAmount: "100", // en WXDAI debt
        weeklyLimit: "50" // limite hebdomadaire
    },
    {
        userIndex: 3,
        supplyTokenAmount: "2000", // en armmWXDAI
        debtAmount: "200", // en WXDAI debt
        weeklyLimit: "80" // limite hebdomadaire
    },
    {
        userIndex: 4,
        supplyTokenAmount: "1500", // en armmWXDAI
        debtAmount: "150", // en WXDAI debt
        weeklyLimit: "60" // limite hebdomadaire
    },
    {
        userIndex: 5,
        supplyTokenAmount: "3000", // en armmWXDAI
        debtAmount: "250", // en WXDAI debt
        weeklyLimit: "100" // limite hebdomadaire
    }
];

const RUNNER_INDEX = 2;

async function main() {
    console.log(`🔍 Test de remboursement batch via supply token ${SUPPLY_TOKEN_CONFIG.name} pour ${USERS_CONFIG.length} utilisateurs\n`);

    // Charger la configuration déployée
    const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");
    if (!fs.existsSync(configPath)) {
        throw new Error("❌ Fichier de configuration non trouvé. Exécutez d'abord le script de déploiement.");
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Récupérer les signers
    const signers = await ethers.getSigners();
    const runnerAddress = signers[RUNNER_INDEX].address;

    console.log("👥 Acteurs du test:");
    console.log(`   🏃 Runner: ${runnerAddress}`);
    USERS_CONFIG.forEach((userConfig, index) => {
        console.log(`   👤 Utilisateur ${index + 1}: ${signers[userConfig.userIndex].address}`);
    });
    console.log("");

    // Charger les contrats
    const baseToken = await ethers.getContractAt("MockERC20", config.contracts[SUPPLY_TOKEN_CONFIG.baseContractKey]);
    const supplyToken = await ethers.getContractAt("MockERC20", config.contracts[SUPPLY_TOKEN_CONFIG.supplyContractKey]);
    const rent2Repay = await ethers.getContractAt("Rent2Repay", config.contracts.Rent2Repay);
    const mockRMM = await ethers.getContractAt("MockRMM", config.contracts.MockRMM);

    // Récupérer ou configurer le token
    let tokenConfig;
    let debtToken;
    try {
        const tokenConfigData = await rent2Repay.tokenConfig(await supplyToken.getAddress());
        if (tokenConfigData.supplyToken === ethers.ZeroAddress) {
            throw new Error("Supply token not configured");
        }
        tokenConfig = {
            token: tokenConfigData.token,
            debtToken: tokenConfigData.token, // debtToken is same as token in this case
            supplyToken: tokenConfigData.supplyToken,
            active: tokenConfigData.active
        };
        debtToken = await ethers.getContractAt("MockDebtToken", tokenConfig.debtToken);
    } catch (error) {
        console.log("   ⚠️ Supply token non configuré dans le système, tentative de configuration...");

        try {
            const debtTokenAddress = config.contracts[SUPPLY_TOKEN_CONFIG.debtContractKey];
            const supplyTokenAddress = config.contracts[SUPPLY_TOKEN_CONFIG.supplyContractKey];

            console.log(`   👉 Configuration du trio: ${await baseToken.getAddress()} / ${debtTokenAddress} / ${supplyTokenAddress}`);

            await rent2Repay.authorizeTokenTriple(
                await baseToken.getAddress(),
                debtTokenAddress,
                supplyTokenAddress
            );

            console.log("   ✅ Token triple configuré avec succès");

            const tokenConfigData2 = await rent2Repay.tokenConfig(await supplyToken.getAddress());
            tokenConfig = {
                token: tokenConfigData2.token,
                debtToken: tokenConfigData2.token, // debtToken is same as token in this case
                supplyToken: tokenConfigData2.supplyToken,
                active: tokenConfigData2.active
            };
            debtToken = await ethers.getContractAt("MockDebtToken", tokenConfig.debtToken);
        } catch (configError) {
            console.log("   ❌ Échec de la configuration du supply token:", configError.message);
            return;
        }
    }

    console.log("📋 Adresses des contrats:");
    console.log(`   ${SUPPLY_TOKEN_CONFIG.baseToken} (base): ${await baseToken.getAddress()}`);
    console.log(`   ${SUPPLY_TOKEN_CONFIG.name} (supply): ${await supplyToken.getAddress()}`);
    console.log(`   Debt${SUPPLY_TOKEN_CONFIG.baseToken}: ${tokenConfig.debtToken}`);
    console.log(`   Rent2Repay: ${await rent2Repay.getAddress()}`);
    console.log(`   MockRMM: ${await mockRMM.getAddress()}\n`);

    // === ÉTAPE 1: Vérification de l'adresse DAO treasury ===
    console.log("🔧 === ÉTAPE 1: Vérification de l'adresse DAO treasury ===");
    const daoConfig = await rent2Repay.getDaoFeeReductionConfiguration();
    if (daoConfig.treasuryAddress === ethers.ZeroAddress) {
        console.log("   ⚠️ Adresse DAO treasury non définie, configuration avec l'adresse #10...");
        const daoTreasuryAddress = signers[10].address;
        await rent2Repay.updateDaoTreasuryAddress(daoTreasuryAddress);
        console.log(`   ✅ Adresse DAO treasury configurée: ${daoTreasuryAddress}`);
    } else {
        console.log(`   ✅ Adresse DAO treasury déjà configurée: ${daoConfig.treasuryAddress}`);
    }

    // === ÉTAPE 2: Préparation des données pour chaque utilisateur ===
    console.log("\n🔧 === ÉTAPE 2: Préparation des données pour chaque utilisateur ===");

    const users = [];
    let totalSupplyTokenNeeded = 0n;

    for (const userConfig of USERS_CONFIG) {
        const userSigner = signers[userConfig.userIndex];
        const userAddress = userSigner.address;

        const supplyTokenAmount = ethers.parseUnits(userConfig.supplyTokenAmount, SUPPLY_TOKEN_CONFIG.decimals);
        const debtAmount = ethers.parseUnits(userConfig.debtAmount, SUPPLY_TOKEN_CONFIG.decimals);
        const weeklyLimit = ethers.parseUnits(userConfig.weeklyLimit, SUPPLY_TOKEN_CONFIG.decimals);

        console.log(`   👤 Utilisateur ${userAddress}:`);
        console.log(`      💰 ${userConfig.supplyTokenAmount} ${SUPPLY_TOKEN_CONFIG.name} (${supplyTokenAmount} Wei)`);
        console.log(`      🏦 ${userConfig.debtAmount} debt ${SUPPLY_TOKEN_CONFIG.baseToken} (${debtAmount} Wei)`);
        console.log(`      📊 Limite: ${userConfig.weeklyLimit} ${SUPPLY_TOKEN_CONFIG.name} (${weeklyLimit} Wei)`);

        // Mint des tokens
        await supplyToken.mint(userAddress, supplyTokenAmount);
        await debtToken.mint(userAddress, debtAmount);

        // Calculer le montant qui sera effectivement utilisé pour le remboursement
        const amountToRepay = debtAmount < weeklyLimit ? debtAmount : weeklyLimit;
        totalSupplyTokenNeeded += amountToRepay;

        users.push({
            signer: userSigner,
            address: userAddress,
            supplyTokenAmount,
            debtAmount,
            weeklyLimit,
            amountToRepay
        });
    }

    console.log(`\n   📊 Total supply token nécessaire pour tous les remboursements: ${ethers.formatUnits(totalSupplyTokenNeeded, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (${totalSupplyTokenNeeded} Wei)`);

    // === ÉTAPE 3: Vérification du balance du token sous-jacent ===
    console.log("\n🔍 === ÉTAPE 3: Vérification du balance du token sous-jacent ===");

    const supplyTokenAddress = await supplyToken.getAddress();
    const baseTokenBalance = await baseToken.balanceOf(supplyTokenAddress);
    const minimumRequired = totalSupplyTokenNeeded + ethers.parseUnits("1", SUPPLY_TOKEN_CONFIG.decimals); // +1 pour la sécurité

    console.log(`   🏦 Balance ${SUPPLY_TOKEN_CONFIG.baseToken} du contrat ${SUPPLY_TOKEN_CONFIG.name}: ${ethers.formatUnits(baseTokenBalance, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.baseToken} (${baseTokenBalance} Wei)`);
    console.log(`   ⚠️ Minimum requis: ${ethers.formatUnits(minimumRequired, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.baseToken} (${minimumRequired} Wei)`);

    if (baseTokenBalance < minimumRequired) {
        console.log(`   ❌ Balance insuffisante! Ajout de ${ethers.formatUnits(minimumRequired - baseTokenBalance, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.baseToken}...`);
        await baseToken.mint(supplyTokenAddress, minimumRequired - baseTokenBalance);
        const newBalance = await baseToken.balanceOf(supplyTokenAddress);
        console.log(`   ✅ Nouveau balance: ${ethers.formatUnits(newBalance, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.baseToken} (${newBalance} Wei)`);
    } else {
        console.log(`   ✅ Balance suffisante pour les remboursements!`);
    }

    // === ÉTAPE 4: Configuration Rent2Repay pour chaque utilisateur ===
    console.log("\n⚙️ === ÉTAPE 4: Configuration Rent2Repay pour chaque utilisateur ===");

    const periodicity = 1; // 1 seconde pour le test
    const currentTimestamp = Math.floor(Date.now() / 1000);

    for (const user of users) {
        console.log(`   👉 Configuration pour ${user.address}...`);

        // Révoquer d'abord au cas où
        try {
            await rent2Repay.connect(user.signer).revokeRent2RepayAll();
            console.log(`      ⚠️ Configuration existante révoquée pour ${user.address}`);
        } catch (error) {
            console.log(`      ✅ Aucune configuration existante pour ${user.address}`);
        }

        // Configurer
        await rent2Repay.connect(user.signer).configureRent2Repay(
            [await supplyToken.getAddress()],
            [user.weeklyLimit],
            periodicity,
            currentTimestamp
        );

        console.log(`      ✅ Configuration réussie pour ${user.address}`);
    }

    // === ÉTAPE 5: Approbations ===
    console.log("\n🔓 === ÉTAPE 5: Approbations ===");

    const rent2RepayAddress = await rent2Repay.getAddress();
    const mockRMMAddress = await mockRMM.getAddress();

    for (const user of users) {
        // Approbation supplyToken -> Rent2Repay
        await supplyToken.connect(user.signer).approve(rent2RepayAddress, ethers.MaxUint256);

        // Approbation debtToken -> MockRMM
        await debtToken.connect(user.signer).approve(mockRMMAddress, ethers.MaxUint256);

        console.log(`   ✅ Approbations accordées pour ${user.address}`);
    }

    // Attendre la fin de la périodicité
    await new Promise(resolve => setTimeout(resolve, periodicity * 1000));

    // === ÉTAPE 6: État AVANT remboursement ===
    console.log("\n📊 === ÉTAPE 6: État AVANT remboursement ===");

    const beforeState = {
        users: [],
        runnerSupplyTokenBalance: await supplyToken.balanceOf(runnerAddress),
        daoTreasuryBalance: await supplyToken.balanceOf(daoConfig.treasuryAddress)
    };

    for (const user of users) {
        const userSupplyTokenBalance = await supplyToken.balanceOf(user.address);
        const userDebtBalance = await debtToken.balanceOf(user.address);

        beforeState.users.push({
            address: user.address,
            supplyTokenBalance: userSupplyTokenBalance,
            debtBalance: userDebtBalance
        });

        console.log(`   👤 ${user.address}:`);
        console.log(`      💰 ${ethers.formatUnits(userSupplyTokenBalance, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (${userSupplyTokenBalance} Wei)`);
        console.log(`      🏦 ${ethers.formatUnits(userDebtBalance, SUPPLY_TOKEN_CONFIG.decimals)} debt ${SUPPLY_TOKEN_CONFIG.baseToken} (${userDebtBalance} Wei)`);
    }

    console.log(`   🏃 Runner ${SUPPLY_TOKEN_CONFIG.name}: ${ethers.formatUnits(beforeState.runnerSupplyTokenBalance, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (${beforeState.runnerSupplyTokenBalance} Wei)`);
    console.log(`   🏦 DAO treasury ${SUPPLY_TOKEN_CONFIG.name}: ${ethers.formatUnits(beforeState.daoTreasuryBalance, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (${beforeState.daoTreasuryBalance} Wei)`);

    // === ÉTAPE 7: Calcul des montants attendus ===
    console.log("\n🎯 === ÉTAPE 7: Calcul des montants attendus ===");

    const [daoFeesBPS, senderTipsBPS] = await rent2Repay.getFeeConfiguration();
    console.log(`   💰 DAO fees BPS: ${daoFeesBPS}`);
    console.log(`   🎁 Sender tips BPS: ${senderTipsBPS}`);

    let totalExpectedDaoFees = 0n;
    let totalExpectedSenderTips = 0n;
    let totalExpectedAmountForRepayment = 0n;

    const expectedChanges = [];

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const beforeUser = beforeState.users[i];

        const amountToRepay = beforeUser.debtBalance < user.weeklyLimit ? beforeUser.debtBalance : user.weeklyLimit;
        const expectedDaoFees = (amountToRepay * daoFeesBPS) / 10000n;
        const expectedSenderTips = (amountToRepay * senderTipsBPS) / 10000n;
        const expectedAmountForRepayment = amountToRepay - expectedDaoFees - expectedSenderTips;

        totalExpectedDaoFees += expectedDaoFees;
        totalExpectedSenderTips += expectedSenderTips;
        totalExpectedAmountForRepayment += expectedAmountForRepayment;

        expectedChanges.push({
            address: user.address,
            amountToRepay,
            expectedDaoFees,
            expectedSenderTips,
            expectedAmountForRepayment
        });

        console.log(`   👤 ${user.address}:`);
        console.log(`      💸 Montant à rembourser: ${ethers.formatUnits(amountToRepay, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (${amountToRepay} Wei)`);
        console.log(`      🔄 Montant net pour remboursement: ${ethers.formatUnits(expectedAmountForRepayment, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.baseToken} (${expectedAmountForRepayment} Wei)`);
    }

    console.log(`\n   📊 Totaux attendus:`);
    console.log(`   💰 Total DAO fees: ${ethers.formatUnits(totalExpectedDaoFees, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (${totalExpectedDaoFees} Wei)`);
    console.log(`   🎁 Total sender tips: ${ethers.formatUnits(totalExpectedSenderTips, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (${totalExpectedSenderTips} Wei)`);
    console.log(`   🔄 Total pour remboursement: ${ethers.formatUnits(totalExpectedAmountForRepayment, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.baseToken} (${totalExpectedAmountForRepayment} Wei)`);

    // === ÉTAPE 8: Exécution du remboursement batch ===
    console.log("\n🚀 === ÉTAPE 8: Exécution du remboursement batch ===");

    const userAddresses = users.map(user => user.address);
    const batchSupplyTokenAddress = await supplyToken.getAddress();

    try {
        console.log("   👉 Exécution de batchRent2Repay()...");
        console.log(`   📋 Utilisateurs: ${userAddresses.length}`);
        console.log(`   🏦 Supply token: ${SUPPLY_TOKEN_CONFIG.name}`);

        const tx = await rent2Repay.connect(signers[RUNNER_INDEX]).batchRent2Repay(
            userAddresses,
            batchSupplyTokenAddress
        );
        const receipt = await tx.wait();
        console.log(`   ✅ Transaction réussie! Hash: ${receipt.hash}`);
    } catch (error) {
        console.log("   ❌ Erreur lors du remboursement batch:", error.message);
        return;
    }

    // === ÉTAPE 9: État APRÈS remboursement ===
    console.log("\n📊 === ÉTAPE 9: État APRÈS remboursement ===");

    const afterState = {
        users: [],
        runnerSupplyTokenBalance: await supplyToken.balanceOf(runnerAddress),
        daoTreasuryBalance: await supplyToken.balanceOf(daoConfig.treasuryAddress)
    };

    for (const user of users) {
        const userSupplyTokenBalance = await supplyToken.balanceOf(user.address);
        const userDebtBalance = await debtToken.balanceOf(user.address);

        afterState.users.push({
            address: user.address,
            supplyTokenBalance: userSupplyTokenBalance,
            debtBalance: userDebtBalance
        });

        console.log(`   👤 ${user.address}:`);
        console.log(`      💰 ${ethers.formatUnits(userSupplyTokenBalance, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (${userSupplyTokenBalance} Wei)`);
        console.log(`      🏦 ${ethers.formatUnits(userDebtBalance, SUPPLY_TOKEN_CONFIG.decimals)} debt ${SUPPLY_TOKEN_CONFIG.baseToken} (${userDebtBalance} Wei)`);
    }

    console.log(`   🏃 Runner ${SUPPLY_TOKEN_CONFIG.name}: ${ethers.formatUnits(afterState.runnerSupplyTokenBalance, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (${afterState.runnerSupplyTokenBalance} Wei)`);
    console.log(`   🏦 DAO treasury ${SUPPLY_TOKEN_CONFIG.name}: ${ethers.formatUnits(afterState.daoTreasuryBalance, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (${afterState.daoTreasuryBalance} Wei)`);

    // === ÉTAPE 10: Vérification des résultats ===
    console.log("\n✅ === ÉTAPE 10: Vérification des résultats ===");

    let allOK = true;

    // Vérifier chaque utilisateur
    for (let i = 0; i < users.length; i++) {
        const expected = expectedChanges[i];
        const beforeUser = beforeState.users[i];
        const afterUser = afterState.users[i];

        const actualSupplyTokenChange = beforeUser.supplyTokenBalance - afterUser.supplyTokenBalance;
        const actualDebtChange = beforeUser.debtBalance - afterUser.debtBalance;

        const supplyTokenOK = actualSupplyTokenChange === expected.amountToRepay;
        const debtOK = actualDebtChange === expected.expectedAmountForRepayment;

        console.log(`   👤 ${expected.address}:`);
        console.log(`      ${supplyTokenOK ? '✅' : '❌'} Supply token change: ${ethers.formatUnits(actualSupplyTokenChange, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (attendu: ${ethers.formatUnits(expected.amountToRepay, SUPPLY_TOKEN_CONFIG.decimals)})`);
        console.log(`      ${debtOK ? '✅' : '❌'} Debt change: ${ethers.formatUnits(actualDebtChange, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.baseToken} (attendu: ${ethers.formatUnits(expected.expectedAmountForRepayment, SUPPLY_TOKEN_CONFIG.decimals)})`);

        if (!supplyTokenOK || !debtOK) {
            allOK = false;
        }
    }

    // Vérifier les totaux
    const actualRunnerChange = afterState.runnerSupplyTokenBalance - beforeState.runnerSupplyTokenBalance;
    const actualDaoChange = afterState.daoTreasuryBalance - beforeState.daoTreasuryBalance;

    const runnerOK = actualRunnerChange === totalExpectedSenderTips;
    const daoOK = actualDaoChange === totalExpectedDaoFees;

    console.log(`\n   📊 Vérification des totaux:`);
    console.log(`   ${runnerOK ? '✅' : '❌'} Runner change: ${ethers.formatUnits(actualRunnerChange, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (attendu: ${ethers.formatUnits(totalExpectedSenderTips, SUPPLY_TOKEN_CONFIG.decimals)})`);
    console.log(`   ${daoOK ? '✅' : '❌'} DAO change: ${ethers.formatUnits(actualDaoChange, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name} (attendu: ${ethers.formatUnits(totalExpectedDaoFees, SUPPLY_TOKEN_CONFIG.decimals)})`);

    if (!runnerOK || !daoOK) {
        allOK = false;
    }

    // === RÉSULTAT FINAL ===
    console.log(`\n${allOK ? '🎉' : '⚠️'} === RÉSULTAT FINAL ===`);
    if (allOK) {
        console.log("✅ Tous les tests sont RÉUSSIS! Le remboursement batch via supply token fonctionne parfaitement.");
    } else {
        console.log("❌ Certains tests ont ÉCHOUÉ. Vérifiez les calculs ci-dessus.");
    }

    console.log(`📊 Supply token testé: ${SUPPLY_TOKEN_CONFIG.name}`);
    console.log(`👥 Nombre d'utilisateurs: ${users.length}`);
    console.log(`💰 Total supply token utilisé: ${ethers.formatUnits(totalSupplyTokenNeeded, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name}`);
    console.log(`🔄 Total remboursé: ${ethers.formatUnits(totalExpectedAmountForRepayment, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.baseToken}`);
    console.log(`💸 Total des fees: ${ethers.formatUnits(totalExpectedDaoFees + totalExpectedSenderTips, SUPPLY_TOKEN_CONFIG.decimals)} ${SUPPLY_TOKEN_CONFIG.name}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }); 