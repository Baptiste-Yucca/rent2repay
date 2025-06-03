const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Tests post-déploiement du contrat Rent2Repay...\n");

    // Récupération des signers
    const [deployer, admin, emergency, operator, user1, user2] = await ethers.getSigners();

    console.log("👥 Comptes utilisés pour les tests :");
    console.log("Deployer:", deployer.address);
    console.log("Admin:", admin.address);
    console.log("Emergency:", emergency.address);
    console.log("Operator:", operator.address);
    console.log("User1:", user1.address);
    console.log("User2:", user2.address);
    console.log();

    // Déploiement du contrat
    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2Repay = await Rent2Repay.deploy(
        admin.address,
        emergency.address,
        operator.address
    );

    await rent2Repay.waitForDeployment();
    const contractAddress = await rent2Repay.getAddress();
    console.log("✅ Contrat déployé à l'adresse:", contractAddress);
    console.log();

    // Test 1: Vérification des rôles
    console.log("🔐 Test 1: Vérification des rôles");
    try {
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const ADMIN_ROLE = await rent2Repay.ADMIN_ROLE();
        const EMERGENCY_ROLE = await rent2Repay.EMERGENCY_ROLE();
        const OPERATOR_ROLE = await rent2Repay.OPERATOR_ROLE();

        const adminHasDefaultRole = await rent2Repay.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
        const adminHasAdminRole = await rent2Repay.hasRole(ADMIN_ROLE, admin.address);
        const emergencyHasRole = await rent2Repay.hasRole(EMERGENCY_ROLE, emergency.address);
        const operatorHasRole = await rent2Repay.hasRole(OPERATOR_ROLE, operator.address);

        console.log("- Admin a DEFAULT_ADMIN_ROLE:", adminHasDefaultRole);
        console.log("- Admin a ADMIN_ROLE:", adminHasAdminRole);
        console.log("- Emergency a EMERGENCY_ROLE:", emergencyHasRole);
        console.log("- Operator a OPERATOR_ROLE:", operatorHasRole);

        if (adminHasDefaultRole && adminHasAdminRole && emergencyHasRole && operatorHasRole) {
            console.log("✅ Test 1 réussi: Tous les rôles sont correctement assignés\n");
        } else {
            throw new Error("Les rôles ne sont pas correctement assignés");
        }
    } catch (error) {
        console.log("❌ Test 1 échoué:", error.message);
        return;
    }

    // Test 2: Configuration utilisateur
    console.log("👤 Test 2: Configuration utilisateur");
    try {
        const weeklyAmount = ethers.parseEther("100");

        // User1 configure Rent2Repay
        const tx1 = await rent2Repay.connect(user1).configureRent2Repay([weeklyAmount]);
        await tx1.wait();

        const isAuthorized = await rent2Repay.isAuthorized(user1.address);
        const [maxAmount, lastTimestamp, currentSpent] = await rent2Repay.getUserConfig(user1.address);

        console.log("- User1 configuré avec succès:", isAuthorized);
        console.log("- Montant hebdomadaire:", ethers.formatEther(maxAmount), "ETH");
        console.log("- Timestamp initial:", lastTimestamp.toString());
        console.log("- Montant dépensé initial:", ethers.formatEther(currentSpent), "ETH");

        if (isAuthorized && maxAmount === weeklyAmount && lastTimestamp === 0n && currentSpent === 0n) {
            console.log("✅ Test 2 réussi: Configuration utilisateur fonctionne\n");
        } else {
            throw new Error("Configuration utilisateur incorrecte");
        }
    } catch (error) {
        console.log("❌ Test 2 échoué:", error.message);
        return;
    }

    // Test 3: Validation de repayment
    console.log("💰 Test 3: Fonction rent2repay");
    try {
        const repayAmount = ethers.parseEther("30");

        // N'importe qui peut appeler rent2repay
        const tx3 = await rent2Repay.connect(user2).rent2repay(user1.address, repayAmount);
        await tx3.wait();

        const [, newTimestamp, newSpent] = await rent2Repay.getUserConfig(user1.address);
        const available = await rent2Repay.getAvailableAmountThisWeek(user1.address);

        console.log("- Montant remboursé:", ethers.formatEther(repayAmount), "ETH");
        console.log("- Nouveau montant dépensé:", ethers.formatEther(newSpent), "ETH");
        console.log("- Montant disponible restant:", ethers.formatEther(available), "ETH");
        console.log("- Timestamp mis à jour:", newTimestamp > 0n);

        if (newSpent === repayAmount && available === ethers.parseEther("70") && newTimestamp > 0n) {
            console.log("✅ Test 3 réussi: Fonction rent2repay fonctionne\n");
        } else {
            throw new Error("Fonction rent2repay incorrecte");
        }
    } catch (error) {
        console.log("❌ Test 3 échoué:", error.message);
        return;
    }

    // Test 4: Limite hebdomadaire
    console.log("⏰ Test 4: Limite hebdomadaire");
    try {
        const excessiveAmount = ethers.parseEther("80"); // 30 + 80 = 110 > 100

        let limitExceeded = false;
        try {
            await rent2Repay.connect(user2).rent2repay(user1.address, excessiveAmount);
        } catch (error) {
            if (error.message.includes("WeeklyLimitExceeded")) {
                limitExceeded = true;
            }
        }

        console.log("- Tentative de dépassement de limite:", limitExceeded ? "rejetée ✅" : "acceptée ❌");

        if (limitExceeded) {
            console.log("✅ Test 4 réussi: Limite hebdomadaire respectée\n");
        } else {
            throw new Error("La limite hebdomadaire n'est pas respectée");
        }
    } catch (error) {
        console.log("❌ Test 4 échoué:", error.message);
        return;
    }

    // Test 5: Fonctions d'urgence
    console.log("🚨 Test 5: Fonctions d'urgence");
    try {
        // Emergency pause le contrat
        const tx5a = await rent2Repay.connect(emergency).pause();
        await tx5a.wait();

        const isPaused = await rent2Repay.paused();
        console.log("- Contrat mis en pause:", isPaused);

        // Tentative de configuration pendant la pause
        let pauseEffective = false;
        try {
            await rent2Repay.connect(user2).configureRent2Repay(ethers.parseEther("50"));
        } catch (error) {
            if (error.message.includes("EnforcedPause")) {
                pauseEffective = true;
            }
        }

        console.log("- Configuration bloquée pendant pause:", pauseEffective ? "oui ✅" : "non ❌");

        // Emergency unpause le contrat
        const tx5b = await rent2Repay.connect(emergency).unpause();
        await tx5b.wait();

        const isUnpaused = !await rent2Repay.paused();
        console.log("- Contrat remis en marche:", isUnpaused);

        if (isPaused && pauseEffective && isUnpaused) {
            console.log("✅ Test 5 réussi: Fonctions d'urgence fonctionnent\n");
        } else {
            throw new Error("Fonctions d'urgence défaillantes");
        }
    } catch (error) {
        console.log("❌ Test 5 échoué:", error.message);
        return;
    }

    // Test 6: Fonctions opérateur
    console.log("⚙️ Test 6: Fonctions opérateur");
    try {
        // User2 configure d'abord
        await rent2Repay.connect(user2).configureRent2Repay(ethers.parseEther("200"));

        const user2AuthorizedBefore = await rent2Repay.isAuthorized(user2.address);
        console.log("- User2 autorisé avant suppression:", user2AuthorizedBefore);

        // Operator supprime user2
        const tx6 = await rent2Repay.connect(operator).removeUser(user2.address);
        await tx6.wait();

        const user2AuthorizedAfter = await rent2Repay.isAuthorized(user2.address);
        console.log("- User2 autorisé après suppression:", user2AuthorizedAfter);

        if (user2AuthorizedBefore && !user2AuthorizedAfter) {
            console.log("✅ Test 6 réussi: Fonctions opérateur fonctionnent\n");
        } else {
            throw new Error("Fonctions opérateur défaillantes");
        }
    } catch (error) {
        console.log("❌ Test 6 échoué:", error.message);
        return;
    }

    // Test 7: Révocation utilisateur
    console.log("🚪 Test 7: Révocation utilisateur");
    try {
        const user1AuthorizedBefore = await rent2Repay.isAuthorized(user1.address);
        console.log("- User1 autorisé avant révocation:", user1AuthorizedBefore);

        // User1 révoque sa propre autorisation
        const tx7 = await rent2Repay.connect(user1).revokeRent2Repay();
        await tx7.wait();

        const user1AuthorizedAfter = await rent2Repay.isAuthorized(user1.address);
        const [maxAmount, lastTimestamp, currentSpent] = await rent2Repay.getUserConfig(user1.address);

        console.log("- User1 autorisé après révocation:", user1AuthorizedAfter);
        console.log("- Données effacées:", maxAmount === 0n && lastTimestamp === 0n && currentSpent === 0n);

        if (user1AuthorizedBefore && !user1AuthorizedAfter && maxAmount === 0n) {
            console.log("✅ Test 7 réussi: Révocation utilisateur fonctionne\n");
        } else {
            throw new Error("Révocation utilisateur défaillante");
        }
    } catch (error) {
        console.log("❌ Test 7 échoué:", error.message);
        return;
    }

    // Test 8: Contrôles de sécurité rent2repay
    console.log("🔒 Test 8: Contrôles de sécurité rent2repay");
    try {
        // Reconfigurer user1 pour les tests
        await rent2Repay.connect(user1).configureRent2Repay(ethers.parseEther("100"));

        // Test 8a: Adresse zéro
        let zeroAddressBlocked = false;
        try {
            const zeroAddress = "0x0000000000000000000000000000000000000000";
            await rent2Repay.connect(user2).rent2repay(zeroAddress, ethers.parseEther("10"));
        } catch (error) {
            if (error.message.includes("InvalidUserAddress")) {
                zeroAddressBlocked = true;
            }
        }
        console.log("- Adresse zéro bloquée:", zeroAddressBlocked ? "oui ✅" : "non ❌");

        // Test 8b: Auto-repayment bloqué
        let selfRepaymentBlocked = false;
        try {
            await rent2Repay.connect(user1).rent2repay(user1.address, ethers.parseEther("10"));
        } catch (error) {
            if (error.message.includes("CannotRepayForSelf")) {
                selfRepaymentBlocked = true;
            }
        }
        console.log("- Auto-repayment bloqué:", selfRepaymentBlocked ? "oui ✅" : "non ❌");

        // Test 8c: Repayment normal fonctionne
        const normalRepayment = await rent2Repay.connect(user2).rent2repay(user1.address, ethers.parseEther("20"));
        const normalSuccess = normalRepayment !== undefined;
        console.log("- Repayment normal fonctionne:", normalSuccess ? "oui ✅" : "non ❌");

        if (zeroAddressBlocked && selfRepaymentBlocked && normalSuccess) {
            console.log("✅ Test 8 réussi: Contrôles de sécurité fonctionnent\n");
        } else {
            throw new Error("Contrôles de sécurité défaillants");
        }
    } catch (error) {
        console.log("❌ Test 8 échoué:", error.message);
        return;
    }

    // Résumé des tests
    console.log("📋 Résumé des tests :");
    console.log("✅ Test 1: Vérification des rôles");
    console.log("✅ Test 2: Configuration utilisateur");
    console.log("✅ Test 3: Fonction rent2repay");
    console.log("✅ Test 4: Limite hebdomadaire");
    console.log("✅ Test 5: Fonctions d'urgence");
    console.log("✅ Test 6: Fonctions opérateur");
    console.log("✅ Test 7: Révocation utilisateur");
    console.log("✅ Test 8: Contrôles de sécurité rent2repay");
    console.log();

    console.log("🎉 Tous les tests post-déploiement ont réussi !");
    console.log("Le contrat Rent2Repay fonctionne parfaitement avec sécurité renforcée.");
}

// Gestion des erreurs
main()
    .then(() => {
        console.log("\n✨ Tests post-déploiement terminés avec succès !");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n💥 Erreur lors des tests post-déploiement :", error);
        process.exit(1);
    }); 