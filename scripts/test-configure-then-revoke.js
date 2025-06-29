#!/usr/bin/env node

/**
 * Script de test pour configurer puis révoquer (ou l'inverse) pour l'utilisateur 1
 * Usage: npx hardhat run scripts/test-configure-then-revoke.js --network localhost
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Fonction pour attendre (sleep)
function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// Fonction pour afficher la configuration d'un utilisateur
async function displayUserConfiguration(rent2Repay, userAddress, tokens) {
    console.log(`\n📋 Configuration pour l'utilisateur: ${userAddress}`);

    const isAuthorized = await rent2Repay.isAuthorized(userAddress);
    const periodicity = await rent2Repay.periodicity(userAddress);

    console.log(`   ➤ Autorisé: ${isAuthorized ? '✅ OUI' : '❌ NON'}`);
    console.log(`   ➤ Périodicité: ${periodicity.toString()} secondes ${Number(periodicity) > 0 ? `(${Number(periodicity) / 86400} jours)` : ''}`);

    console.log("   ➤ Limites par token:");
    for (const token of tokens) {
        const amount = await rent2Repay.allowedMaxAmounts(userAddress, token.address);
        console.log(`      • ${token.name}: ${ethers.formatEther(amount)} tokens`);
    }
}

async function main() {
    console.log("🔄 === Test Configure Then Revoke pour l'Utilisateur 1 ===\n");

    try {
        // Charger la configuration des contrats déployés
        const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");

        if (!fs.existsSync(configPath)) {
            throw new Error("❌ Fichier de configuration non trouvé. Exécutez d'abord le script de déploiement : npx hardhat run scripts/deploy-local.js --network localhost");
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log("✅ Configuration des contrats chargée");

        // Obtenir les signers
        const signers = await ethers.getSigners();
        const user1 = signers[1]; // Utilisateur 1 (index 1)

        console.log(`🎯 Utilisateur testé: ${user1.address}`);

        // Charger les instances des contrats
        const rent2Repay = await ethers.getContractAt("Rent2Repay", config.contracts.Rent2Repay);

        // Définir les tokens disponibles
        const tokens = [
            {
                name: "USDC",
                address: config.contracts.MockUSDC
            },
            {
                name: "WXDAI",
                address: config.contracts.MockWXDAI
            }
        ];

        console.log("\n🔍 === VÉRIFICATION INITIALE ===");
        await displayUserConfiguration(rent2Repay, user1.address, tokens);

        // Vérifier si l'utilisateur est configuré
        const isCurrentlyAuthorized = await rent2Repay.isAuthorized(user1.address);

        if (!isCurrentlyAuthorized) {
            // PAS CONFIGURÉ -> CONFIGURER
            console.log("\n⚙️ === L'utilisateur n'est PAS configuré -> CONFIGURATION ===");

            const tokenAddresses = tokens.map(t => t.address);
            const amounts = [ethers.parseEther("100"), ethers.parseEther("100")]; // 100 tokens chacun
            const period = 86400; // 1 jour en secondes

            console.log("📤 Configuration en cours...");
            console.log(`   ➤ Tokens: ${tokens.map(t => t.name).join(', ')}`);
            console.log(`   ➤ Montants: ${amounts.map(a => ethers.formatEther(a)).join(', ')} tokens`);
            console.log(`   ➤ Période: ${period} secondes (${period / 86400} jour)`);

            const tx = await rent2Repay.connect(user1).configureRent2Repay(
                tokenAddresses,
                amounts,
                period
            );

            await tx.wait();
            console.log("✅ Configuration effectuée");
            console.log(`   📋 Transaction: ${tx.hash}`);

        } else {
            // CONFIGURÉ -> RÉVOQUER TOUT
            console.log("\n🗑️ === L'utilisateur EST configuré -> RÉVOCATION ===");

            console.log("📤 Révocation de toute la configuration...");

            const tx = await rent2Repay.connect(user1).revokeRent2RepayAll();
            await tx.wait();

            console.log("✅ Révocation effectuée");
            console.log(`   📋 Transaction: ${tx.hash}`);
        }

        // Attendre 5 secondes pour le minage du bloc
        console.log("\n⏳ Attente de 5 secondes pour le minage du bloc...");
        await sleep(5);

        // Vérification finale
        console.log("\n🔍 === VÉRIFICATION FINALE ===");
        await displayUserConfiguration(rent2Repay, user1.address, tokens);

        // Afficher un résumé du changement
        const isNowAuthorized = await rent2Repay.isAuthorized(user1.address);

        console.log("\n📊 === RÉSUMÉ DU CHANGEMENT ===");
        console.log(`   Avant: ${isCurrentlyAuthorized ? '✅ Configuré' : '❌ Non configuré'}`);
        console.log(`   Après: ${isNowAuthorized ? '✅ Configuré' : '❌ Non configuré'}`);

        if (isCurrentlyAuthorized !== isNowAuthorized) {
            console.log("🎉 ✅ Changement d'état réussi!");
        } else {
            console.log("⚠️ ❌ Aucun changement détecté");
        }

        console.log("\n🎯 === Test terminé avec succès ===");

    } catch (error) {
        console.error("❌ Erreur lors du test:", error.message);
        if (error.reason) {
            console.error("   Raison:", error.reason);
        }
        process.exit(1);
    }
}

// Exécuter le script si appelé directement
if (require.main === module) {
    main();
}

module.exports = { main }; 