const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupRent2Repay } = require("./utils/setupHelpers");

describe("Rent2Repay - Pause/Unpause", function () {
    let rent2Repay, mockRMM, wxdaiToken, usdcToken, usdcDebtToken, owner, addr1, addr2, admin, emergency, operator, runner, daoTreasury;

    beforeEach(async function () {
        ({
            rent2Repay,
            mockRMM,
            wxdaiToken,
            usdcToken,
            usdcDebtToken,
            owner,
            addr1,
            addr2,
            admin,
            emergency,
            operator,
            runner,
            daoTreasury
        } = await setupRent2Repay());
    });

    describe("Pause Functionality", function () {
        it("Devrait tester le cycle complet pause/unpause", async function () {
            // ÉTAPE 1: Vérifier l'état initial (non-pausé)
            expect(await rent2Repay.paused()).to.be.false;
            console.log("✅ État initial : non-pausé");

            // ÉTAPE 2: Essayer de pause() avec une adresse non-admin (addr1)
            // addr1 n'a pas le rôle EMERGENCY_ROLE
            await expect(
                rent2Repay.connect(addr1).pause()
            ).to.be.reverted;
            console.log("✅ Pause avec non-admin : correctement revert");

            // Vérifier que l'état n'a pas changé
            expect(await rent2Repay.paused()).to.be.false;

            // ÉTAPE 3: Appeler pause() avec une adresse emergency (emergency a le rôle EMERGENCY_ROLE)
            await rent2Repay.connect(emergency).pause();
            console.log("✅ Pause avec emergency : succès");

            // Vérifier que l'état est bien pausé
            expect(await rent2Repay.paused()).to.be.true;
            console.log("✅ État après pause : pausé");

            // ÉTAPE 4: Essayer d'unpause() avec une adresse non-admin (addr1)
            // addr1 n'a pas le rôle ADMIN_ROLE
            await expect(
                rent2Repay.connect(addr1).unpause()
            ).to.be.reverted;
            console.log("✅ Unpause avec non-admin : correctement revert");

            // Vérifier que l'état n'a pas changé (toujours pausé)
            expect(await rent2Repay.paused()).to.be.true;

            // ÉTAPE 5: Appeler unpause() avec une adresse admin (admin a le rôle ADMIN_ROLE)
            await rent2Repay.connect(admin).unpause();
            console.log("✅ Unpause avec admin : succès");

            // Vérifier que l'état est bien non-pausé
            expect(await rent2Repay.paused()).to.be.false;
            console.log("✅ État après unpause : non-pausé");
        });

        it("Devrait empêcher les opérations quand en pause", async function () {
            // Mettre en pause
            await rent2Repay.connect(emergency).pause();

            // Essayer de configurer quand en pause
            await expect(
                rent2Repay.connect(addr1).configureRent2Repay(
                    [await wxdaiToken.getAddress()],
                    [ethers.parseUnits("100", 18)],
                    604800,
                    Math.floor(Date.now() / 1000)
                )
            ).to.be.reverted;
            console.log("✅ Configuration bloquée quand en pause");

            // Essayer rent2repay quand en pause
            await expect(
                rent2Repay.connect(addr2).rent2repay(addr1.address, await wxdaiToken.getAddress())
            ).to.be.reverted;
            console.log("✅ Rent2repay bloqué quand en pause");

            // Essayer batchRent2Repay quand en pause
            await expect(
                rent2Repay.connect(addr2).batchRent2Repay(
                    [addr1.address],
                    await wxdaiToken.getAddress()
                )
            ).to.be.reverted;
            console.log("✅ BatchRent2Repay bloqué quand en pause");
        });

        it("Devrait permettre les opérations après unpause", async function () {
            // Mettre en pause puis remettre en marche
            await rent2Repay.connect(emergency).pause();
            await rent2Repay.connect(admin).unpause();

            // Configurer devrait marcher maintenant
            await expect(
                rent2Repay.connect(addr1).configureRent2Repay(
                    [await wxdaiToken.getAddress()],
                    [ethers.parseUnits("100", 18)],
                    604800,
                    Math.floor(Date.now() / 1000)
                )
            ).to.not.be.reverted;
            console.log("✅ Configuration possible après unpause");
        });
    });

    describe("Token Management", function () {
        it("Devrait tester authorizeTokenTriple et unauthorizeToken", async function () {
            // Adresses de test simples
            const testToken = "0x0000000000000000000000000000000000000010";
            const testDebtToken = "0x0000000000000000000000000000000000000011";
            const testSupplyToken = "0x0000000000000000000000000000000000000012";

            // ÉTAPE 1: Vérifier que le token n'est pas encore configuré
            const [tokenAddr1, debtToken1, supplyToken1, active1] = await rent2Repay.getTokenConfig(testToken);
            expect(active1).to.be.false;
            console.log("✅ Token initial non-configuré");

            // ÉTAPE 2: Essayer d'autoriser avec une adresse non-admin (addr1)
            await expect(
                rent2Repay.connect(addr1).authorizeTokenTriple(testToken, testDebtToken, testSupplyToken)
            ).to.be.reverted;
            console.log("✅ Autorisation avec non-admin : correctement revert");

            // ÉTAPE 3: Autoriser le triple avec une adresse admin
            await expect(
                rent2Repay.connect(admin).authorizeTokenTriple(testToken, testDebtToken, testSupplyToken)
            ).to.emit(rent2Repay, "TokenTripleAuthorized")
                .withArgs(testToken, testDebtToken, testSupplyToken);
            console.log("✅ Autorisation avec admin : succès");

            // ÉTAPE 4: Vérifier via getTokenConfig que c'est bien inséré off-chain
            const [tokenAddr2, debtToken2, supplyToken2, active2] = await rent2Repay.getTokenConfig(testToken);
            expect(tokenAddr2).to.equal(testToken);
            expect(debtToken2).to.equal(testDebtToken);
            expect(supplyToken2).to.equal(testSupplyToken);
            expect(active2).to.be.true;
            console.log("✅ getTokenConfig retourne les bonnes valeurs pour le token principal");

            // ÉTAPE 5: Vérifier aussi pour le supply token
            const [tokenAddr3, debtToken3, supplyToken3, active3] = await rent2Repay.getTokenConfig(testSupplyToken);
            expect(tokenAddr3).to.equal(testToken);
            expect(debtToken3).to.equal(testDebtToken);
            expect(supplyToken3).to.equal(testSupplyToken);
            expect(active3).to.be.true;
            console.log("✅ getTokenConfig retourne les bonnes valeurs pour le supply token");

            // ÉTAPE 6: Tester getDebtToken
            const debtTokenResult = await rent2Repay.getDebtToken(testToken);
            expect(debtTokenResult).to.equal(testDebtToken);
            console.log("✅ getDebtToken retourne la bonne valeur");

            // ÉTAPE 7: Essayer de désautoriser avec une adresse non-admin
            await expect(
                rent2Repay.connect(addr1).unauthorizeToken(testToken)
            ).to.be.reverted;
            console.log("✅ Désautorisation avec non-admin : correctement revert");

            // ÉTAPE 8: Désautoriser le token avec admin
            await expect(
                rent2Repay.connect(admin).unauthorizeToken(testToken)
            ).to.emit(rent2Repay, "TokenUnauthorized")
                .withArgs(testToken);
            console.log("✅ Désautorisation avec admin : succès");

            // ÉTAPE 9: Vérifier que le token est désactivé
            const [tokenAddr4, debtToken4, supplyToken4, active4] = await rent2Repay.getTokenConfig(testToken);
            expect(tokenAddr4).to.equal(testToken); // L'adresse reste
            expect(debtToken4).to.equal(testDebtToken); // L'adresse reste
            expect(supplyToken4).to.equal(testSupplyToken); // L'adresse reste
            expect(active4).to.be.false; // Mais inactive
            console.log("✅ Token désactivé : active = false");

            // ÉTAPE 10: Vérifier que le supply token est aussi désactivé
            const [tokenAddr5, debtToken5, supplyToken5, active5] = await rent2Repay.getTokenConfig(testSupplyToken);
            expect(active5).to.be.false;
            console.log("✅ Supply token aussi désactivé : active = false");
        });

        it("Devrait échouer si on essaie de configurer avec un token non-autorisé", async function () {
            const testToken = "0x0000000000000000000000000000000000000020";

            // Essayer de configurer avec un token qui n'existe pas
            await expect(
                rent2Repay.connect(addr1).configureRent2Repay(
                    [testToken],
                    [ethers.parseUnits("100", 18)],
                    604800,
                    Math.floor(Date.now() / 1000)
                )
            ).to.be.revertedWith("Invalid token or amount");
            console.log("✅ Configuration avec token non-autorisé : correctement revert");
        });
    });

    describe("Emergency Token Recovery", function () {
        it("Devrait tester l'envoi de tokens au contrat et emergencyTokenRecovery", async function () {
            const amountToSend = ethers.parseUnits("10", 6); // 10 USDC (6 decimals)

            // ÉTAPE 0: Donner des USDC à addr1 pour qu'il puisse en envoyer
            await usdcToken.mint(addr1.address, ethers.parseUnits("100", 6)); // 100 USDC
            console.log("✅ USDC mintés pour addr1");

            // ÉTAPE 1: Vérifier les balances initiales
            const userBalanceBefore = await usdcToken.balanceOf(addr1.address);
            const contractBalanceBefore = await usdcToken.balanceOf(await rent2Repay.getAddress());
            const adminBalanceBefore = await usdcToken.balanceOf(admin.address);

            console.log("✅ Balances initiales vérifiées");

            // ÉTAPE 2: Envoyer 10 USDC au contrat Rent2Repay
            await usdcToken.connect(addr1).transfer(await rent2Repay.getAddress(), amountToSend);
            console.log("✅ 10 USDC envoyés au contrat");

            // ÉTAPE 3: Vérifier que les tokens sont bien dans le contrat
            const contractBalanceAfter = await usdcToken.balanceOf(await rent2Repay.getAddress());
            expect(contractBalanceAfter).to.equal(contractBalanceBefore + amountToSend);
            console.log("✅ Tokens bien reçus par le contrat");

            // ÉTAPE 4: Essayer emergencyTokenRecovery avec une adresse non-admin (addr1)
            await expect(
                rent2Repay.connect(addr1).emergencyTokenRecovery(
                    await usdcToken.getAddress(),
                    amountToSend,
                    addr1.address
                )
            ).to.be.reverted;
            console.log("✅ Emergency recovery avec non-admin : correctement revert");

            // ÉTAPE 5: Faire emergencyTokenRecovery avec admin vers admin
            await expect(
                rent2Repay.connect(admin).emergencyTokenRecovery(
                    await usdcToken.getAddress(),
                    amountToSend,
                    admin.address
                )
            ).to.not.be.reverted;
            console.log("✅ Emergency recovery avec admin : succès");

            // ÉTAPE 6: Vérifier que les tokens ont été récupérés
            const contractBalanceFinal = await usdcToken.balanceOf(await rent2Repay.getAddress());
            const adminBalanceAfter = await usdcToken.balanceOf(admin.address);

            expect(contractBalanceFinal).to.equal(contractBalanceBefore);
            expect(adminBalanceAfter).to.equal(adminBalanceBefore + amountToSend);
            console.log("✅ Tokens récupérés avec succès par l'admin");
        });
    });

    describe("DAO Fees Management", function () {
        it("Devrait tester la mise à jour des frais DAO", async function () {
            const newDaoFees = 100; // 1%
            const oldFees = 50; // 0.5% (valeur par défaut)

            // ÉTAPE 1: Lire la configuration actuelle
            const [currentDaoFees, currentSenderTips] = await rent2Repay.getFeeConfiguration();
            expect(currentDaoFees).to.equal(oldFees);
            console.log("✅ Configuration fees actuelle lue");

            // ÉTAPE 2: Essayer de mettre à jour avec non-admin
            await expect(
                rent2Repay.connect(addr1).updateDaoFees(newDaoFees)
            ).to.be.reverted;
            console.log("✅ Mise à jour fees avec non-admin : correctement revert");

            // ÉTAPE 3: Mettre à jour avec admin
            await expect(
                rent2Repay.connect(admin).updateDaoFees(newDaoFees)
            ).to.emit(rent2Repay, "DaoFeesUpdated")
                .withArgs(oldFees, newDaoFees, admin.address);
            console.log("✅ Mise à jour fees avec admin : succès");

            // ÉTAPE 4: Vérifier la nouvelle configuration
            const [newCurrentDaoFees, newCurrentSenderTips] = await rent2Repay.getFeeConfiguration();
            expect(newCurrentDaoFees).to.equal(newDaoFees);
            expect(newCurrentSenderTips).to.equal(currentSenderTips); // Inchangé
            console.log("✅ Nouvelle configuration fees vérifiée");
        });

        it("Devrait tester la mise à jour des tips sender", async function () {
            const newSenderTips = 50; // 0.5%
            const oldTips = 25; // 0.25% (valeur par défaut)

            // ÉTAPE 1: Essayer de mettre à jour avec non-admin
            await expect(
                rent2Repay.connect(addr1).updateSenderTips(newSenderTips)
            ).to.be.reverted;
            console.log("✅ Mise à jour tips avec non-admin : correctement revert");

            // ÉTAPE 2: Mettre à jour avec admin
            await expect(
                rent2Repay.connect(admin).updateSenderTips(newSenderTips)
            ).to.emit(rent2Repay, "SenderTipsUpdated")
                .withArgs(oldTips, newSenderTips, admin.address);
            console.log("✅ Mise à jour tips avec admin : succès");

            // ÉTAPE 3: Vérifier la nouvelle configuration
            const [currentDaoFees, currentSenderTips] = await rent2Repay.getFeeConfiguration();
            expect(currentSenderTips).to.equal(newSenderTips);
            console.log("✅ Nouvelle configuration tips vérifiée");
        });

        it("Devrait tester la mise à jour de l'adresse trésorerie DAO", async function () {
            const newTreasuryAddress = addr2.address;

            // ÉTAPE 1: Lire la configuration actuelle
            const [token, minAmount, reductionPercentage, oldTreasuryAddress] =
                await rent2Repay.getDaoFeeReductionConfiguration();
            console.log("✅ Configuration DAO actuelle lue");

            // ÉTAPE 2: Essayer de mettre à jour avec non-admin
            await expect(
                rent2Repay.connect(addr1).updateDaoTreasuryAddress(newTreasuryAddress)
            ).to.be.reverted;
            console.log("✅ Mise à jour treasury avec non-admin : correctement revert");

            // ÉTAPE 3: Mettre à jour avec admin
            await expect(
                rent2Repay.connect(admin).updateDaoTreasuryAddress(newTreasuryAddress)
            ).to.emit(rent2Repay, "DaoTreasuryAddressUpdated")
                .withArgs(oldTreasuryAddress, newTreasuryAddress, admin.address);
            console.log("✅ Mise à jour treasury avec admin : succès");

            // ÉTAPE 4: Vérifier la nouvelle configuration
            const [newToken, newMinAmount, newReductionPercentage, newTreasuryAddress2] =
                await rent2Repay.getDaoFeeReductionConfiguration();
            expect(newTreasuryAddress2).to.equal(newTreasuryAddress);
            console.log("✅ Nouvelle adresse treasury vérifiée");
        });

        it("Devrait tester la mise à jour du token de réduction DAO", async function () {
            const reductionToken = await wxdaiToken.getAddress();

            // ÉTAPE 1: Essayer de mettre à jour avec non-admin
            await expect(
                rent2Repay.connect(addr1).updateDaoFeeReductionToken(reductionToken)
            ).to.be.reverted;
            console.log("✅ Mise à jour token réduction avec non-admin : correctement revert");

            // ÉTAPE 2: Mettre à jour avec admin
            await expect(
                rent2Repay.connect(admin).updateDaoFeeReductionToken(reductionToken)
            ).to.emit(rent2Repay, "DaoFeeReductionTokenUpdated")
                .withArgs(ethers.ZeroAddress, reductionToken, admin.address);
            console.log("✅ Mise à jour token réduction avec admin : succès");

            // ÉTAPE 3: Vérifier la nouvelle configuration
            const [newToken, minAmount, reductionPercentage, treasuryAddress] =
                await rent2Repay.getDaoFeeReductionConfiguration();
            expect(newToken).to.equal(reductionToken);
            console.log("✅ Nouveau token de réduction vérifié");
        });

        it("Devrait tester la mise à jour du seuil minimum pour l'exonération", async function () {
            const newMinAmount = ethers.parseUnits("1000", 18); // 1000 tokens

            // ÉTAPE 1: Essayer de mettre à jour avec non-admin
            await expect(
                rent2Repay.connect(addr1).updateDaoFeeReductionMinimumAmount(newMinAmount)
            ).to.be.reverted;
            console.log("✅ Mise à jour seuil avec non-admin : correctement revert");

            // ÉTAPE 2: Mettre à jour avec admin
            await expect(
                rent2Repay.connect(admin).updateDaoFeeReductionMinimumAmount(newMinAmount)
            ).to.emit(rent2Repay, "DaoFeeReductionMinimumAmountUpdated")
                .withArgs(0, newMinAmount, admin.address);
            console.log("✅ Mise à jour seuil avec admin : succès");

            // ÉTAPE 3: Vérifier la nouvelle configuration
            const [token, minAmount, reductionPercentage, treasuryAddress] =
                await rent2Repay.getDaoFeeReductionConfiguration();
            expect(minAmount).to.equal(newMinAmount);
            console.log("✅ Nouveau seuil minimum vérifié");
        });

        it("Devrait tester la mise à jour du pourcentage d'exonération", async function () {
            const newReductionPercentage = 7500; // 75%
            const oldReductionPercentage = 5000; // 50% (défaut)

            // ÉTAPE 1: Essayer de mettre à jour avec non-admin
            await expect(
                rent2Repay.connect(addr1).updateDaoFeeReductionPercentage(newReductionPercentage)
            ).to.be.reverted;
            console.log("✅ Mise à jour pourcentage avec non-admin : correctement revert");

            // ÉTAPE 2: Mettre à jour avec admin
            await expect(
                rent2Repay.connect(admin).updateDaoFeeReductionPercentage(newReductionPercentage)
            ).to.emit(rent2Repay, "DaoFeeReductionPercentageUpdated")
                .withArgs(oldReductionPercentage, newReductionPercentage, admin.address);
            console.log("✅ Mise à jour pourcentage avec admin : succès");

            // ÉTAPE 3: Vérifier la nouvelle configuration
            const [token, minAmount, reductionPercentage, treasuryAddress] =
                await rent2Repay.getDaoFeeReductionConfiguration();
            expect(reductionPercentage).to.equal(newReductionPercentage);
            console.log("✅ Nouveau pourcentage d'exonération vérifié");
        });

        it("Devrait lire toute la configuration DAO on-chain", async function () {
            // Lire la configuration complète des fees
            const [daoFees, senderTips] = await rent2Repay.getFeeConfiguration();
            console.log(`✅ Fees DAO: ${daoFees} BPS (${Number(daoFees) / 100}%)`);
            console.log(`✅ Tips Sender: ${senderTips} BPS (${Number(senderTips) / 100}%)`);

            // Lire la configuration complète de réduction DAO
            const [reductionToken, minAmount, reductionPercentage, treasuryAddress] =
                await rent2Repay.getDaoFeeReductionConfiguration();

            console.log(`✅ Token de réduction: ${reductionToken}`);
            console.log(`✅ Montant minimum: ${ethers.formatUnits(minAmount, 18)} tokens`);
            console.log(`✅ Pourcentage de réduction: ${reductionPercentage} BPS (${Number(reductionPercentage) / 100}%)`);
            console.log(`✅ Adresse treasury: ${treasuryAddress}`);

            // Vérifications de base
            expect(daoFees).to.be.a('bigint');
            expect(senderTips).to.be.a('bigint');
            expect(reductionPercentage).to.be.a('bigint');
            expect(treasuryAddress).to.not.equal(ethers.ZeroAddress);

            console.log("✅ Configuration DAO complète lue avec succès");
        });

        it("Devrait appliquer la réduction des frais DAO lors d'un remboursement réel", async function () {
            const weeklyLimit = ethers.parseUnits("100", 18);
            const debtAmount = ethers.parseUnits("50", 18);
            const tokenAmount = ethers.parseUnits("1000", 18);
            const reductionTokenAmount = ethers.parseUnits("2000", 18); // Suffisant pour la réduction
            const minAmountForReduction = ethers.parseUnits("1000", 18);
            const reductionPercentage = 5000; // 50%

            // ÉTAPE 1: Configurer le système de réduction DAO
            await rent2Repay.connect(admin).updateDaoFeeReductionToken(await wxdaiToken.getAddress());
            await rent2Repay.connect(admin).updateDaoFeeReductionMinimumAmount(minAmountForReduction);
            await rent2Repay.connect(admin).updateDaoFeeReductionPercentage(reductionPercentage);
            console.log("✅ Système de réduction DAO configuré");

            // ÉTAPE 2: Configurer l'utilisateur pour le remboursement
            await rent2Repay.connect(addr1).configureRent2Repay(
                [await usdcToken.getAddress()], // Utiliser USDC pour le remboursement
                [weeklyLimit],
                1, // 1 seconde pour le test
                Math.floor(Date.now() / 1000)
            );
            console.log("✅ Utilisateur configuré pour remboursement USDC");

            // ÉTAPE 3: Donner des tokens à l'utilisateur
            await usdcToken.mint(addr1.address, ethers.parseUnits("1000", 6)); // 1000 USDC (6 decimals)
            await usdcDebtToken.mint(addr1.address, ethers.parseUnits("50", 6)); // 50 USDC debt
            await wxdaiToken.mint(addr1.address, reductionTokenAmount); // 2000 WXDAI pour la réduction
            console.log("✅ Tokens mintés pour l'utilisateur");

            // ÉTAPE 4: Approuver les tokens
            await usdcToken.connect(addr1).approve(await rent2Repay.getAddress(), ethers.MaxUint256);
            await usdcDebtToken.connect(addr1).approve(await mockRMM.getAddress(), ethers.MaxUint256);

            // Attendre la période
            await new Promise(resolve => setTimeout(resolve, 1100));

            // ÉTAPE 5: Vérifier les balances initiales
            const daoBalanceBefore = await usdcToken.balanceOf(daoTreasury.address);
            const runnerBalanceBefore = await usdcToken.balanceOf(runner.address);
            const userWxdaiBalance = await wxdaiToken.balanceOf(addr1.address);

            console.log(`✅ Balance WXDAI utilisateur: ${ethers.formatUnits(userWxdaiBalance, 18)} (seuil: ${ethers.formatUnits(minAmountForReduction, 18)})`);
            expect(userWxdaiBalance).to.be.gte(minAmountForReduction);
            console.log("✅ Utilisateur éligible pour la réduction");

            // ÉTAPE 5.1: Vérifier la configuration de réduction
            const [reductionToken, minAmount, reductionPercentage2, treasuryAddr] = await rent2Repay.getDaoFeeReductionConfiguration();
            console.log(`✅ Configuration de réduction:`);
            console.log(`   - Token: ${reductionToken}`);
            console.log(`   - WXDAI Token: ${await wxdaiToken.getAddress()}`);
            console.log(`   - Min amount: ${ethers.formatUnits(minAmount, 18)}`);
            console.log(`   - Reduction %: ${reductionPercentage2} BPS`);
            console.log(`   - Treasury: ${treasuryAddr}`);

            expect(reductionToken).to.equal(await wxdaiToken.getAddress());
            expect(minAmount).to.equal(minAmountForReduction);
            expect(reductionPercentage2).to.equal(reductionPercentage);
            console.log("✅ Configuration de réduction vérifiée");

            // ÉTAPE 6: Effectuer le remboursement
            await rent2Repay.connect(runner).rent2repay(addr1.address, await usdcToken.getAddress());
            console.log("✅ Remboursement effectué");

            // ÉTAPE 7: Vérifier les balances après remboursement
            const daoBalanceAfter = await usdcToken.balanceOf(daoTreasury.address);
            const runnerBalanceAfter = await usdcToken.balanceOf(runner.address);

            const daoFeesReceived = daoBalanceAfter - daoBalanceBefore;
            const senderTipsReceived = runnerBalanceAfter - runnerBalanceBefore;

            console.log(`✅ Frais DAO reçus: ${ethers.formatUnits(daoFeesReceived, 6)} USDC`);
            console.log(`✅ Tips sender reçus: ${ethers.formatUnits(senderTipsReceived, 6)} USDC`);

            // ÉTAPE 8: Calculer les frais attendus avec et sans réduction
            // Le montant utilisé est le minimum entre weeklyLimit (100 USDC) et balance (1000 USDC)
            // D'après les logs, le montant utilisé est 1000 USDC (1000000000 en unités de 6 décimales)
            const actualUsedAmount = ethers.parseUnits("1000", 6); // 1000 USDC (balance complète)
            const [currentDaoFees, currentSenderTips] = await rent2Repay.getFeeConfiguration();

            // Frais DAO normaux (sans réduction)
            const normalDaoFees = (actualUsedAmount * currentDaoFees) / 10000n;
            // Frais DAO avec réduction de 50%
            const reductionAmount = (normalDaoFees * BigInt(reductionPercentage)) / 10000n;
            const expectedReducedDaoFees = normalDaoFees - reductionAmount;

            // Sender tips (pas de réduction)
            const expectedSenderTips = (actualUsedAmount * currentSenderTips) / 10000n;

            console.log(`✅ Frais DAO normaux: ${ethers.formatUnits(normalDaoFees, 6)} USDC`);
            console.log(`✅ Réduction appliquée: ${ethers.formatUnits(reductionAmount, 6)} USDC`);
            console.log(`✅ Frais DAO attendus (réduits): ${ethers.formatUnits(expectedReducedDaoFees, 6)} USDC`);
            console.log(`✅ Tips sender attendus: ${ethers.formatUnits(expectedSenderTips, 6)} USDC`);

            // ÉTAPE 9: Vérifier que la réduction a été appliquée
            expect(daoFeesReceived).to.equal(expectedReducedDaoFees);
            expect(senderTipsReceived).to.equal(expectedSenderTips);
            expect(daoFeesReceived).to.be.lt(normalDaoFees); // Vérifier que les frais sont réduits

            console.log("✅ Réduction des frais DAO appliquée avec succès!");
        });

        it("Devrait ne pas appliquer la réduction si l'utilisateur n'a pas assez de tokens", async function () {
            const weeklyLimit = ethers.parseUnits("100", 18);
            const debtAmount = ethers.parseUnits("50", 18);
            const tokenAmount = ethers.parseUnits("1000", 18);
            const insufficientTokenAmount = ethers.parseUnits("500", 18); // Insuffisant pour la réduction
            const minAmountForReduction = ethers.parseUnits("1000", 18);
            const reductionPercentage = 5000; // 50%

            // ÉTAPE 1: Configurer le système de réduction DAO
            await rent2Repay.connect(admin).updateDaoFeeReductionToken(await wxdaiToken.getAddress());
            await rent2Repay.connect(admin).updateDaoFeeReductionMinimumAmount(minAmountForReduction);
            await rent2Repay.connect(admin).updateDaoFeeReductionPercentage(reductionPercentage);
            console.log("✅ Système de réduction DAO configuré");

            // ÉTAPE 2: Configurer l'utilisateur pour le remboursement
            await rent2Repay.connect(addr1).configureRent2Repay(
                [await usdcToken.getAddress()], // Utiliser USDC pour le remboursement
                [weeklyLimit],
                1, // 1 seconde pour le test
                Math.floor(Date.now() / 1000)
            );
            console.log("✅ Utilisateur configuré pour remboursement USDC");

            // ÉTAPE 3: Donner des tokens à l'utilisateur (montant insuffisant pour la réduction)
            await usdcToken.mint(addr1.address, ethers.parseUnits("1000", 6)); // 1000 USDC (6 decimals)
            await usdcDebtToken.mint(addr1.address, ethers.parseUnits("50", 6)); // 50 USDC debt
            await wxdaiToken.mint(addr1.address, insufficientTokenAmount); // Seulement 500 WXDAI (insuffisant)
            console.log("✅ Tokens mintés pour l'utilisateur (montant insuffisant)");

            // ÉTAPE 4: Approuver les tokens
            await usdcToken.connect(addr1).approve(await rent2Repay.getAddress(), ethers.MaxUint256);
            await usdcDebtToken.connect(addr1).approve(await mockRMM.getAddress(), ethers.MaxUint256);

            // Attendre la période
            await new Promise(resolve => setTimeout(resolve, 1100));

            // ÉTAPE 5: Vérifier les balances initiales
            const daoBalanceBefore = await usdcToken.balanceOf(daoTreasury.address);
            const runnerBalanceBefore = await usdcToken.balanceOf(runner.address);
            const userWxdaiBalance = await wxdaiToken.balanceOf(addr1.address);

            console.log(`✅ Balance WXDAI utilisateur: ${ethers.formatUnits(userWxdaiBalance, 18)} (seuil: ${ethers.formatUnits(minAmountForReduction, 18)})`);
            expect(userWxdaiBalance).to.be.lt(minAmountForReduction);
            console.log("✅ Utilisateur NON éligible pour la réduction");

            // ÉTAPE 6: Effectuer le remboursement
            await rent2Repay.connect(runner).rent2repay(addr1.address, await usdcToken.getAddress());
            console.log("✅ Remboursement effectué");

            // ÉTAPE 7: Vérifier les balances après remboursement
            const daoBalanceAfter = await usdcToken.balanceOf(daoTreasury.address);
            const runnerBalanceAfter = await usdcToken.balanceOf(runner.address);

            const daoFeesReceived = daoBalanceAfter - daoBalanceBefore;
            const senderTipsReceived = runnerBalanceAfter - runnerBalanceBefore;

            console.log(`✅ Frais DAO reçus: ${ethers.formatUnits(daoFeesReceived, 6)} USDC`);
            console.log(`✅ Tips sender reçus: ${ethers.formatUnits(senderTipsReceived, 6)} USDC`);

            // ÉTAPE 8: Calculer les frais attendus SANS réduction
            // Le montant utilisé est le minimum entre weeklyLimit (100 USDC) et balance (1000 USDC)
            // D'après les logs, le montant utilisé est 1000 USDC (1000000000 en unités de 6 décimales)
            const actualUsedAmount = ethers.parseUnits("1000", 6); // 1000 USDC (balance complète)
            const [currentDaoFees, currentSenderTips] = await rent2Repay.getFeeConfiguration();

            // Frais DAO normaux (sans réduction car utilisateur non éligible)
            const expectedNormalDaoFees = (actualUsedAmount * currentDaoFees) / 10000n;
            const expectedSenderTips = (actualUsedAmount * currentSenderTips) / 10000n;

            console.log(`✅ Frais DAO attendus (normaux): ${ethers.formatUnits(expectedNormalDaoFees, 6)} USDC`);
            console.log(`✅ Tips sender attendus: ${ethers.formatUnits(expectedSenderTips, 6)} USDC`);

            // ÉTAPE 9: Vérifier qu'AUCUNE réduction n'a été appliquée
            expect(daoFeesReceived).to.equal(expectedNormalDaoFees);
            expect(senderTipsReceived).to.equal(expectedSenderTips);

            console.log("✅ Aucune réduction appliquée (utilisateur non éligible)!");
        });
    });

    describe("User Management", function () {
        it("Devrait permettre à un opérateur de supprimer un utilisateur et tester getUserConfigs", async function () {
            const weeklyLimit1 = ethers.parseUnits("100", 18);
            const weeklyLimit2 = ethers.parseUnits("200", 18);

            // ÉTAPE 1: Configurer l'utilisateur avec plusieurs tokens
            await rent2Repay.connect(addr1).configureRent2Repay(
                [await wxdaiToken.getAddress(), await usdcToken.getAddress()],
                [weeklyLimit1, weeklyLimit2],
                604800,
                Math.floor(Date.now() / 1000)
            );
            console.log("✅ Utilisateur configuré avec 2 tokens");

            // ÉTAPE 2: Vérifier que l'utilisateur est autorisé
            expect(await rent2Repay.isAuthorized(addr1.address)).to.be.true;
            console.log("✅ Utilisateur autorisé");

            // ÉTAPE 3: Tester getUserConfigs
            const [tokens, maxAmounts] = await rent2Repay.getUserConfigs(addr1.address);
            expect(tokens.length).to.equal(2);
            expect(tokens[0]).to.equal(await wxdaiToken.getAddress());
            expect(tokens[1]).to.equal(await usdcToken.getAddress());
            expect(maxAmounts[0]).to.equal(weeklyLimit1);
            expect(maxAmounts[1]).to.equal(weeklyLimit2);
            console.log("✅ getUserConfigs retourne les bonnes valeurs");

            // ÉTAPE 4: Essayer de supprimer avec une adresse non-operator
            await expect(
                rent2Repay.connect(addr2).removeUser(addr1.address)
            ).to.be.reverted;
            console.log("✅ Suppression avec non-operator : correctement revert");

            // ÉTAPE 5: Supprimer l'utilisateur avec un opérateur
            await expect(
                rent2Repay.connect(operator).removeUser(addr1.address)
            ).to.emit(rent2Repay, "Rent2RepayRevokedAll");
            console.log("✅ Suppression avec operator : succès");

            // ÉTAPE 6: Vérifier que l'utilisateur n'est plus autorisé
            expect(await rent2Repay.isAuthorized(addr1.address)).to.be.false;
            console.log("✅ Utilisateur plus autorisé après suppression");

            // ÉTAPE 7: Vérifier que getUserConfigs retourne des tableaux vides
            const [tokensAfter, maxAmountsAfter] = await rent2Repay.getUserConfigs(addr1.address);
            expect(tokensAfter.length).to.equal(0);
            expect(maxAmountsAfter.length).to.equal(0);
            console.log("✅ getUserConfigs retourne des tableaux vides après suppression");

            // ÉTAPE 8: Reconfigurer l'utilisateur pour vérifier que tout fonctionne
            await rent2Repay.connect(addr1).configureRent2Repay(
                [await wxdaiToken.getAddress()],
                [ethers.parseUnits("50", 18)],
                604800,
                Math.floor(Date.now() / 1000)
            );
            console.log("✅ Utilisateur reconfiguré avec succès");

            // ÉTAPE 9: Vérifier que l'utilisateur est de nouveau autorisé
            expect(await rent2Repay.isAuthorized(addr1.address)).to.be.true;
            console.log("✅ Utilisateur de nouveau autorisé");

            // ÉTAPE 10: Vérifier la nouvelle configuration
            const [tokensReconfig, maxAmountsReconfig] = await rent2Repay.getUserConfigs(addr1.address);
            expect(tokensReconfig.length).to.equal(1);
            expect(tokensReconfig[0]).to.equal(await wxdaiToken.getAddress());
            expect(maxAmountsReconfig[0]).to.equal(ethers.parseUnits("50", 18));
            console.log("✅ Nouvelle configuration correcte");
        });

        it("Devrait échouer si on essaie de supprimer un utilisateur non-autorisé", async function () {
            // Essayer de supprimer un utilisateur qui n'est pas configuré
            await expect(
                rent2Repay.connect(operator).removeUser(addr1.address)
            ).to.be.reverted;
            console.log("✅ Suppression d'utilisateur non-autorisé : correctement revert");
        });

        it("Devrait retourner des tableaux vides pour un utilisateur non-configuré", async function () {
            // Tester getUserConfigs pour un utilisateur non-configuré
            const [tokens, maxAmounts] = await rent2Repay.getUserConfigs(addr1.address);
            expect(tokens.length).to.equal(0);
            expect(maxAmounts.length).to.equal(0);
            console.log("✅ getUserConfigs retourne des tableaux vides pour utilisateur non-configuré");
        });
    });

    describe("Rôles pour Pause/Unpause", function () {
        it("Devrait vérifier les rôles requis", async function () {
            // Vérifier que admin a le rôle ADMIN
            const [isAdmin, isOperator, isEmergency] = await rent2Repay.connect(admin).whoami();
            expect(isAdmin).to.be.true;
            expect(isEmergency).to.be.false;
            console.log("✅ Admin a le rôle ADMIN mais pas EMERGENCY");

            // Vérifier que emergency a le rôle EMERGENCY
            const [isAdmin2, isOperator2, isEmergency2] = await rent2Repay.connect(emergency).whoami();
            expect(isAdmin2).to.be.false;
            expect(isEmergency2).to.be.true;
            console.log("✅ Emergency a le rôle EMERGENCY mais pas ADMIN");

            // Vérifier que operator a le rôle OPERATOR
            const [isAdmin3, isOperator3, isEmergency3] = await rent2Repay.connect(operator).whoami();
            expect(isAdmin3).to.be.false;
            expect(isOperator3).to.be.true;
            expect(isEmergency3).to.be.false;
            console.log("✅ Operator a le rôle OPERATOR mais pas ADMIN/EMERGENCY");

            // Vérifier que addr1 n'a aucun rôle
            const [isAdmin4, isOperator4, isEmergency4] = await rent2Repay.connect(addr1).whoami();
            expect(isAdmin4).to.be.false;
            expect(isOperator4).to.be.false;
            expect(isEmergency4).to.be.false;
            console.log("✅ addr1 n'a aucun rôle");
        });

        it("Devrait échouer si mauvais rôle pour pause", async function () {
            // pause() nécessite EMERGENCY_ROLE
            await expect(
                rent2Repay.connect(addr1).pause()
            ).to.be.reverted;
            console.log("✅ Pause échoue sans rôle EMERGENCY");

            // Même l'admin ne peut pas pause (seul emergency peut)
            await expect(
                rent2Repay.connect(admin).pause()
            ).to.be.reverted;
            console.log("✅ Pause échoue même avec rôle ADMIN");

            // Même l'operator ne peut pas pause
            await expect(
                rent2Repay.connect(operator).pause()
            ).to.be.reverted;
            console.log("✅ Pause échoue même avec rôle OPERATOR");
        });

        it("Devrait échouer si mauvais rôle pour unpause", async function () {
            // Mettre en pause d'abord
            await rent2Repay.connect(emergency).pause();

            // unpause() nécessite ADMIN_ROLE
            await expect(
                rent2Repay.connect(addr1).unpause()
            ).to.be.reverted;
            console.log("✅ Unpause échoue sans rôle ADMIN");

            // Même emergency ne peut pas unpause
            await expect(
                rent2Repay.connect(emergency).unpause()
            ).to.be.reverted;
            console.log("✅ Unpause échoue même avec rôle EMERGENCY");

            // Même operator ne peut pas unpause
            await expect(
                rent2Repay.connect(operator).unpause()
            ).to.be.reverted;
            console.log("✅ Unpause échoue même avec rôle OPERATOR");
        });

        it("Devrait réussir avec les bons rôles", async function () {
            // Emergency peut pause
            await expect(
                rent2Repay.connect(emergency).pause()
            ).to.not.be.reverted;
            console.log("✅ Emergency peut pause");

            // Admin peut unpause
            await expect(
                rent2Repay.connect(admin).unpause()
            ).to.not.be.reverted;
            console.log("✅ Admin peut unpause");
        });
    });
}); 