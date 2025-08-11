#!/usr/bin/env node

const path = require("path");

// Chargement des variables d'environnement depuis la racine du projet
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { ethers } = require("hardhat");
const fs = require("fs");

// Mapping des tokens avec leurs tickers et adresses supply/debt
const TOKEN_MAPPINGS = {
    "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d": {
        ticker: "WXDAI",
        supply: "0x0cA4f5554Dd9Da6217d62D8df2816c82bba4157b",
        debt: "0x9908801dF7902675C3FEDD6Fea0294D18D5d5d34"
    },
    "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83": {
        ticker: "USDC",
        supply: "0xeD56F76E9cBC6A64b821e9c016eAFbd3db5436D1",
        debt: "0x69c731aE5f5356a779f44C355aBB685d84e5E9e6"
    }
};

// Remplacer cette section hardcodée :
// const RENT2REPAY_ABI = [
//     "function getUserConfigs(address user) external view returns (tuple(address token, uint256 allowedMaxAmount, uint256 periodicity, uint256 lastRepayTimestamp, uint256 totalRepaid, uint256 totalFeesPaid)[])"
// ];

// Par cette importation dynamique :
const RENT2REPAY_ARTIFACT_PATH = path.join(__dirname, "..", "..", "artifacts", "contracts", "Rent2Repay.sol", "Rent2Repay.json");

