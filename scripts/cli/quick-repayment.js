#!/usr/bin/env node

/**
 * Script CLI pour exécution rapide d'un remboursement
 * Usage: node scripts/cli/quick-repayment.js
 */

const { QuickTest } = require('../test-lib.js');

async function main() {
    try {
        console.log("🎯 Exécution rapide d'un remboursement\n");

        await QuickTest.quickRepayment();

        console.log("\n🎉 Test de remboursement terminé !");
        console.log("💡 Pour tester la concurrence, utilisez:");
        console.log("   node scripts/cli/quick-concurrency.js");

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