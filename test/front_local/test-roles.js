// Script pour tester et afficher les rôles des comptes
const { ethers } = require("hardhat");

// Adresse du contrat Rent2Repay
const RENT2REPAY_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";

async function main() {
    console.log("🔍 Vérification des rôles dans le contrat Rent2Repay");
    console.log("=".repeat(60));

    const [deployer, user1, user2, user3, user4] = await ethers.getSigners();
    const accounts = [
        { name: "Deployer", signer: deployer },
        { name: "User1", signer: user1 },
        { name: "User2", signer: user2 },
        { name: "User3", signer: user3 },
        { name: "User4", signer: user4 }
    ];

    // Obtenir le contrat
    const rent2repay = await ethers.getContractAt("Rent2Repay", RENT2REPAY_ADDRESS);

    // Obtenir les hashes des rôles
    const defaultAdminRole = await rent2repay.DEFAULT_ADMIN_ROLE();
    const adminRole = await rent2repay.ADMIN_ROLE();
    const emergencyRole = await rent2repay.EMERGENCY_ROLE();
    const operatorRole = await rent2repay.OPERATOR_ROLE();

    console.log("📋 Hashes des rôles :");
    console.log(`DEFAULT_ADMIN_ROLE: ${defaultAdminRole}`);
    console.log(`ADMIN_ROLE: ${adminRole}`);
    console.log(`EMERGENCY_ROLE: ${emergencyRole}`);
    console.log(`OPERATOR_ROLE: ${operatorRole}`);
    console.log();

    console.log("👥 Vérification des rôles par compte :");
    console.log("=".repeat(40));

    for (const account of accounts) {
        console.log(`\n${account.name}: ${account.signer.address}`);

        const roles = [];

        // Vérifier chaque rôle
        if (await rent2repay.hasRole(defaultAdminRole, account.signer.address)) {
            roles.push("👑 DEFAULT_ADMIN");
        }

        if (await rent2repay.hasRole(adminRole, account.signer.address)) {
            roles.push("🔧 ADMIN");
        }

        if (await rent2repay.hasRole(emergencyRole, account.signer.address)) {
            roles.push("🚨 EMERGENCY");
        }

        if (await rent2repay.hasRole(operatorRole, account.signer.address)) {
            roles.push("⚙️ OPERATOR");
        }

        if (roles.length === 0) {
            console.log("   🔸 Utilisateur standard (aucun rôle administratif)");
        } else {
            console.log(`   Rôles: ${roles.join(", ")}`);
        }
    }

    console.log();
    console.log("🎯 Résumé pour l'interface web :");
    console.log("=".repeat(30));
    console.log("• Connectez-vous avec le Deployer pour voir toutes les sections admin");
    console.log("• Connectez-vous avec User1-4 pour tester en tant qu'utilisateur standard");
    console.log("• Les sections admin ne s'affichent que pour les comptes avec rôles");

    // Test de fonctions spécifiques par rôle
    console.log();
    console.log("🧪 Test des permissions par rôle :");
    console.log("=".repeat(35));

    console.log("\n🔧 Test ADMIN_ROLE (gestion des tokens) :");
    try {
        // Test avec le deployer (qui a le rôle)
        await rent2repay.connect(deployer).getAuthorizedTokens();
        console.log("   ✅ Deployer peut lire les tokens autorisés");

        // Test avec user1 (qui n'a pas le rôle) - lecture seule, devrait marcher
        await rent2repay.connect(user1).getAuthorizedTokens();
        console.log("   ✅ User1 peut lire les tokens autorisés (fonction view)");

    } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
    }

    console.log("\n🚨 Test EMERGENCY_ROLE (pause/unpause) :");
    try {
        const isPaused = await rent2repay.paused();
        console.log(`   📊 État actuel du contrat: ${isPaused ? "En pause" : "Actif"}`);

        if (!isPaused) {
            console.log("   🧪 Test de mise en pause avec Deployer...");
            await rent2repay.connect(deployer).pause();
            console.log("   ✅ Deployer peut mettre en pause le contrat");

            console.log("   🧪 Test de déblocage avec Deployer...");
            await rent2repay.connect(deployer).unpause();
            console.log("   ✅ Deployer peut débloquer le contrat");
        }

    } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
    }

    console.log();
    console.log("✨ Tests terminés ! L'interface web devrait maintenant :");
    console.log("  1. Afficher les rôles de l'utilisateur connecté");
    console.log("  2. Montrer/masquer les sections selon les permissions");
    console.log("  3. Permettre uniquement les actions autorisées par rôle");
}

main()
    .then(() => {
        console.log("\n🎉 Vérification des rôles terminée !");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Erreur :", error);
        process.exit(1);
    }); 