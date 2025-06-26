#!/usr/bin/env node

/**
 * Script CLI pour configuration rapide d'un utilisateur
 * Usage: node scripts/cli/quick-config.js [periodicity_in_seconds]
 */

const { QuickTest } = require('../test-lib.js');

async function main() {
    try {
        // Récupérer la périodicité depuis les arguments de ligne de commande
        const periodicity = process.argv[2] ? parseInt(process.argv[2]) : 300; // 5 minutes par défaut

        console.log(`🎯 Configuration rapide avec périodicité: ${periodicity} secondes\n`);

        await QuickTest.quickConfig(periodicity);

        console.log("\n🎉 Configuration terminée avec succès !");
        console.log("💡 Vous pouvez maintenant tester les remboursements avec:");
        console.log("   node scripts/cli/quick-repayment.js");

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