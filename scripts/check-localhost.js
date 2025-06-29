#!/usr/bin/env node

/**
 * Script utilitaire pour vérifier la connexion au nœud Hardhat local
 * Usage: npx hardhat run scripts/check-localhost.js --network localhost
 */

const { ethers, network } = require("hardhat");

async function main() {
    console.log("🔍 === Vérification de la connexion au nœud local ===\n");

    try {
        // Informations sur le réseau
        console.log("🌐 Informations réseau :");
        console.log(`   Nom: ${network.name}`);
        console.log(`   URL: ${network.config.url || 'Non spécifiée'}`);
        console.log(`   Chain ID configuré: ${network.config.chainId || 'Non spécifié'}`);

        // Test de connexion
        const provider = ethers.provider;
        console.log("\n🔌 Test de connexion...");

        // Obtenir le chain ID actuel
        const chainId = await network.provider.request({ method: 'eth_chainId' });
        console.log(`✅ Chain ID actuel: ${parseInt(chainId)}`);

        // Obtenir le numéro de bloc
        const blockNumber = await provider.getBlockNumber();
        console.log(`✅ Bloc actuel: ${blockNumber}`);

        // Obtenir les comptes
        const accounts = await ethers.getSigners();
        console.log(`✅ Nombre de comptes disponibles: ${accounts.length}`);

        if (accounts.length > 0) {
            console.log(`✅ Premier compte: ${accounts[0].address}`);

            // Vérifier le solde du premier compte
            const balance = await provider.getBalance(accounts[0].address);
            console.log(`✅ Solde du premier compte: ${ethers.formatEther(balance)} ETH`);
        }

        console.log("\n🎉 === Connexion au nœud local réussie ===");
        console.log("💡 Vous pouvez maintenant exécuter vos scripts de test!");

    } catch (error) {
        console.error("\n❌ === Erreur de connexion ===");
        console.error("Erreur:", error.message);

        console.log("\n💡 Solutions possibles :");
        console.log("1. Assurez-vous que le nœud Hardhat local est démarré :");
        console.log("   npx hardhat node");
        console.log("2. Vérifiez que le port 8545 est libre");
        console.log("3. Utilisez le bon flag réseau :");
        console.log("   npx hardhat run scripts/check-localhost.js --network localhost");

        process.exit(1);
    }
}

// Exécuter le script si appelé directement
if (require.main === module) {
    main();
}

module.exports = { main }; 