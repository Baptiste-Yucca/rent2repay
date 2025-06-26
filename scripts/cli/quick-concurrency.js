#!/usr/bin/env node

/**
 * Script CLI pour test de concurrence entre runners
 * Usage: node scripts/cli/quick-concurrency.js
 */

const { QuickTest } = require('../test-lib.js');

async function main() {
    try {
        console.log("🎯 Test de concurrence entre runners\n");

        await QuickTest.quickConcurrency();

        console.log("\n🎉 Test de concurrence terminé !");
        console.log("💡 Pour voir le statut d'un utilisateur, utilisez:");
        console.log("   node scripts/cli/show-status.js [address]");

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