const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Bibliothèque commune de test pour Rent2Repay
 * Utilisateurs prédéfinis avec leurs rôles et fonctionnalités
 */

// Configuration des utilisateurs de test
const USERS_CONFIG = {
    DEPLOYER: {
        index: 0,
        role: "ADMIN_ROLE",
        description: "Déploie et administre les contrats",
        emoji: "👑"
    },
    CONFIGURATOR: {
        index: 1,
        role: "USER",
        description: "Configure son rent2repay personnel",
        emoji: "⚙️"
    },
    RUNNER_1: {
        index: 2,
        role: "EXECUTOR",
        description: "Exécute les remboursements",
        emoji: "🏃‍♂️"
    },
    OPERATOR: {
        index: 3,
        role: "OPERATOR_ROLE",
        description: "Opérations système",
        emoji: "🔧"
    },
    EMERGENCY: {
        index: 4,
        role: "EMERGENCY_ROLE",
        description: "Arrêt d'urgence",
        emoji: "🚨"
    },
    RUNNER_2: {
        index: 5,
        role: "EXECUTOR",
        description: "Second runner pour tests concurrents",
        emoji: "🏃‍♀️"
    }
};

/**
 * Initialise l'environnement de test avec tous les utilisateurs
 */
async function initTestEnvironment() {
    console.log("🚀 === Initialisation de l'environnement de test ===\n");

    const signers = await ethers.getSigners();
    const users = {};

    // Créer les utilisateurs
    for (const [name, config] of Object.entries(USERS_CONFIG)) {
        if (signers[config.index]) {
            users[name] = {
                signer: signers[config.index],
                address: signers[config.index].address,
                role: config.role,
                description: config.description,
                emoji: config.emoji
            };

            console.log(`${config.emoji} ${name}: ${users[name].address}`);
            console.log(`   └─ Rôle: ${config.role} - ${config.description}\n`);
        }
    }

    return users;
}

/**
 * Charge les contrats déployés et initialise les utilisateurs
 */
