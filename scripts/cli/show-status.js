#!/usr/bin/env node

/**
 * Script CLI pour afficher le statut d'un utilisateur
 * Usage: node scripts/cli/show-status.js [address]
 */

const { QuickTest, loadTestEnvironment } = require('../test-lib.js');

async function main() {
    try {
        // Récupérer l'adresse depuis les arguments ou utiliser CONFIGURATOR par défaut
        let userAddress = process.argv[2];

        if (!userAddress) {
            const { users } = await loadTestEnvironment();
            userAddress = users.CONFIGURATOR.address;
            console.log("🔍 Aucune adresse spécifiée, utilisation du CONFIGURATOR par défaut\n");
        }

        console.log(`🎯 Affichage du statut pour: ${userAddress}\n`);

        await QuickTest.showUserStatus(userAddress);

        console.log("\n🎉 Statut affiché avec succès !");

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