async function main() {
    // Vérification des arguments
    if (process.argv.length < 3) {
        console.log("❌ Usage: node tenderly-getuser.js <ADRESSE_UTILISATEUR>");
        console.log("   Exemple: node tenderly-getuser.js 0x1234567890abcdef...");
        process.exit(1);
    }

    const userAddress = process.argv[2];

    // Vérification du format de l'adresse
    if (!ethers.isAddress(userAddress)) {
        console.log("❌ Adresse invalide:", userAddress);
        process.exit(1);
    }

    // Vérification de la variable d'environnement
    if (!process.env.TENDERLY_RPC_URL) {
        console.log("❌ Variable TENDERLY_RPC_URL manquante dans .env");
        console.log("   Ajoutez: TENDERLY_RPC_URL=https://virtual.gnosis.eu.rpc.tenderly.co/...");
        process.exit(1);
    }

    try {
        console.log("🔍 Connexion au réseau Tenderly...");
        console.log(`   RPC: ${process.env.TENDERLY_RPC_URL.substring(0, 50)}...`);
        console.log(`   Utilisateur: ${userAddress}`);
        console.log("");

        // Chargement de l'ABI depuis l'artifact Hardhat
        if (!fs.existsSync(RENT2REPAY_ARTIFACT_PATH)) {
            console.log("❌ Artifact Rent2Repay introuvable");
            console.log("   Exécutez d'abord: npx hardhat compile");
            process.exit(1);
        }

        const rent2RepayArtifact = JSON.parse(fs.readFileSync(RENT2REPAY_ARTIFACT_PATH, "utf8"));
        const RENT2REPAY_ABI = rent2RepayArtifact.abi;

        // Connexion au provider Tenderly
        const provider = new ethers.JsonRpcProvider(process.env.TENDERLY_RPC_URL);

        // Récupération de l'adresse du contrat déployé
        const deployedContractsPath = path.join(__dirname, "..", "tmp", "deployed-tenderly.json");
        if (!fs.existsSync(deployedContractsPath)) {
            console.log("❌ Fichier deployed-contracts.json introuvable");
            console.log("   Exécutez d'abord: npx hardhat run scripts/deploy-tenderly-gpt.js --network tenderly");
            process.exit(1);
        }

        const deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, "utf8"));
        const rent2RepayAddress = '0x4370aeef016c2559f679f9874be07b26b396b8e1'; //deployedContracts.rent2Repay?.address || deployedContracts.proxy?.address;


        console.log(`🏗️ Contrat Rent2Repay: ${rent2RepayAddress}`);
        console.log("");

        // Création de l'instance du contrat
        const rent2Repay = new ethers.Contract(rent2RepayAddress, RENT2REPAY_ABI, provider);

        // Appel de getUserConfigs
        console.log("📞 Appel de getUserConfigs...");
        const userConfigs = await rent2Repay.getUserConfigs(userAddress);

        console.log("✅ Résultat:");
        console.log("");

        // Affichage simple et direct
        console.log("📊 Structure des données:");
        console.log(`   Type de retour: ${typeof userConfigs}`);
        console.log(`   Nombre de tokens: ${userConfigs.tokens ? userConfigs.tokens.length : 'N/A'}`);
        console.log("");
        const isAuthorized = await rent2Repay.isAuthorized(userAddress);
        console.log(`   ✅ Utilisateur autorisé: ${isAuthorized}`);

        if (userConfigs.tokens && userConfigs.tokens.length > 0) {
            console.log("🔍 Détails par token:");

            // Récupérer le timestamp global de l'utilisateur
            const lastRepayTimestamp = await rent2Repay.lastRepayTimestamps(userAddress);

            for (let i = 0; i < userConfigs.tokens.length; i++) {
                const token = userConfigs.tokens[i];
                const maxAmount = userConfigs.maxAmounts[i];
                const tokenInfo = TOKEN_MAPPINGS[token] || { ticker: "UNKNOWN", supply: "N/A", debt: "N/A" };

                // Récupérer la periodicity pour ce token
                const periodicity = await rent2Repay.periodicity(userAddress, token);
                const maxAmountSpecific = await rent2Repay.allowedMaxAmounts(userAddress, token);

                // Récupérer le balanceOf de l'utilisateur pour ce token
                const tokenContract = new ethers.Contract(token, ['function balanceOf(address) view returns (uint256)'], provider);
                const balance = await tokenContract.balanceOf(userAddress);

                // Récupérer les balances supply et debt si le token est connu
                let supplyBalance = "N/A";
                let debtBalance = "N/A";

                if (tokenInfo.supply !== "N/A") {
                    try {
                        const supplyContract = new ethers.Contract(tokenInfo.supply, ['function balanceOf(address) view returns (uint256)'], provider);
                        supplyBalance = (await supplyContract.balanceOf(userAddress)).toString();
                    } catch (error) {
                        supplyBalance = "Erreur";
                    }
                }

                if (tokenInfo.debt !== "N/A") {
                    try {
                        const debtContract = new ethers.Contract(tokenInfo.debt, ['function balanceOf(address) view returns (uint256)'], provider);
                        debtBalance = (await debtContract.balanceOf(userAddress)).toString();
                    } catch (error) {
                        debtBalance = "Erreur";
                    }
                }

                console.log(`   Token ${i + 1}:`);
                console.log(`     Ticker: ${tokenInfo.ticker}`);
                console.log(`     Adresse: ${token}`);
                console.log(`     Max Amount: ${maxAmount.toString()} - balanceOf: ${balance.toString()} ${Number(balance) >= Number(maxAmount) ? '✅ OK' : '❌ KO'}`);
                console.log(`     Max Amount Specific: ${maxAmountSpecific.toString()}`);
                if (tokenInfo.supply !== "N/A") {
                    console.log(`     Supply Token (${tokenInfo.supply}): ${supplyBalance}`);
                }

                if (tokenInfo.debt !== "N/A") {
                    console.log(`     Debt Token (${tokenInfo.debt}): ${debtBalance}`);
                }

                console.log(`     Periodicity: ${periodicity.toString()} secondes (${Math.floor(Number(periodicity) / 3600)}h ${Math.floor((Number(periodicity) % 3600) / 60)}m)`);
                console.log(`     Last Repay: ${lastRepayTimestamp.toString()}`);

                // Formatage de la date
                if (lastRepayTimestamp.toString() > 0) {
                    const date = new Date(Number(lastRepayTimestamp) * 1000);
                    const formattedDate = date.toISOString().replace(/[-:]/g, '').replace('T', ' ').split('.')[0];
                    console.log(`     Date: ${formattedDate}`);

                    // Calcul du statut - conversion BigInt vers Number
                    const now = Math.floor(Date.now() / 1000);
                    const timeSinceLastRepay = now - Number(lastRepayTimestamp);
                    const isReady = timeSinceLastRepay >= Number(periodicity);

                    if (isReady) {
                        console.log(`     Status: ✅ OK (prêt pour un nouveau remboursement)`);
                    } else {
                        const remainingTime = Number(periodicity) - timeSinceLastRepay;
                        const remainingHours = Math.floor(remainingTime / 3600);
                        const remainingMinutes = Math.floor((remainingTime % 3600) / 60);
                        console.log(`     Status: ⏳ Attendre (${remainingHours}h ${remainingMinutes}m restantes)`);
                    }
                } else {
                    console.log(`     Date: N/A`);
                    console.log(`     Status: ❌ Inactif`);
                }
                console.log("");
            }
        } else {
            console.log("📭 Aucune configuration trouvée pour cet utilisateur");
        }

    } catch (error) {
        console.log("❌ Erreur lors de l'exécution:");
        console.log("   ", error.message);

        if (error.message.includes("execution reverted")) {
            console.log("");
            console.log("💡 Suggestions:");
            console.log("   • Vérifiez que le contrat est bien déployé sur Tenderly");
            console.log("   • Vérifiez que l'adresse utilisateur est correcte");
            console.log("   • Vérifiez que le RPC Tenderly est accessible");
        }

        process.exit(1);
    }
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (error) => {
    console.log("❌ Erreur non gérée:", error);
    process.exit(1);
});

main().catch((error) => {
    console.log("❌ Erreur fatale:", error);
    process.exit(1);
});