async function loadTestEnvironment() {
    const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");

    if (!fs.existsSync(configPath)) {
        throw new Error("❌ Fichier de configuration non trouvé. Exécutez d'abord le script de déploiement.");
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const users = await initTestEnvironment();

    // Charger les instances des contrats
    const contracts = {
        rent2Repay: await ethers.getContractAt("Rent2Repay", config.contracts.Rent2Repay),
        mockRMM: await ethers.getContractAt("MockRMM", config.contracts.MockRMM),
        mockUSDC: await ethers.getContractAt("MockERC20", config.contracts.MockUSDC),
        mockWXDAI: await ethers.getContractAt("MockERC20", config.contracts.MockWXDAI),
        mockDAOToken: await ethers.getContractAt("MockERC20", config.contracts.MockDAOToken),
        mockDebtUSDC: await ethers.getContractAt("MockDebtToken", config.contracts.MockDebtUSDC),
        mockDebtWXDAI: await ethers.getContractAt("MockDebtToken", config.contracts.MockDebtWXDAI),
    };

    return {
        contracts,
        addresses: config.contracts,
        users,
        config,
        tokenPairs: config.tokenPairs || []
    };
}

/**
 * Fonctions de test rapides pour la ligne de commande
 */
const QuickTest = {
    /**
     * Scénario rapide : Configuration d'un utilisateur
     */
    async quickConfig(periodicity = 300) { // 5 minutes par défaut pour les tests
        console.log("⚡ === Test Rapide : Configuration ===\n");

        const { contracts, addresses, users } = await loadTestEnvironment();
        const configurator = users.CONFIGURATOR;

        // Mint des tokens au configurateur
        await contracts.mockUSDC.mint(configurator.address, ethers.parseEther("10000"));
        await contracts.mockWXDAI.mint(configurator.address, ethers.parseEther("10000"));

        // Configuration avec périodicité courte pour les tests
        const usdcAsUser = contracts.mockUSDC.connect(configurator.signer);
        const wxdaiAsUser = contracts.mockWXDAI.connect(configurator.signer);
        const rent2RepayAsUser = contracts.rent2Repay.connect(configurator.signer);

        // Approbations
        await usdcAsUser.approve(addresses.Rent2Repay, ethers.MaxUint256);
        await wxdaiAsUser.approve(addresses.Rent2Repay, ethers.MaxUint256);

        // Configuration
        await rent2RepayAsUser.configureRent2Repay(
            [addresses.MockUSDC, addresses.MockWXDAI],
            [ethers.parseEther("100"), ethers.parseEther("50")], // Petits montants pour les tests
            periodicity
        );

        console.log("✅ Configuration terminée !");
        console.log(`⚙️ Configurateur: ${configurator.address}`);
        console.log(`⏰ Périodicité: ${periodicity} secondes`);
        console.log("💰 USDC: 100/période, WXDAI: 50/période");

        return { contracts, addresses, users, configurator };
    },

    /**
     * Scénario rapide : Exécution d'un remboursement
     */
    async quickRepayment() {
        console.log("⚡ === Test Rapide : Remboursement ===\n");

        const { contracts, addresses, users } = await loadTestEnvironment();
        const configurator = users.CONFIGURATOR;
        const runner = users.RUNNER_1;

        // Créer un scénario de dette
        await contracts.mockDebtUSDC.mint(configurator.address, ethers.parseEther("200"));

        console.log("🏦 Dette créée: 200 USDC");
        console.log(`🏃‍♂️ Runner: ${runner.address}`);

        // Exécuter le remboursement
        const rent2RepayAsRunner = contracts.rent2Repay.connect(runner.signer);

        try {
            const tx = await rent2RepayAsRunner.rent2repay(
                configurator.address,
                addresses.MockUSDC,
                ethers.parseEther("100")
            );

            const receipt = await tx.wait();
            console.log("✅ Remboursement exécuté !");
            console.log(`🧾 TX: ${receipt.hash}`);

            // Vérifier la dette restante
            const remainingDebt = await contracts.mockDebtUSDC.balanceOf(configurator.address);
            console.log(`📊 Dette restante: ${ethers.formatEther(remainingDebt)} USDC`);

        } catch (error) {
            console.log("❌ Erreur:", error.message);
        }

        return { contracts, addresses, users };
    },

    /**
     * Test de concurrence entre deux runners
     */
    async quickConcurrency() {
        console.log("⚡ === Test Rapide : Concurrence ===\n");

        const { contracts, addresses, users } = await loadTestEnvironment();
        const configurator = users.CONFIGURATOR;
        const runner1 = users.RUNNER_1;
        const runner2 = users.RUNNER_2;

        // Créer une dette importante
        await contracts.mockDebtUSDC.mint(configurator.address, ethers.parseEther("1000"));

        console.log("🏦 Dette créée: 1000 USDC");
        console.log(`🏃‍♂️ Runner 1: ${runner1.address}`);
        console.log(`🏃‍♀️ Runner 2: ${runner2.address}`);

        // Lancer les deux remboursements en parallèle
        const rent2RepayAsRunner1 = contracts.rent2Repay.connect(runner1.signer);
        const rent2RepayAsRunner2 = contracts.rent2Repay.connect(runner2.signer);

        const amount = ethers.parseEther("100");

        try {
            const [tx1, tx2] = await Promise.allSettled([
                rent2RepayAsRunner1.rent2repay(configurator.address, addresses.MockUSDC, amount),
                rent2RepayAsRunner2.rent2repay(configurator.address, addresses.MockUSDC, amount)
            ]);

            console.log("📊 Résultats de concurrence:");
            console.log("   Runner 1:", tx1.status === 'fulfilled' ? "✅ Succès" : `❌ ${tx1.reason?.message}`);
            console.log("   Runner 2:", tx2.status === 'fulfilled' ? "✅ Succès" : `❌ ${tx2.reason?.message}`);

            // Vérifier la dette finale
            const finalDebt = await contracts.mockDebtUSDC.balanceOf(configurator.address);
            console.log(`📊 Dette finale: ${ethers.formatEther(finalDebt)} USDC`);

        } catch (error) {
            console.log("❌ Erreur globale:", error.message);
        }

        return { contracts, addresses, users };
    },

    /**
     * Affiche le statut complet d'un utilisateur
     */
    async showUserStatus(userAddress) {
        console.log(`📊 === Statut utilisateur : ${userAddress} ===\n`);

        const { contracts } = await loadTestEnvironment();

        // Balances des tokens
        const usdcBalance = await contracts.mockUSDC.balanceOf(userAddress);
        const wxdaiBalance = await contracts.mockWXDAI.balanceOf(userAddress);
        const debtUSDCBalance = await contracts.mockDebtUSDC.balanceOf(userAddress);
        const debtWXDAIBalance = await contracts.mockDebtWXDAI.balanceOf(userAddress);

        console.log("💰 Assets:");
        console.log(`   USDC: ${ethers.formatEther(usdcBalance)}`);
        console.log(`   WXDAI: ${ethers.formatEther(wxdaiBalance)}`);

        console.log("\n🏦 Dettes:");
        console.log(`   Debt USDC: ${ethers.formatEther(debtUSDCBalance)}`);
        console.log(`   Debt WXDAI: ${ethers.formatEther(debtWXDAIBalance)}`);

        // Configuration Rent2Repay
        try {
            const userConfig = await contracts.rent2Repay.getUserConfiguration(userAddress);
            console.log("\n⚙️ Configuration Rent2Repay:");
            console.log(`   Configuré: ${userConfig.isConfigured ? "✅" : "❌"}`);
            if (userConfig.isConfigured) {
                console.log(`   Périodicité: ${userConfig.periodicity} secondes`);
                console.log(`   Prochaine exécution: ${new Date(Number(userConfig.nextExecution) * 1000)}`);
            }
        } catch (error) {
            console.log("\n⚙️ Configuration Rent2Repay: ❌ Non accessible");
        }
    }
};

module.exports = {
    USERS_CONFIG,
    initTestEnvironment,
    loadTestEnvironment,
    QuickTest
}; 