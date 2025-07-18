#!/usr/bin/env node

/**
 * Script pour vérifier les approbations des tokens vers le contrat RMM
 * Usage: npx hardhat run scripts/check-approvals.js --network localhost
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔍 === Vérification des approbations de tokens ===\n");

    try {
        // Charger la configuration des contrats déployés
        const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");

        if (!fs.existsSync(configPath)) {
            console.error("❌ Fichier de configuration non trouvé:", configPath);
            console.log("💡 Assurez-vous d'avoir déployé les contrats avec deploy-local.js");
            process.exit(1);
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log("📋 Configuration chargée depuis:", configPath);
        console.log(`🌐 Réseau: ${config.network} (Chain ID: ${config.chainId})\n`);

        // Connexion aux contrats
        const rent2Repay = await ethers.getContractAt("Rent2Repay", config.contracts.Rent2Repay);
        const rmmAddress = config.contracts.MockRMM;
        const rent2RepayAddress = config.contracts.Rent2Repay;

        console.log("🏠 Contrat Rent2Repay:", config.contracts.Rent2Repay);
        console.log("🏗️ Contrat RMM:", rmmAddress);
        console.log("");

        // Liste des tokens à vérifier
        const tokensToCheck = [
            { name: "USDC", address: config.contracts.MockUSDC },
            { name: "WXDAI", address: config.contracts.MockWXDAI },
            { name: "armmUSDC", address: config.contracts.armmUSDC },
            { name: "armmWXDAI", address: config.contracts.armmWXDAI }
        ];

        console.log("🔍 Vérification des approbations vers le RMM:\n");

        let allApprovalsValid = true;

        for (const token of tokensToCheck) {
            try {
                // Utiliser directement l'interface IERC20 pour vérifier l'allowance
                const tokenContract = await ethers.getContractAt("IERC20", token.address);
                const allowance = await tokenContract.allowance(rent2RepayAddress, rmmAddress);
                const isValid = allowance > 0n;

                console.log(`📊 ${token.name}:`);
                console.log(`   Adresse: ${token.address}`);
                console.log(`   Approbation: ${allowance.toString()}`);
                console.log(`   Statut: ${isValid ? '✅ Valide' : '❌ Invalide'}`);
                console.log("");

                if (!isValid) {
                    allApprovalsValid = false;
                }
            } catch (error) {
                console.error(`❌ Erreur lors de la vérification de ${token.name}:`, error.message);
                allApprovalsValid = false;
            }
        }

        // Résumé
        console.log("📋 === RÉSUMÉ ===");
        if (allApprovalsValid) {
            console.log("🎉 Toutes les approbations sont valides!");
            console.log("✅ Le contrat Rent2Repay peut utiliser les fonctions rent2repay et batchRent2Repay");
        } else {
            console.log("⚠️ Certaines approbations sont manquantes ou invalides!");
            console.log("💡 Solutions possibles:");
            console.log("1. Redéployer les contrats avec deploy-local.js");
            console.log("2. Utiliser la fonction giveApproval() du contrat pour configurer les approbations manuellement");
            console.log("3. Vérifier que vous utilisez le bon réseau et les bonnes adresses");
        }

    } catch (error) {
        console.error("\n❌ === Erreur lors de la vérification ===");
        console.error("Erreur:", error.message);
        process.exit(1);
    }
}

// Exécuter le script si appelé directement
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { main }; 