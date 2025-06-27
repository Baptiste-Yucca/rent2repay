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

        // Déployer le token de gouvernance à une adresse spécifique
        console.log("🪙 Déploiement du token de gouvernance à l'adresse spécifique...");
        const { network } = require("hardhat");
        const mockDAOFactory = await ethers.getContractFactory("MockERC20");
        await network.provider.send("hardhat_setCode", [
            "0x6382856a731Af535CA6aea8D364FCE67457da438",
            mockDAOFactory.bytecode
        ]);
        const daoTokenAddress = "0x6382856a731Af535CA6aea8D364FCE67457da438";
        const mockDAOToken = mockDAOFactory.attach(daoTokenAddress);
        await mockDAOToken.waitForDeployment();
        deployedAddresses.contracts.DAOToken = daoTokenAddress;
        console.log("✅ Token de gouvernance déployé à l'adresse spécifique:", daoTokenAddress);

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

        // Préparer les tableaux pour le constructeur
        const tokens = [usdcAddress, wxdaiAddress];
        const debtTokens = [debtUSDCAddress, debtWXDAIAddress];

        console.log("📋 Configuration des paires:");
        console.log("   - USDC:", usdcAddress, "-> DebtUSDC:", debtUSDCAddress);
        console.log("   - WXDAI:", wxdaiAddress, "-> DebtWXDAI:", debtWXDAIAddress);

        const mockRMM = await MockRMMFactory.deploy(tokens, debtTokens);
        await mockRMM.waitForDeployment();
        const rmmAddress = await mockRMM.getAddress();
        deployedAddresses.contracts.MockRMM = rmmAddress;
        console.log("✅ MockRMM déployé à:", rmmAddress);

        // ===== ÉTAPE 4: Déployer le contrat principal Rent2Repay =====
        console.log("\n📝 === ÉTAPE 4: Déploiement du contrat Rent2Repay ===");

        const Rent2RepayFactory = await ethers.getContractFactory("Rent2Repay");
        console.log("🏠 Déploiement de Rent2Repay...");

        // Le constructeur attend: admin, emergency, operator, rmm, wxdaiToken, wxdaiDebtToken, usdcToken, usdcDebtToken
        const rent2Repay = await Rent2RepayFactory.deploy(
            deployer.address, // admin
            deployer.address, // emergency
            deployer.address, // operator
            rmmAddress, // rmm
            wxdaiAddress, // wxdaiToken
            debtWXDAIAddress, // wxdaiDebtToken
            usdcAddress, // usdcToken
            debtUSDCAddress // usdcDebtToken
        );
        await rent2Repay.waitForDeployment();
        const rent2RepayAddress = await rent2Repay.getAddress();
        deployedAddresses.contracts.Rent2Repay = rent2RepayAddress;
        console.log("✅ Rent2Repay déployé à:", rent2RepayAddress);
        const deployedUSDCdebtaddr = await rent2Repay.getDebtToken(usdcAddress);
        const deployedWXDAIdebtaddr = await rent2Repay.getDebtToken(wxdaiAddress);

        console.log(
            deployedUSDCdebtaddr.toLowerCase() === debtUSDCAddress.toLowerCase()
                ? "✅ check debtUSDC address"
                : "❌ check debtUSDC address",
            deployedUSDCdebtaddr
        );
        console.log(
            deployedWXDAIdebtaddr.toLowerCase() === debtWXDAIAddress.toLowerCase()
                ? "✅ check debtWXDAI address"
                : "❌ check debtWXDAI address",
            deployedWXDAIdebtaddr
        );

        // ===== ÉTAPE 5: Configuration initiale =====
        console.log("\n📝 === ÉTAPE 5: Configuration initiale ===");

        // Les paires de tokens sont déjà autorisées par le constructeur
        console.log("✅ Paires de tokens USDC/DebtUSDC et WXDAI/DebtWXDAI pré-autorisées par le constructeur");

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

        // Ajouter des informations de liaison pour les tests
        deployedAddresses.tokenPairs = [
            {
                token: usdcAddress,
                debtToken: debtUSDCAddress,
                name: "USDC",
                symbol: "USDC"
            },
            {
                token: wxdaiAddress,
                debtToken: debtWXDAIAddress,
                name: "WXDAI",
                symbol: "WXDAI"
            }
        ];

        // Ajouter des informations de configuration
        deployedAddresses.configuration = {
            daoFeesBPS: 50, // 0.5%
            senderTipsBPS: 25, // 0.25%
            daoFeeReductionBPS: 5000, // 50%
            daoFeeReductionMinimumAmount: minAmountForFeeReduction.toString(),
            daoTreasuryAddress: deployer.address,
            daoFeeReductionTokenAddress: daoTokenAddress
        };

        console.log("\n✅ === DÉPLOIEMENT TERMINÉ AVEC SUCCÈS ===");

    } catch (error) {
        console.error("❌ Erreur lors du déploiement:", error);
        process.exit(1);
    }

    // ===== ÉTAPE 6: Sauvegarder les adresses =====
    console.log("\n📝 === ÉTAPE 6: Sauvegarde de la configuration ===");

    const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");
    fs.writeFileSync(configPath, JSON.stringify(deployedAddresses, null, 2));
    console.log("💾 Configuration sauvegardée dans:", configPath);

    // Afficher un résumé
    console.log("\n📊 === RÉSUMÉ DU DÉPLOIEMENT ===");
    console.log("🏠 Rent2Repay:", deployedAddresses.contracts.Rent2Repay);
    console.log("🏗️ MockRMM:", deployedAddresses.contracts.MockRMM);
    console.log("🪙 MockUSDC:", deployedAddresses.contracts.MockUSDC);
    console.log("🪙 MockWXDAI:", deployedAddresses.contracts.MockWXDAI);
    console.log("🪙 MockDAOToken:", deployedAddresses.contracts.DAOToken);
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