#!/usr/bin/env node

/**
 * Script CLI pour afficher tous les utilisateurs configurés
 * Usage: node scripts/cli/show-users.js
 */

const { initTestEnvironment } = require('../test-lib.js');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        console.log("🎯 Affichage de tous les utilisateurs de test\n");

        // Vérifier si le fichier de configuration existe
        const configPath = path.join(__dirname, "../tmp/deployed-contracts.json");
        if (!fs.existsSync(configPath)) {
            console.log("❌ Fichier de configuration non trouvé.");
            console.log("📁 Chemin recherché:", configPath);
            console.log("\n💡 Pour résoudre ce problème:");
            console.log("   1. Exécutez d'abord: npx hardhat node");
            console.log("   2. Puis dans un autre terminal: node scripts/deploy-local.js");
            console.log("   3. Enfin relancez: yarn test:users");
            console.log("\n🔧 Ou utilisez la commande complète:");
            console.log("   yarn deploy:local && yarn test:users");
            process.exit(1);
        }

        const users = await initTestEnvironment();

        console.log("📋 Résumé des utilisateurs :");
        console.log("=".repeat(50));

        for (const [name, user] of Object.entries(users)) {
            console.log(`${user.emoji} ${name}`);
            console.log(`   Adresse: ${user.address}`);
            console.log(`   Rôle: ${user.role}`);
            console.log(`   Description: ${user.description}`);
            console.log("");
        }

        console.log("💡 Commandes utiles :");
        console.log("   Configuration: node scripts/cli/quick-config.js [periodicity]");
        console.log("   Remboursement: node scripts/cli/quick-repayment.js");
        console.log("   Concurrence: node scripts/cli/quick-concurrency.js");
        console.log("   Statut: node scripts/cli/show-status.js [address]");

    } catch (error) {
        console.error("❌ Erreur:", error.message);
        process.exit(1);
    }
}

// Exécuter le script si appelé directement
if (require.main === module) {
    main();
}

module.exports = { main }; 