const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

async function main() {
    // Récupérer l'argument de ligne de commande
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log("❌ Usage: node scripts/whois.js <signer_index>");
        console.log("   Exemple: node scripts/whois.js 0");
        process.exit(1);
    }

    async function connectToNetwork(network = "localhost") {
        const networkConfig = hre.config.networks[network];
        if (!networkConfig || !networkConfig.url) {
            throw new Error(`Network config for '${network}' not found in hardhat.config.js`);
        }

        const provider = new ethers.JsonRpcProvider(networkConfig.url);
        const accounts = await provider.listAccounts();

        const { signers } = await connectToNetwork("localhost");
        return { provider, signers };
    }

    const signerIndex = parseInt(args[0]);
    if (isNaN(signerIndex) || signerIndex < 0) {
        console.log("❌ L'index du signer doit être un nombre positif");
        process.exit(1);
    }

    console.log(`🔍 Analyse du signer ${signerIndex}...\n`);

    // Charger la configuration déployée
    const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");
    if (!fs.existsSync(configPath)) {
        throw new Error("❌ Fichier de configuration non trouvé. Exécutez d'abord le script de déploiement.");
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Récupérer les signers
    const signers = await ethers.getSigners();
    if (signerIndex >= signers.length) {
        console.log(`❌ Index ${signerIndex} trop élevé. Il y a ${signers.length} signers disponibles (0-${signers.length - 1})`);
        process.exit(1);
    }

    const targetSigner = signers[signerIndex];
    const targetAddress = targetSigner.address;

    // Charger les contrats
    const rent2Repay = await ethers.getContractAt("Rent2Repay", config.contracts.Rent2Repay);
    const mockUSDC = await ethers.getContractAt("MockERC20", config.contracts.MockUSDC);
    const mockWXDAI = await ethers.getContractAt("MockERC20", config.contracts.MockWXDAI);
    const mockDebtUSDC = await ethers.getContractAt("MockDebtToken", config.contracts.MockDebtUSDC);
    const mockDebtWXDAI = await ethers.getContractAt("MockDebtToken", config.contracts.MockDebtWXDAI);

    // Informations de base
    console.log("👤 INFORMATIONS UTILISATEUR");
    console.log("=".repeat(50));
    console.log(`Index Signer: ${signerIndex}`);
    console.log(`Adresse: ${targetAddress}`);

    //const usdcBalance = await mockUSDC.balanceOf(targetAddress);
    //console.log(`   Dette USDC: ${ethers.formatEther(usdcBalance)} usdcBalance`);

    // Déterminer le rôle de l'utilisateur
    let userRole = "Utilisateur standard";
    if (signerIndex === 0) {
        userRole = "Déployeur/Admin";
    } else if (signerIndex === 1) {
        userRole = "Utilisateur de test";
    } else if (signerIndex >= 2) {
        userRole = `Runner ${signerIndex - 1}`;
    }
    console.log(`Rôle présumé: ${userRole}`);

    console.log("\n🔐 RÔLES DANS RENT2REPAY");
    console.log("=".repeat(50));

    try {
        const [isAdmin, isOperator, isEmergency] = await rent2Repay.connect(targetSigner).whoami();

        if (isAdmin) console.log("✅ DEFAULT_ADMIN_ROLE");
        if (isOperator) console.log("✅ OPERATOR_ROLE");
        if (isEmergency) console.log("✅ EMERGENCY_ROLE");

        if (!isAdmin && !isOperator && !isEmergency) {
            console.log("❌ Aucun rôle spécial");
        }
    } catch (error) {
        console.log("❌ Erreur lors de la vérification des rôles via whoami():", error.message);
    }

    // Configuration Rent2Repay
    console.log("\n⚙️  CONFIGURATION RENT2REPAY");
    console.log("=".repeat(50));

    try {
        const isAuthorized = await rent2Repay.isAuthorized(targetAddress);
        console.log(`Autorisé pour Rent2Repay: ${isAuthorized ? '✅ Oui' : '❌ Non'}`);

        if (isAuthorized) {
            // Récupérer les configurations pour chaque token
            const [userTokens, userAmounts] = await rent2Repay.getUserConfigs(targetAddress);

            if (userTokens.length > 0) {
                console.log("\nConfigurations par token:");
                for (let i = 0; i < userTokens.length; i++) {
                    const tokenAddr = userTokens[i];
                    let tokenName = "Token inconnu";

                    if (tokenAddr.toLowerCase() === config.contracts.MockUSDC.toLowerCase()) {
                        tokenName = "USDC";
                    } else if (tokenAddr.toLowerCase() === config.contracts.MockWXDAI.toLowerCase()) {
                        tokenName = "WXDAI";
                    }

                    console.log(`  - ${tokenName}: ${ethers.formatUnits(userAmounts[i], tokenName === "USDC" ? 6 : 18)} ${tokenName}/période`);
                }

                // Récupérer la périodicité et le dernier remboursement
                const periodicity = await rent2Repay.periodicity(targetAddress);
                const lastRepayTimestamp = await rent2Repay.lastRepayTimestamps(targetAddress);

                console.log(`Périodicité: ${periodicity} secondes`);
                console.log(`Dernier remboursement: ${lastRepayTimestamp.toString() === '0' ? 'Jamais' : new Date(Number(lastRepayTimestamp) * 1000).toLocaleString()}`);
            }
        }
    } catch (error) {
        console.log("❌ Erreur lors de la récupération de la configuration:", error.message);
    }

    // Tableau récapitulatif des tokens
    console.log("\n💰 TABLEAU RÉCAPITULATIF DES TOKENS");
    console.log("=".repeat(80));
    console.log("Token     | Balance                    | Approved vers Rent2Repay");
    console.log("-".repeat(80));

    const rent2RepayAddress = await rent2Repay.getAddress();

    // Fonction helper pour formater les montants
    const formatBalance = (balance, decimals, symbol) => {
        const formatted = ethers.formatUnits(balance, decimals);
        return `${formatted} ${symbol}`.padEnd(26);
    };

    try {
        // USDC
        const usdcBalance = await mockUSDC.balanceOf(targetAddress);
        const usdcApproved = await mockUSDC.allowance(targetAddress, rent2RepayAddress);
        console.log(`USDC      | ${formatBalance(usdcBalance, 6, "USDC")} | ${ethers.formatUnits(usdcApproved, 6)} USDC`);

        // Debt USDC
        const debtUsdcBalance = await mockDebtUSDC.balanceOf(targetAddress);
        const debtUsdcApproved = await mockDebtUSDC.allowance(targetAddress, rent2RepayAddress);
        console.log(`dUSDC     | ${formatBalance(debtUsdcBalance, 18, "dUSDC")} | ${ethers.formatEther(debtUsdcApproved)} dUSDC`);

        // WXDAI
        const wxdaiBalance = await mockWXDAI.balanceOf(targetAddress);
        const wxdaiApproved = await mockWXDAI.allowance(targetAddress, rent2RepayAddress);
        console.log(`WXDAI     | ${formatBalance(wxdaiBalance, 18, "WXDAI")} | ${ethers.formatEther(wxdaiApproved)} WXDAI`);

        // Debt WXDAI
        const debtWxdaiBalance = await mockDebtWXDAI.balanceOf(targetAddress);
        const debtWxdaiApproved = await mockDebtWXDAI.allowance(targetAddress, rent2RepayAddress);
        console.log(`dWXDAI    | ${formatBalance(debtWxdaiBalance, 18, "dWXDAI")} | ${ethers.formatEther(debtWxdaiApproved)} dWXDAI`);

        // DAO Token (si configuré)
        const daoConfig = await rent2Repay.getDaoFeeReductionConfiguration();
        if (daoConfig.token !== ethers.ZeroAddress) {
            try {
                const daoToken = await ethers.getContractAt("IERC20", daoConfig.token);
                const daoBalance = await daoToken.balanceOf(targetAddress);
                const daoApproved = await daoToken.allowance(targetAddress, rent2RepayAddress);
                console.log(`DAO Token | ${formatBalance(daoBalance, 18, "DAO")} | ${ethers.formatEther(daoApproved)} DAO`);
            } catch (error) {
                console.log(`DAO Token | Non disponible             | Non disponible`);
            }
        } else {
            console.log(`DAO Token | Non configuré              | Non configuré`);
        }

    } catch (error) {
        console.log("❌ Erreur lors de la récupération des balances:", error.message);
    }

    console.log("-".repeat(80));
    console.log("✅ Analyse terminée\n");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }); 