const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Démarrage du déploiement local des contrats Rent2Repay...");

    // Récupérer le compte de déploiement
    const [deployer] = await ethers.getSigners();
    console.log("📋 Déploiement depuis le compte:", deployer.address);
    console.log("💰 Solde du compte:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // Objet pour stocker toutes les adresses déployées
    const deployedAddresses = {
        network: "localhost",
        chainId: 31337,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        contracts: {}
    };

    try {
        // ===== ÉTAPE 1: Déployer les tokens de test =====
        console.log("\n📝 === ÉTAPE 1: Déploiement des tokens de test ===");

        const MockERC20Factory = await ethers.getContractFactory("MockERC20");

        // Déployer USDC mock
        console.log("🪙 Déploiement de MockUSDC...");
        const mockUSDC = await MockERC20Factory.deploy("Mock USDC", "USDC");
        await mockUSDC.waitForDeployment();
        const usdcAddress = await mockUSDC.getAddress();
        deployedAddresses.contracts.MockUSDC = usdcAddress;
        console.log("✅ MockUSDC déployé à:", usdcAddress);

        // Déployer WXDAI mock
        console.log("🪙 Déploiement de MockWXDAI...");
        const mockWXDAI = await MockERC20Factory.deploy("Mock Wrapped XDAI", "WXDAI");
        await mockWXDAI.waitForDeployment();
        const wxdaiAddress = await mockWXDAI.getAddress();
        deployedAddresses.contracts.MockWXDAI = wxdaiAddress;
        console.log("✅ MockWXDAI déployé à:", wxdaiAddress);

        // ===== NOUVEAUX TOKENS DE SUPPLY LIQUIDITY =====
        // Déployer armmUSDC (Supply Liquidity Token pour USDC)
        console.log("🏦 Déploiement de armmUSDC...");
        const armmUSDC = await MockERC20Factory.deploy("Aave RMM Variable Supply USDC", "armmUSDC");
        await armmUSDC.waitForDeployment();
        const armmUSDCAddress = await armmUSDC.getAddress();
        deployedAddresses.contracts.armmUSDC = armmUSDCAddress;
        console.log("✅ armmUSDC déployé à:", armmUSDCAddress);

        // Déployer armmWXDAI (Supply Liquidity Token pour WXDAI)
        console.log("🏦 Déploiement de armmWXDAI...");
        const armmWXDAI = await MockERC20Factory.deploy("Aave RMM Variable Supply WXDAI", "armmWXDAI");
        await armmWXDAI.waitForDeployment();
        const armmWXDAIAddress = await armmWXDAI.getAddress();
        deployedAddresses.contracts.armmWXDAI = armmWXDAIAddress;
        console.log("✅ armmWXDAI déployé à:", armmWXDAIAddress);

        // Déployer MockDAOToken
        console.log("🪙 Déploiement de MockDAOToken...");
        const mockDAOToken = await MockERC20Factory.deploy("Mock DAO Token", "DAO");
        await mockDAOToken.waitForDeployment();
        const daoTokenAddress = await mockDAOToken.getAddress();
        deployedAddresses.contracts.MockDAOToken = daoTokenAddress;
        console.log("✅ MockDAOToken déployé à:", daoTokenAddress);

        // ===== ÉTAPE 2: Déployer les tokens de dette =====
        console.log("\n📝 === ÉTAPE 2: Déploiement des tokens de dette ===");

        const MockDebtTokenFactory = await ethers.getContractFactory("MockDebtToken");

        // Déployer debt token pour USDC
        console.log("🏦 Déploiement de MockDebtUSDC...");
        const mockDebtUSDC = await MockDebtTokenFactory.deploy("Aave Variable Debt USDC", "armmv3USDC", usdcAddress);
        await mockDebtUSDC.waitForDeployment();
        const debtUSDCAddress = await mockDebtUSDC.getAddress();
        deployedAddresses.contracts.MockDebtUSDC = debtUSDCAddress;
        console.log("✅ MockDebtUSDC déployé à:", debtUSDCAddress);

        // Déployer debt token pour WXDAI
        console.log("🏦 Déploiement de MockDebtWXDAI...");
        const mockDebtWXDAI = await MockDebtTokenFactory.deploy("Aave Variable Debt WXDAI", "armmv3WXDAI", wxdaiAddress);
        await mockDebtWXDAI.waitForDeployment();
        const debtWXDAIAddress = await mockDebtWXDAI.getAddress();
        deployedAddresses.contracts.MockDebtWXDAI = debtWXDAIAddress;
        console.log("✅ MockDebtWXDAI déployé à:", debtWXDAIAddress);

        // ===== ÉTAPE 3: Déployer le MockRMM =====
        console.log("\n📝 === ÉTAPE 3: Déploiement du MockRMM ===");

        const MockRMMFactory = await ethers.getContractFactory("MockRMM");
        console.log("🏗️ Déploiement de MockRMM avec les paires token/debtToken...");

        // Préparer les tableaux pour le constructeur (SEULEMENT LES STABLECOINS ONT DES DEBT TOKENS)
        const tokens = [usdcAddress, wxdaiAddress];
        const debtTokens = [debtUSDCAddress, debtWXDAIAddress];
        const supplyTokens = [armmUSDCAddress, armmWXDAIAddress]; // Supply tokens pour les withdrawals

        console.log("📋 Configuration des paires:");
        console.log("   - USDC:", usdcAddress, "-> DebtUSDC:", debtUSDCAddress, "-> SupplyUSDC:", armmUSDCAddress);
        console.log("   - WXDAI:", wxdaiAddress, "-> DebtWXDAI:", debtWXDAIAddress, "-> SupplyWXDAI:", armmWXDAIAddress);

        const mockRMM = await MockRMMFactory.deploy(tokens, debtTokens, supplyTokens);
        await mockRMM.waitForDeployment();
        const rmmAddress = await mockRMM.getAddress();
        deployedAddresses.contracts.MockRMM = rmmAddress;
        console.log("✅ MockRMM déployé à:", rmmAddress);

        // ===== ÉTAPE 3.5: Approvisionnement du MockRMM =====
        console.log("\n💰 === ÉTAPE 3.5: Approvisionnement du MockRMM en liquidité ===");

        // Mint 100000 USDC au MockRMM (6 decimales)
        const usdcAmount = ethers.parseUnits("100000", 6);
        await mockUSDC.mint(rmmAddress, usdcAmount);
        console.log(`✅ ${ethers.formatUnits(usdcAmount, 6)} USDC (${usdcAmount} Wei) mintés au MockRMM`);

        // Mint 100000 WXDAI au MockRMM (18 decimales)
        const wxdaiAmount = ethers.parseUnits("100000", 18);
        await mockWXDAI.mint(rmmAddress, wxdaiAmount);
        console.log(`✅ ${ethers.formatUnits(wxdaiAmount, 18)} WXDAI (${wxdaiAmount} Wei) mintés au MockRMM`);

        // Vérifier les balances
        const rmmUsdcBalance = await mockUSDC.balanceOf(rmmAddress);
        const rmmWxdaiBalance = await mockWXDAI.balanceOf(rmmAddress);
        console.log(`📊 Balance MockRMM USDC: ${ethers.formatUnits(rmmUsdcBalance, 6)} USDC (${rmmUsdcBalance} Wei)`);
        console.log(`📊 Balance MockRMM WXDAI: ${ethers.formatUnits(rmmWxdaiBalance, 18)} WXDAI (${rmmWxdaiBalance} Wei)`);

        // ===== ÉTAPE 4: Déployer le contrat principal Rent2Repay =====
        console.log("\n📝 === ÉTAPE 4: Déploiement du contrat Rent2Repay ===");

        const { upgrades } = require("hardhat");
        const Rent2RepayFactory = await ethers.getContractFactory("Rent2Repay");
        console.log("🏠 Déploiement de Rent2Repay avec proxy upgradable...");

        // Le constructeur attend: admin, emergency, operator, rmm, wxdaiToken, wxdaiArmmToken, usdcToken, usdcArmmToken
        const rent2Repay = await upgrades.deployProxy(Rent2RepayFactory, [
            deployer.address, // admin
            deployer.address, // emergency
            deployer.address, // operator
            rmmAddress, // rmm
            wxdaiAddress, // wxdaiToken
            armmWXDAIAddress, // wxdaiArmmToken
            usdcAddress, // usdcToken
            armmUSDCAddress // usdcArmmToken
        ], {
            initializer: 'initialize',
            kind: 'uups'
        });
        await rent2Repay.waitForDeployment();
        const rent2RepayAddress = await rent2Repay.getAddress();
        deployedAddresses.contracts.Rent2Repay = rent2RepayAddress;
        console.log("✅ Rent2Repay déployé à:", rent2RepayAddress);

        // Vérifier que les tokens sont bien configurés
        const wxdaiConfig = await rent2Repay.tokenConfig(wxdaiAddress);
        const usdcConfig = await rent2Repay.tokenConfig(usdcAddress);

        console.log(
            wxdaiConfig.active && wxdaiConfig.token.toLowerCase() === wxdaiAddress.toLowerCase()
                ? "✅ check WXDAI token configuration"
                : "❌ check WXDAI token configuration",
            wxdaiConfig.token
        );
        console.log(
            usdcConfig.active && usdcConfig.token.toLowerCase() === usdcAddress.toLowerCase()
                ? "✅ check USDC token configuration"
                : "❌ check USDC token configuration",
            usdcConfig.token
        );

        // ===== ÉTAPE 5: Configuration initiale =====
        console.log("\n📝 === ÉTAPE 5: Configuration initiale ===");

        // Les paires de tokens sont déjà autorisées par le constructeur
        console.log("✅ Paires de tokens USDC/DebtUSDC et WXDAI/DebtWXDAI pré-autorisées par le constructeur");
        console.log("ℹ️ armmUSDC et armmWXDAI sont des tokens de supply indépendants (pas de remboursement de dette)");

        // Configurer l'adresse de la trésorerie DAO (utilise le déployeur pour les tests)
        await rent2Repay.updateDaoTreasuryAddress(deployer.address);
        console.log("✅ Adresse de la trésorerie DAO configurée:", deployer.address);

        // Configurer le token de réduction des frais DAO
        await rent2Repay.updateDaoFeeReductionToken(daoTokenAddress);
        console.log("✅ Token de réduction des frais DAO configuré:", daoTokenAddress);

        // Vérification de la configuration du token de gouvernance
        const daoConfig = await rent2Repay.getDaoFeeReductionConfiguration();
        console.log(
            daoConfig.token.toLowerCase() === daoTokenAddress.toLowerCase()
                ? "✅ Vérification du token de gouvernance: Configuration correcte"
                : "❌ Vérification du token de gouvernance: ERREUR DE CONFIGURATION",
            "\n   → Attendu:", daoTokenAddress,
            "\n   → Reçu:", daoConfig.token
        );

        // Configurer le montant minimum pour la réduction des frais (1000 tokens)
        const minAmountForFeeReduction = ethers.parseEther("1000");
        await rent2Repay.updateDaoFeeReductionMinimumAmount(minAmountForFeeReduction);
        console.log("✅ Montant minimum pour réduction des frais configuré:", ethers.formatEther(minAmountForFeeReduction));

        // === VÉRIFICATIONS DE CONFIGURATION ===
        console.log("\n🔍 === VÉRIFICATIONS DE CONFIGURATION ===");

        // Vérifier que la configuration complète de réduction des frais DAO est correcte
        const finalDaoConfig = await rent2Repay.getDaoFeeReductionConfiguration();

        console.log("📋 Configuration finale de réduction des frais DAO:");
        console.log(`   🪙 Token de réduction: ${finalDaoConfig.token}`);
        console.log(`   💰 Montant minimum: ${finalDaoConfig.minimumAmount} wei (${ethers.formatEther(finalDaoConfig.minimumAmount)} tokens)`);
        console.log(`   📊 Pourcentage de réduction: ${finalDaoConfig.reductionPercentage} BPS (${Number(finalDaoConfig.reductionPercentage) / 100}%)`);
        console.log(`   🏦 Adresse treasury: ${finalDaoConfig.treasuryAddress}`);

        // Vérifications de sécurité
        const configChecks = {
            tokenSet: finalDaoConfig.token !== ethers.ZeroAddress,
            minimumAmountSet: finalDaoConfig.minimumAmount > 0n,
            treasurySet: finalDaoConfig.treasuryAddress !== ethers.ZeroAddress,
            reductionPercentageValid: finalDaoConfig.reductionPercentage > 0n && finalDaoConfig.reductionPercentage <= 10000n
        };

        console.log("\n✅ Checks de configuration:");
        console.log(`   ${configChecks.tokenSet ? '✅' : '❌'} Token de réduction défini: ${configChecks.tokenSet}`);
        console.log(`   ${configChecks.minimumAmountSet ? '✅' : '❌'} Montant minimum défini: ${configChecks.minimumAmountSet}`);
        console.log(`   ${configChecks.treasurySet ? '✅' : '❌'} Adresse treasury définie: ${configChecks.treasurySet}`);
        console.log(`   ${configChecks.reductionPercentageValid ? '✅' : '❌'} Pourcentage de réduction valide: ${configChecks.reductionPercentageValid}`);

        const allConfigValid = Object.values(configChecks).every(check => check === true);
        console.log(`\n${allConfigValid ? '🎉' : '⚠️'} Configuration des frais DAO: ${allConfigValid ? 'COMPLÈTE ET VALIDE' : 'INCOMPLÈTE OU INVALIDE'}`);

        if (!allConfigValid) {
            console.warn("⚠️ ATTENTION: La configuration des frais DAO n'est pas complète. Certaines fonctionnalités pourraient ne pas fonctionner.");
        }

        // Ajouter des informations de liaison pour les tests
        deployedAddresses.tokenPairs = [
            {
                token: usdcAddress,
                debtToken: debtUSDCAddress,
                name: "USDC",
                symbol: "USDC",
                type: "stablecoin"
            },
            {
                token: wxdaiAddress,
                debtToken: debtWXDAIAddress,
                name: "WXDAI",
                symbol: "WXDAI",
                type: "stablecoin"
            }
        ];

        // Ajouter les tokens de supply séparément (pas de paires dans Rent2Repay)
        deployedAddresses.supplyTokens = [
            {
                token: armmUSDCAddress,
                underlyingAsset: usdcAddress,
                name: "armmUSDC",
                symbol: "armmUSDC",
                type: "supply_liquidity"
            },
            {
                token: armmWXDAIAddress,
                underlyingAsset: wxdaiAddress,
                name: "armmWXDAI",
                symbol: "armmWXDAI",
                type: "supply_liquidity"
            }
        ];

        // Récupérer la configuration réelle depuis le contrat pour la sauvegarder
        const [actualDaoFees, actualSenderTips] = await rent2Repay.getFeeConfiguration();
        const actualDaoConfig = await rent2Repay.getDaoFeeReductionConfiguration();

        deployedAddresses.configuration = {
            daoFeesBPS: Number(actualDaoFees),
            senderTipsBPS: Number(actualSenderTips),
            daoFeeReductionBPS: Number(actualDaoConfig.reductionPercentage),
            daoFeeReductionMinimumAmount: actualDaoConfig.minimumAmount.toString(),
            daoTreasuryAddress: actualDaoConfig.treasuryAddress,
            daoFeeReductionTokenAddress: actualDaoConfig.token
        };

        console.log("\n📊 Configuration sauvegardée (valeurs réelles du contrat):");
        console.log(`   💰 DAO Fees: ${deployedAddresses.configuration.daoFeesBPS} BPS`);
        console.log(`   🎁 Sender Tips: ${deployedAddresses.configuration.senderTipsBPS} BPS`);
        console.log(`   📉 Réduction DAO: ${deployedAddresses.configuration.daoFeeReductionBPS} BPS`);
        console.log(`   💎 Montant minimum: ${deployedAddresses.configuration.daoFeeReductionMinimumAmount} wei`);
        console.log(`   🪙 Token réduction: ${deployedAddresses.configuration.daoFeeReductionTokenAddress}`);
        console.log(`   🏦 Treasury: ${deployedAddresses.configuration.daoTreasuryAddress}`);

        // ===== ÉTAPE 6: Configuration des approbations =====
        console.log("\n📝 === ÉTAPE 6: Configuration des approbations ===");

        // Configurer les approbations pour tous les tokens vers le RMM
        const maxApproval = ethers.MaxUint256; // type(uint256).max

        console.log("🔓 Configuration des approbations pour les tokens vers RMM...");

        // Approbation pour USDC
        await rent2Repay.giveApproval(usdcAddress, rmmAddress, maxApproval);
        console.log("✅ Approbation configurée: USDC → RMM");

        // Approbation pour WXDAI
        await rent2Repay.giveApproval(wxdaiAddress, rmmAddress, maxApproval);
        console.log("✅ Approbation configurée: WXDAI → RMM");

        // Approbation pour armmUSDC (supply token)
        await rent2Repay.giveApproval(armmUSDCAddress, rmmAddress, maxApproval);
        console.log("✅ Approbation configurée: armmUSDC → RMM");

        // Approbation pour armmWXDAI (supply token)
        await rent2Repay.giveApproval(armmWXDAIAddress, rmmAddress, maxApproval);
        console.log("✅ Approbation configurée: armmWXDAI → RMM");

        // Vérifier les approbations directement via IERC20
        console.log("\n🔍 Vérification des approbations:");
        const usdcAllowance = await mockUSDC.allowance(rent2RepayAddress, rmmAddress);
        const wxdaiAllowance = await mockWXDAI.allowance(rent2RepayAddress, rmmAddress);
        const armmUSDCAllowance = await armmUSDC.allowance(rent2RepayAddress, rmmAddress);
        const armmWXDAIAllowance = await armmWXDAI.allowance(rent2RepayAddress, rmmAddress);

        console.log(`   USDC → RMM: ${usdcAllowance.toString()} (${usdcAllowance > 0n ? '✅' : '❌'})`);
        console.log(`   WXDAI → RMM: ${wxdaiAllowance.toString()} (${wxdaiAllowance > 0n ? '✅' : '❌'})`);
        console.log(`   armmUSDC → RMM: ${armmUSDCAllowance.toString()} (${armmUSDCAllowance > 0n ? '✅' : '❌'})`);
        console.log(`   armmWXDAI → RMM: ${armmWXDAIAllowance.toString()} (${armmWXDAIAllowance > 0n ? '✅' : '❌'})`);

        console.log("\n✅ === DÉPLOIEMENT TERMINÉ AVEC SUCCÈS ===");

    } catch (error) {
        console.error("❌ Erreur lors du déploiement:", error);
        process.exit(1);
    }

    // ===== ÉTAPE 7: Sauvegarder les adresses =====
    console.log("\n📝 === ÉTAPE 7: Sauvegarde de la configuration ===");

    const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");
    fs.writeFileSync(configPath, JSON.stringify(deployedAddresses, null, 2));
    console.log("💾 Configuration sauvegardée dans:", configPath);

    // Afficher un résumé
    console.log("\n📊 === RÉSUMÉ DU DÉPLOIEMENT ===");
    console.log("🏠 Rent2Repay:", deployedAddresses.contracts.Rent2Repay);
    console.log("🏗️ MockRMM:", deployedAddresses.contracts.MockRMM);
    console.log("🪙 MockUSDC:", deployedAddresses.contracts.MockUSDC);
    console.log("🪙 MockWXDAI:", deployedAddresses.contracts.MockWXDAI);
    console.log("🏦 armmUSDC:", deployedAddresses.contracts.armmUSDC);
    console.log("🏦 armmWXDAI:", deployedAddresses.contracts.armmWXDAI);
    console.log("🪙 MockDAOToken:", deployedAddresses.contracts.MockDAOToken);
    console.log("🏦 MockDebtUSDC:", deployedAddresses.contracts.MockDebtUSDC);
    console.log("🏦 MockDebtWXDAI:", deployedAddresses.contracts.MockDebtWXDAI);

    console.log("\n🔧 Pour utiliser ces contrats, référez-vous au fichier:", configPath);
    console.log("🎯 Réseau: localhost (http://127.0.0.1:8545)");
    console.log("⛓️ Chain ID: 31337");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 