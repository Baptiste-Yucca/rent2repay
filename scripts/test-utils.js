const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Utilitaires pour tester les contrats déployés en local
 * Usage: const { loadContracts, testHelper } = require('./scripts/test-utils.js');
 */

/**
 * Charge les contrats déployés depuis le fichier de configuration
 * @returns {Object} Objet contenant les instances des contrats et leurs adresses
 */
async function loadContracts() {
    const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");

    if (!fs.existsSync(configPath)) {
        throw new Error("❌ Fichier de configuration non trouvé. Exécutez d'abord le script de déploiement.");
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log("📋 Configuration chargée depuis:", configPath);
    console.log("🌐 Réseau:", config.network, "- Chain ID:", config.chainId);

    // Récupérer les signers
    const [deployer, user1, user2] = await ethers.getSigners();

    // Charger les instances des contrats
    const contracts = {
        // Contrat principal
        rent2Repay: await ethers.getContractAt("Rent2Repay", config.contracts.Rent2Repay),

        // Mock RMM
        mockRMM: await ethers.getContractAt("MockRMM", config.contracts.MockRMM),

        // Tokens de test
        mockUSDC: await ethers.getContractAt("MockERC20", config.contracts.MockUSDC),
        mockWXDAI: await ethers.getContractAt("MockERC20", config.contracts.MockWXDAI),
        mockDAOToken: await ethers.getContractAt("MockERC20", config.contracts.MockDAOToken),

        // Tokens de dette
        mockDebtUSDC: await ethers.getContractAt("MockDebtToken", config.contracts.MockDebtUSDC),
        mockDebtWXDAI: await ethers.getContractAt("MockDebtToken", config.contracts.MockDebtWXDAI),
    };

    const addresses = config.contracts;
    const signers = { deployer, user1, user2 };
    const tokenPairs = config.tokenPairs || [];
    const configuration = config.configuration || {};

    return {
        contracts,
        addresses,
        signers,
        tokenPairs,
        configuration,
        config
    };
}

/**
 * Fonctions d'aide pour les tests
 */
const testHelper = {
    /**
     * Affiche les balances d'un utilisateur pour tous les tokens
     */
    async showBalances(userAddress, contracts) {
        console.log(`\n💰 === Balances pour ${userAddress} ===`);

        const usdcBalance = await contracts.mockUSDC.balanceOf(userAddress);
        const wxdaiBalance = await contracts.mockWXDAI.balanceOf(userAddress);
        const daoBalance = await contracts.mockDAOToken.balanceOf(userAddress);
        const debtUSDCBalance = await contracts.mockDebtUSDC.balanceOf(userAddress);
        const debtWXDAIBalance = await contracts.mockDebtWXDAI.balanceOf(userAddress);

        console.log("🪙 USDC:", ethers.formatEther(usdcBalance));
        console.log("🪙 WXDAI:", ethers.formatEther(wxdaiBalance));
        console.log("🪙 DAO Token:", ethers.formatEther(daoBalance));
        console.log("🏦 Debt USDC:", ethers.formatEther(debtUSDCBalance));
        console.log("🏦 Debt WXDAI:", ethers.formatEther(debtWXDAIBalance));
    },

    /**
     * Mint des tokens de test à un utilisateur
     */
    async mintTokens(userAddress, contracts, amounts = {}) {
        console.log(`\n🪙 === Mint de tokens pour ${userAddress} ===`);

        const defaultAmounts = {
            usdc: "10000",
            wxdai: "10000",
            daoToken: "1000",
            debtUSDC: "5000",
            debtWXDAI: "5000"
        };

        const finalAmounts = { ...defaultAmounts, ...amounts };

        if (finalAmounts.usdc) {
            await contracts.mockUSDC.mint(userAddress, ethers.parseEther(finalAmounts.usdc));
            console.log("✅ USDC minté:", finalAmounts.usdc);
        }

        if (finalAmounts.wxdai) {
            await contracts.mockWXDAI.mint(userAddress, ethers.parseEther(finalAmounts.wxdai));
            console.log("✅ WXDAI minté:", finalAmounts.wxdai);
        }

        if (finalAmounts.daoToken) {
            await contracts.mockDAOToken.mint(userAddress, ethers.parseEther(finalAmounts.daoToken));
            console.log("✅ DAO Token minté:", finalAmounts.daoToken);
        }

        if (finalAmounts.debtUSDC) {
            await contracts.mockDebtUSDC.mint(userAddress, ethers.parseEther(finalAmounts.debtUSDC));
            console.log("✅ Debt USDC minté:", finalAmounts.debtUSDC);
        }

        if (finalAmounts.debtWXDAI) {
            await contracts.mockDebtWXDAI.mint(userAddress, ethers.parseEther(finalAmounts.debtWXDAI));
            console.log("✅ Debt WXDAI minté:", finalAmounts.debtWXDAI);
        }
    },

    /**
     * Configure Rent2Repay pour un utilisateur
     */
    async configureRent2Repay(userSigner, contracts, addresses, config = {}) {
        console.log(`\n⚙️ === Configuration Rent2Repay pour ${userSigner.address} ===`);

        const defaultConfig = {
            tokensToAuthorize: [addresses.MockUSDC, addresses.MockWXDAI],
            weeklyAmounts: [ethers.parseEther("1000"), ethers.parseEther("500")], // 1000 USDC, 500 WXDAI par semaine
            periodicity: 7 * 24 * 60 * 60 // 7 jours en secondes
        };

        const finalConfig = { ...defaultConfig, ...config };

        // Connecter le contrat avec le signer de l'utilisateur
        const rent2RepayAsUser = contracts.rent2Repay.connect(userSigner);

        // Approuver les tokens pour que Rent2Repay puisse les utiliser
        const usdcAsUser = contracts.mockUSDC.connect(userSigner);
        const wxdaiAsUser = contracts.mockWXDAI.connect(userSigner);

        console.log("🔓 Approbation des tokens...");
        await usdcAsUser.approve(addresses.Rent2Repay, ethers.MaxUint256);
        await wxdaiAsUser.approve(addresses.Rent2Repay, ethers.MaxUint256);
        console.log("✅ Approbations effectuées");

        // Configurer Rent2Repay
        console.log("⚙️ Configuration de Rent2Repay...");
        await rent2RepayAsUser.configureRent2Repay(
            finalConfig.tokensToAuthorize,
            finalConfig.weeklyAmounts,
            finalConfig.periodicity
        );
        console.log("✅ Rent2Repay configuré avec succès");

        // Afficher la configuration
        console.log("📋 Configuration appliquée:");
        for (let i = 0; i < finalConfig.tokensToAuthorize.length; i++) {
            const tokenSymbol = finalConfig.tokensToAuthorize[i] === addresses.MockUSDC ? "USDC" : "WXDAI";
            console.log(`   - ${tokenSymbol}: ${ethers.formatEther(finalConfig.weeklyAmounts[i])} par semaine`);
        }
        console.log(`   - Périodicité: ${finalConfig.periodicity / (24 * 60 * 60)} jours`);
    },

    /**
 * Exécute un remboursement pour un utilisateur
 */
    async executeRepayment(executorSigner, userAddress, tokenAddress, amount, contracts) {
        console.log(`\n💸 === Exécution d'un remboursement ===`);
        console.log("👤 Utilisateur:", userAddress);
        console.log("🪙 Token:", tokenAddress);
        console.log("💰 Montant:", ethers.formatEther(amount));
        console.log("🚀 Exécuteur:", executorSigner.address);

        const rent2RepayAsExecutor = contracts.rent2Repay.connect(executorSigner);

        try {
            // Vérifier le token de dette correspondant
            const debtTokenAddress = await contracts.mockRMM.getDebtToken(tokenAddress);
            console.log("🏦 Token de dette correspondant:", debtTokenAddress);
            console.log("📊 Dette avant remboursement:", ethers.formatEther(await contracts.mockDebtUSDC.balanceOf(userAddress)));

            const tx = await rent2RepayAsExecutor.executeRepayment(userAddress, tokenAddress, amount);
            const receipt = await tx.wait();

            console.log("✅ Remboursement exécuté avec succès");
            console.log("🧾 Transaction hash:", receipt.hash);
            console.log("📊 Dette après remboursement:", ethers.formatEther(await contracts.mockDebtUSDC.balanceOf(userAddress)));

            // Afficher les events
            receipt.logs.forEach(log => {
                try {
                    const parsedLog = contracts.rent2Repay.interface.parseLog(log);
                    if (parsedLog.name === 'RepaymentExecuted') {
                        console.log("📊 Event RepaymentExecuted:");
                        console.log("   - Montant remboursé:", ethers.formatEther(parsedLog.args.amount));
                        console.log("   - Restant cette semaine:", ethers.formatEther(parsedLog.args.remainingThisWeek));
                    }
                } catch (e) {
                    // Log non parsable, on ignore
                }
            });

        } catch (error) {
            console.error("❌ Erreur lors du remboursement:", error.message);
        }
    },

    /**
 * Affiche le statut Rent2Repay d'un utilisateur
 */
    async showUserStatus(userAddress, contracts, addresses) {
        console.log(`\n📊 === Statut Rent2Repay pour ${userAddress} ===`);

        // Vérifier les montants autorisés
        const usdcAmount = await contracts.rent2Repay.allowedMaxAmounts(userAddress, addresses.MockUSDC);
        const wxdaiAmount = await contracts.rent2Repay.allowedMaxAmounts(userAddress, addresses.MockWXDAI);
        const lastRepay = await contracts.rent2Repay.lastRepayTimestamps(userAddress);
        const periodicity = await contracts.rent2Repay.periodicity(userAddress);

        console.log("💰 Montants autorisés par semaine:");
        console.log("   - USDC:", ethers.formatEther(usdcAmount));
        console.log("   - WXDAI:", ethers.formatEther(wxdaiAmount));
        console.log("⏰ Dernier remboursement:", new Date(Number(lastRepay) * 1000).toLocaleString());
        console.log("🔄 Périodicité:", Number(periodicity) / (24 * 60 * 60), "jours");
    },

    /**
     * Prépare un scénario de test avec dettes
     */
    async setupDebtScenario(userAddress, contracts, amounts = {}) {
        console.log(`\n🏦 === Préparation d'un scénario avec dettes pour ${userAddress} ===`);

        const defaultAmounts = {
            debtUSDC: "2000",
            debtWXDAI: "1500"
        };

        const finalAmounts = { ...defaultAmounts, ...amounts };

        // Mint des tokens de dette
        if (finalAmounts.debtUSDC) {
            await contracts.mockDebtUSDC.mint(userAddress, ethers.parseEther(finalAmounts.debtUSDC));
            console.log("✅ Dette USDC créée:", finalAmounts.debtUSDC);
        }

        if (finalAmounts.debtWXDAI) {
            await contracts.mockDebtWXDAI.mint(userAddress, ethers.parseEther(finalAmounts.debtWXDAI));
            console.log("✅ Dette WXDAI créée:", finalAmounts.debtWXDAI);
        }

        // Approuver les tokens de dette pour le MockRMM (pour permettre le transfert vers address(0))
        const debtUSDCAsUser = contracts.mockDebtUSDC.connect(await ethers.getSigner(userAddress));
        const debtWXDAIAsUser = contracts.mockDebtWXDAI.connect(await ethers.getSigner(userAddress));

        await debtUSDCAsUser.approve(contracts.mockRMM.getAddress(), ethers.MaxUint256);
        await debtWXDAIAsUser.approve(contracts.mockRMM.getAddress(), ethers.MaxUint256);
        console.log("✅ Approbations des tokens de dette effectuées");

        console.log("📊 Dettes créées avec succès !");
    }
};

/**
 * Script de test rapide - à exécuter avec: npx hardhat run scripts/test-utils.js --network localhost
 */
async function quickTest() {
    try {
        console.log("🧪 === Test rapide des contrats déployés ===");

        const { contracts, addresses, signers } = await loadContracts();
        const { deployer, user1, user2 } = signers;

        // Afficher les balances initiales
        await testHelper.showBalances(user1.address, contracts);

        // Mint des tokens pour user1
        await testHelper.mintTokens(user1.address, contracts);

        // Afficher les nouvelles balances
        await testHelper.showBalances(user1.address, contracts);

        // Configurer Rent2Repay pour user1
        await testHelper.configureRent2Repay(user1, contracts, addresses);

        // Afficher le statut de user1
        await testHelper.showUserStatus(user1.address, contracts, addresses);

        console.log("✅ Test rapide terminé avec succès!");

    } catch (error) {
        console.error("❌ Erreur dans quickTest:", error);
    }
}

// Si ce script est exécuté directement, lancer le test rapide
if (require.main === module) {
    quickTest()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    loadContracts,
    testHelper,
    quickTest
}; 