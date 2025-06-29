const { ethers } = require("hardhat");
const { loadContracts } = require('./test-utils.js');

async function main() {
    console.log("💰 === Test de gestion des fees Rent2Repay ===\n");

    try {
        // Charger les contrats et signers
        const { contracts, addresses, signers } = await loadContracts();
        const allSigners = await ethers.getSigners();

        console.log("✅ Contrats chargés avec succès");
        console.log("📋 Adresse du contrat Rent2Repay:", addresses.Rent2Repay);

        // === ÉTAPE 1: Vérifier qui est admin et peut changer les fees ===
        console.log("\n🔍 === ÉTAPE 1: Vérification des rôles admin ===");

        for (let i = 0; i < 3; i++) {
            const signer = allSigners[i];
            const contract = contracts.rent2Repay.connect(signer);

            try {
                const [isAdmin, isOperator, isEmergency] = await contract.whoami();
                console.log(`👤 Signer #${i} (${signer.address}):`);
                console.log(`   ➤ Admin: ${isAdmin ? '✅' : '❌'}`);
                console.log(`   ➤ Operator: ${isOperator ? '✅' : '❌'}`);
                console.log(`   ➤ Emergency: ${isEmergency ? '✅' : '❌'}`);

                if (isAdmin) {
                    console.log(`   🎯 Cet utilisateur peut changer les fees!`);
                }
            } catch (err) {
                console.log(`❌ Erreur pour signer #${i}:`, err.message);
            }
        }

        // === ÉTAPE 2: Logger les fees actuelles ===
        console.log("\n💸 === ÉTAPE 2: Fees actuelles ===");

        const [currentDaoFees, currentSenderTips] = await contracts.rent2Repay.getFeeConfiguration();
        console.log(`📊 Fees DAO actuelles: ${currentDaoFees} BPS (${Number(currentDaoFees) / 100}%)`);
        console.log(`📊 Tips Runner actuelles: ${currentSenderTips} BPS (${Number(currentSenderTips) / 100}%)`);

        // === ÉTAPE 3: Changer les fees (x2 pour DAO, x3 pour tips) ===
        console.log("\n⚡ === ÉTAPE 3: Modification des fees ===");

        const adminSigner = allSigners[0]; // Assumons que le premier est admin
        const adminContract = contracts.rent2Repay.connect(adminSigner);

        const newDaoFees = Number(currentDaoFees) * 2;
        const newSenderTips = Number(currentSenderTips) * 3;

        console.log(`🔄 Nouvelle fee DAO: ${newDaoFees} BPS (${newDaoFees / 100}%)`);
        console.log(`🔄 Nouveaux tips Runner: ${newSenderTips} BPS (${newSenderTips / 100}%)`);

        // Vérifier que les nouvelles fees ne dépassent pas 100%
        if (newDaoFees + newSenderTips > 10000) {
            console.log("⚠️ Attention: Les fees totales dépasseraient 100%, ajustement nécessaire");
            const adjustedDaoFees = Math.min(newDaoFees, 5000); // Max 50% pour DAO
            const adjustedSenderTips = Math.min(newSenderTips, 10000 - adjustedDaoFees);

            console.log(`🔧 Fees DAO ajustées: ${adjustedDaoFees} BPS`);
            console.log(`🔧 Tips Runner ajustés: ${adjustedSenderTips} BPS`);

            await adminContract.updateDaoFees(adjustedDaoFees);
            await adminContract.updateSenderTips(adjustedSenderTips);
        } else {
            await adminContract.updateDaoFees(newDaoFees);
            await adminContract.updateSenderTips(newSenderTips);
        }

        console.log("✅ Fees mises à jour");

        // === ÉTAPE 4: Vérifier les changements ===
        console.log("\n✔️ === ÉTAPE 4: Vérification des changements ===");

        const [updatedDaoFees, updatedSenderTips] = await contracts.rent2Repay.getFeeConfiguration();
        console.log(`📊 Nouvelles fees DAO: ${updatedDaoFees} BPS (${Number(updatedDaoFees) / 100}%)`);
        console.log(`📊 Nouveaux tips Runner: ${updatedSenderTips} BPS (${Number(updatedSenderTips) / 100}%)`);

        const daoCheck = Number(updatedDaoFees) === Math.min(newDaoFees, 5000);
        const tipsCheck = Number(updatedSenderTips) === Math.min(newSenderTips, 10000 - Math.min(newDaoFees, 5000));

        console.log(`${daoCheck ? '✅' : '❌'} Fees DAO correctement mises à jour`);
        console.log(`${tipsCheck ? '✅' : '❌'} Tips Runner correctement mis à jour`);

        // === ÉTAPE 5: Changer l'admin vers l'adresse #10 ===
        console.log("\n👑 === ÉTAPE 5: Changement d'admin vers l'adresse #10 ===");

        const newAdminSigner = allSigners[10];
        console.log(`🎯 Nouvelle adresse admin: ${newAdminSigner.address}`);

        // Accorder les deux rôles ADMIN à l'adresse #10
        const ADMIN_ROLE = await contracts.rent2Repay.ADMIN_ROLE();
        const DEFAULT_ADMIN_ROLE = await contracts.rent2Repay.DEFAULT_ADMIN_ROLE();

        await adminContract.grantRole(ADMIN_ROLE, newAdminSigner.address);
        await adminContract.grantRole(DEFAULT_ADMIN_ROLE, newAdminSigner.address);
        console.log("✅ Rôles ADMIN et DEFAULT_ADMIN accordés à l'adresse #10");

        // === ÉTAPE 6: Vérification avec whoami ===
        console.log("\n🔍 === ÉTAPE 6: Vérification whoami pour la nouvelle adresse ===");

        const newAdminContract = contracts.rent2Repay.connect(newAdminSigner);
        const [isAdminNew, isOperatorNew, isEmergencyNew] = await newAdminContract.whoami();

        console.log(`👤 Nouvelle adresse admin (${newAdminSigner.address}):`);
        console.log(`   ➤ Admin: ${isAdminNew ? '✅' : '❌'}`);
        console.log(`   ➤ Operator: ${isOperatorNew ? '✅' : '❌'}`);
        console.log(`   ➤ Emergency: ${isEmergencyNew ? '✅' : '❌'}`);

        // === ÉTAPE 7: Tester que l'ancienne adresse ne peut plus changer les fees ===
        console.log("\n🚫 === ÉTAPE 7: Test - ancienne adresse ne peut plus changer les fees ===");

        // Révoquer les rôles ADMIN de l'ancienne adresse
        await newAdminContract.revokeRole(ADMIN_ROLE, adminSigner.address);
        await newAdminContract.revokeRole(DEFAULT_ADMIN_ROLE, adminSigner.address);
        console.log("✅ Rôles ADMIN et DEFAULT_ADMIN révoqués pour l'ancienne adresse");

        try {
            await adminContract.updateDaoFees(100); // Tentative de changement
            console.log("❌ PROBLÈME: L'ancienne adresse peut encore changer les fees!");
        } catch (err) {
            console.log("✅ Parfait: L'ancienne adresse ne peut plus changer les fees");
            console.log(`   Erreur attendue: ${err.reason || err.message}`);
        }

        // === ÉTAPE 8: Tester que la nouvelle adresse peut changer les fees ===
        console.log("\n✅ === ÉTAPE 8: Test - nouvelle adresse peut changer les fees ===");

        const currentFeesBeforeNewChange = await contracts.rent2Repay.getFeeConfiguration();
        const newDaoFeesReduced = Math.floor(Number(currentFeesBeforeNewChange[0]) / 2);
        const newSenderTipsReduced = Math.floor(Number(currentFeesBeforeNewChange[1]) / 3);

        console.log(`🔄 Réduction fees DAO: ${Number(currentFeesBeforeNewChange[0])} → ${newDaoFeesReduced} BPS`);
        console.log(`🔄 Réduction tips Runner: ${Number(currentFeesBeforeNewChange[1])} → ${newSenderTipsReduced} BPS`);

        try {
            await newAdminContract.updateDaoFees(newDaoFeesReduced);
            await newAdminContract.updateSenderTips(newSenderTipsReduced);
            console.log("✅ Nouvelle adresse peut changer les fees avec succès");
        } catch (err) {
            console.log("❌ PROBLÈME: La nouvelle adresse ne peut pas changer les fees:", err.message);
        }

        // === ÉTAPE 9: Vérification finale des changements ===
        console.log("\n🔍 === ÉTAPE 9: Vérification finale ===");

        const [finalDaoFees, finalSenderTips] = await contracts.rent2Repay.getFeeConfiguration();
        console.log(`📊 Fees DAO finales: ${finalDaoFees} BPS (${Number(finalDaoFees) / 100}%)`);
        console.log(`📊 Tips Runner finales: ${finalSenderTips} BPS (${Number(finalSenderTips) / 100}%)`);

        const finalDaoCheck = Number(finalDaoFees) === newDaoFeesReduced;
        const finalTipsCheck = Number(finalSenderTips) === newSenderTipsReduced;

        console.log(`${finalDaoCheck ? '✅' : '❌'} Fees DAO réduites correctement`);
        console.log(`${finalTipsCheck ? '✅' : '❌'} Tips Runner réduits correctement`);

        // === ÉTAPE 10: Remettre l'adresse initiale en admin ===
        console.log("\n🔄 === ÉTAPE 10: Remise de l'adresse initiale en admin ===");

        await newAdminContract.grantRole(ADMIN_ROLE, adminSigner.address);
        await newAdminContract.grantRole(DEFAULT_ADMIN_ROLE, adminSigner.address);
        console.log("✅ Rôles ADMIN et DEFAULT_ADMIN redonnés à l'adresse initiale");

        // Vérification finale
        const [isOriginalAdminBack] = await adminContract.whoami();
        console.log(`${isOriginalAdminBack ? '✅' : '❌'} Adresse initiale est de nouveau admin`);

        // Optionnel: révoquer les rôles de l'adresse #10
        await adminContract.revokeRole(ADMIN_ROLE, newAdminSigner.address);
        await adminContract.revokeRole(DEFAULT_ADMIN_ROLE, newAdminSigner.address);
        console.log("✅ Rôles ADMIN et DEFAULT_ADMIN révoqués pour l'adresse #10");

        console.log("\n🎉 === TEST TERMINÉ AVEC SUCCÈS ===");
        console.log("Toutes les étapes ont été completées! 🚀");

    } catch (error) {
        console.error("❌ Erreur durant le test:", error);
        process.exit(1);
    }
}

main().catch(console.error); 