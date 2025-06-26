#!/usr/bin/env node

/**
 * Script de démonstration complète de Rent2Repay
 * Enchaîne tous les scénarios de test pour une démo fluide
 * Usage: node scripts/cli/demo-complete.js [periodicity_in_seconds]
 */

const { QuickTest } = require('../test-lib.js');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    try {
        const periodicity = process.argv[2] ? parseInt(process.argv[2]) : 60; // 1 minute par défaut pour démo

        console.log("🎬 === DÉMONSTRATION COMPLÈTE RENT2REPAY ===\n");
        console.log(`⏰ Périodicité configurée : ${periodicity} secondes\n`);

        // Étape 1 : Configuration
        console.log("📋 ÉTAPE 1/4 : Configuration du système");
        console.log("=".repeat(50));
        await QuickTest.quickConfig(periodicity);

        await sleep(2000); // Pause pour la lisibilité

        // Étape 2 : Premier remboursement
        console.log("\n📋 ÉTAPE 2/4 : Premier remboursement");
        console.log("=".repeat(50));
        await QuickTest.quickRepayment();

        await sleep(2000);

        // Étape 3 : Test de concurrence
        console.log("\n📋 ÉTAPE 3/4 : Test de concurrence");
        console.log("=".repeat(50));
        await QuickTest.quickConcurrency();

        await sleep(2000);

        // Étape 4 : Statut final
        console.log("\n📋 ÉTAPE 4/4 : Statut final");
        console.log("=".repeat(50));
        const { users } = await require('../test-lib.js').loadTestEnvironment();
        await QuickTest.showUserStatus(users.CONFIGURATOR.address);

        // Résumé final
        console.log("\n🎉 === DÉMONSTRATION TERMINÉE ===");
        console.log("✅ Configuration effectuée");
        console.log("✅ Remboursements testés");
        console.log("✅ Concurrence testée");
        console.log("✅ Statuts vérifiés");

        console.log("\n💡 Commandes individuelles disponibles :");
        console.log("   npm run test:users     - Voir les utilisateurs");
        console.log("   npm run test:config    - Configuration seule");
        console.log("   npm run test:repay     - Remboursement seul");
        console.log("   npm run test:concurrency - Concurrence seule");
        console.log("   npm run test:status    - Statut d'un utilisateur");

        console.log("\n🚀 Système prêt pour vos tests personnalisés !");

    } catch (error) {
        console.error("\n❌ Erreur pendant la démonstration:", error.message);
        console.error("💡 Assurez-vous que les contrats sont déployés avec: npm run deploy:local");
        process.exit(1);
    }
}

// Exécuter le script si appelé directement
if (require.main === module) {
    main();
}

module.exports = { main }; 