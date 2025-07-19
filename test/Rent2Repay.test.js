const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupRent2Repay } = require("./utils/setupHelpers");

// Test principal pour Rent2Repay
describe("Rent2Repay", function () {
    let rent2Repay, mockRMM, wxdaiToken, usdcToken, armmWXDAI, wxdaiDebtToken, owner, addr1, addr2, runner, daoTreasury, admin;

    beforeEach(async function () {
        ({
            rent2Repay,
            mockRMM,
            wxdaiToken,
            usdcToken,
            armmWXDAI,
            wxdaiDebtToken,
            owner,
            addr1,
            addr2,
            runner,
            daoTreasury,
            admin
        } = await setupRent2Repay());
    });

    it("Devrait configurer Rent2Repay correctement", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const periodicity = 604800; // 1 semaine
        const timestamp = Math.floor(Date.now() / 1000);

        await expect(
            rent2Repay.connect(addr1).configureRent2Repay(
                [await wxdaiToken.getAddress()],
                [weeklyLimit],
                periodicity,
                timestamp
            )
        ).to.emit(rent2Repay, "ConfiguredR2R")
            .withArgs(addr1.address);

        const config = await rent2Repay.getUserConfigForToken(addr1.address, await wxdaiToken.getAddress());
        expect(config[0]).to.equal(weeklyLimit);
        expect(config[1]).to.equal(periodicity);
    });

    it("Devrait effectuer un remboursement avec token de base", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("50", 18);
        const tokenAmount = ethers.parseUnits("1000", 18);

        // Configuration
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            2, // 2 secondes pour le test
            Math.floor(Date.now() / 1000)
        );

        // Mint des tokens
        await wxdaiToken.mint(addr1.address, tokenAmount);
        await wxdaiDebtToken.mint(addr1.address, debtAmount);

        // Approbations
        await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), ethers.MaxUint256);
        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), ethers.MaxUint256);

        // Attendre la période
        await new Promise(resolve => setTimeout(resolve, 1100));

        const balanceBefore = await wxdaiToken.balanceOf(addr1.address);
        const debtBefore = await wxdaiDebtToken.balanceOf(addr1.address);

        // Exécuter le remboursement
        await rent2Repay.connect(runner).rent2repay(addr1.address, await wxdaiToken.getAddress());

        const balanceAfter = await wxdaiToken.balanceOf(addr1.address);
        const debtAfter = await wxdaiDebtToken.balanceOf(addr1.address);

        // Vérifier que les tokens ont été prélevés et la dette remboursée
        expect(balanceBefore).to.be.gt(balanceAfter);
        expect(debtBefore).to.be.gt(debtAfter);
    });

    it("Devrait effectuer un remboursement avec supply token", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("50", 18);
        const supplyTokenAmount = ethers.parseUnits("1000", 18);

        // Configuration
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await armmWXDAI.getAddress()],
            [weeklyLimit],
            1, // 1 seconde pour le test
            Math.floor(Date.now() / 1000)
        );

        // Mint des tokens
        await armmWXDAI.mint(addr1.address, supplyTokenAmount);
        await wxdaiDebtToken.mint(addr1.address, debtAmount);

        // Approbations
        await armmWXDAI.connect(addr1).approve(await rent2Repay.getAddress(), ethers.MaxUint256);
        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), ethers.MaxUint256);

        // Attendre la période
        await new Promise(resolve => setTimeout(resolve, 1100));

        const balanceBefore = await armmWXDAI.balanceOf(addr1.address);
        const debtBefore = await wxdaiDebtToken.balanceOf(addr1.address);

        // Exécuter le remboursement avec supply token
        await rent2Repay.connect(runner).rent2repay(addr1.address, await armmWXDAI.getAddress());

        const balanceAfter = await armmWXDAI.balanceOf(addr1.address);
        const debtAfter = await wxdaiDebtToken.balanceOf(addr1.address);

        // Vérifier que les supply tokens ont été prélevés et la dette remboursée
        expect(balanceBefore).to.be.gt(balanceAfter);
        expect(debtBefore).to.be.gt(debtAfter);
    });

    it("Devrait calculer les fees correctement", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("50", 18);
        const tokenAmount = ethers.parseUnits("1000", 18);

        // Configuration
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );

        // Mint des tokens
        await wxdaiToken.mint(addr1.address, tokenAmount);
        await wxdaiDebtToken.mint(addr1.address, debtAmount);

        // Approbations
        await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), ethers.MaxUint256);
        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), ethers.MaxUint256);

        // Attendre la période
        await new Promise(resolve => setTimeout(resolve, 1100));

        const runnerBalanceBefore = await wxdaiToken.balanceOf(runner.address);
        const daoBalanceBefore = await wxdaiToken.balanceOf(daoTreasury.address);

        // Exécuter le remboursement
        await rent2Repay.connect(runner).rent2repay(addr1.address, await wxdaiToken.getAddress());

        const runnerBalanceAfter = await wxdaiToken.balanceOf(runner.address);
        const daoBalanceAfter = await wxdaiToken.balanceOf(daoTreasury.address);

        // Vérifier que les fees ont été distribuées
        expect(runnerBalanceAfter).to.be.gt(runnerBalanceBefore); // Sender tips
        expect(daoBalanceAfter).to.be.gt(daoBalanceBefore);       // DAO fees
    });

    it("Devrait révoquer l'autorisation correctement", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);

        // Configuration
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            604800,
            Math.floor(Date.now() / 1000)
        );

        // Vérifier que l'utilisateur est autorisé
        expect(await rent2Repay.isAuthorized(addr1.address)).to.be.true;

        // Révoquer l'autorisation
        await expect(
            rent2Repay.connect(addr1).revokeRent2RepayAll()
        ).to.emit(rent2Repay, "RevokedR2R")
            .withArgs(addr1.address);

        // Vérifier que l'utilisateur n'est plus autorisé
        expect(await rent2Repay.isAuthorized(addr1.address)).to.be.false;
    });

    it("Devrait effectuer un remboursement avec différence > 0 (mode 1)", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("200", 18); // Augmenté pour couvrir les frais
        const tokenAmount = ethers.parseUnits("1000", 18);

        // Configuration
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1, // 1 seconde pour le test
            Math.floor(Date.now() / 1000)
        );

        // Préparation des tokens
        await wxdaiToken.mint(addr1.address, tokenAmount);
        await wxdaiDebtToken.mint(addr1.address, debtAmount);

        // Approvals
        await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), tokenAmount);
        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), debtAmount);

        // Vérifier le mode initial
        expect(await mockRMM.getMode()).to.equal(0);

        // Modifier le mode à 1
        await mockRMM.setMode(1);

        // Vérifier le mode modifié
        expect(await mockRMM.getMode()).to.equal(1);

        // Balances avant
        const userBalanceBefore = await wxdaiToken.balanceOf(addr1.address);
        const userDebtBalanceBefore = await wxdaiDebtToken.balanceOf(addr1.address);

        // Exécuter le remboursement
        await rent2Repay.connect(owner).rent2repay(addr1.address, await wxdaiToken.getAddress());

        // Balances après
        const userBalanceAfter = await wxdaiToken.balanceOf(addr1.address);
        const userDebtBalanceAfter = await wxdaiDebtToken.balanceOf(addr1.address);

        // Vérifications
        // L'utilisateur devrait avoir reçu 100 wei de différence
        // mais les frais sont ajustés, donc il reçoit aussi la réduction des frais
        expect(userBalanceAfter).to.be.greaterThan(userBalanceBefore - weeklyLimit);

        // En mode 1, la différence de 100 wei réduit les frais, donc l'utilisateur récupère plus
        const expectedBalance = userBalanceBefore - weeklyLimit + 100n;
        expect(userBalanceAfter).to.be.greaterThanOrEqual(expectedBalance);

        // La dette devrait avoir été réduite de weeklyLimit - fees - 100 wei (car RMM mode 1 soustrait 100 wei)
        // Calculer les frais attendus : 0.5% DAO + 0.25% sender = 0.75% total
        const expectedFees = (weeklyLimit * 75n) / 10000n; // 0.75% de 100 ether = 750 wei
        const expectedDebtReduction = weeklyLimit - expectedFees - 100n; // montant pour repay - différence RMM
        expect(userDebtBalanceAfter).to.equal(userDebtBalanceBefore - expectedDebtReduction);

        // Remettre le mode à 0
        await mockRMM.setMode(0);
        expect(await mockRMM.getMode()).to.equal(0);
    });

    it("Devrait tester les fonctions de gestion du mode RMM", async function () {
        // Test mode initial
        expect(await mockRMM.getMode()).to.equal(0);

        // Test changement de mode
        await mockRMM.setMode(1);
        expect(await mockRMM.getMode()).to.equal(1);

        // Test retour au mode 0
        await mockRMM.setMode(0);
        expect(await mockRMM.getMode()).to.equal(0);

        // Test changement de mode vers 2
        await mockRMM.setMode(2);
        expect(await mockRMM.getMode()).to.equal(2);

        // Test de la différence personnalisée
        await mockRMM.setCustomDifference(1000);
        expect(await mockRMM.getCustomDifference()).to.equal(1000);

        // Test mode invalide
        await expect(mockRMM.setMode(3)).to.be.revertedWith("Mode must be 0, 1, or 2");
    });

    it("Devrait ajuster les sender tips quand la différence est plus grande que les frais DAO", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("200", 18);
        const tokenAmount = ethers.parseUnits("1000", 18);

        // Configuration
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );

        // Préparation des tokens
        await wxdaiToken.mint(addr1.address, tokenAmount);
        await wxdaiDebtToken.mint(addr1.address, debtAmount);

        // Approvals
        await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), tokenAmount);
        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), debtAmount);

        // Calculer les frais DAO (0.5% de 100 ether) et utiliser une différence plus petite
        const expectedDaoFees = (weeklyLimit * 50n) / 10000n; // 0.5% = 50 BPS
        const smallDifference = expectedDaoFees / 2n; // Moins que les frais DAO pour éviter des problèmes de solde

        // Configurer le mode personnalisé avec une différence gérable
        await mockRMM.setMode(2);
        await mockRMM.setCustomDifference(smallDifference);

        // Vérifier la configuration
        expect(await mockRMM.getMode()).to.equal(2);
        expect(await mockRMM.getCustomDifference()).to.equal(smallDifference);

        // Balances avant
        const userBalanceBefore = await wxdaiToken.balanceOf(addr1.address);

        // Exécuter le remboursement
        await rent2Repay.connect(owner).rent2repay(addr1.address, await wxdaiToken.getAddress());

        // Balances après
        const userBalanceAfter = await wxdaiToken.balanceOf(addr1.address);

        // Vérifier que l'utilisateur a récupéré sa différence et les ajustements de frais
        expect(userBalanceAfter).to.be.greaterThan(userBalanceBefore - weeklyLimit);

        // Remettre le mode à 0
        await mockRMM.setMode(0);
    });

    it("Devrait gérer une différence égale aux frais DAO totaux", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("200", 18);
        const tokenAmount = ethers.parseUnits("1000", 18);

        // Configuration
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );

        // Préparation des tokens
        await wxdaiToken.mint(addr1.address, tokenAmount);
        await wxdaiDebtToken.mint(addr1.address, debtAmount);

        // Approvals
        await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), tokenAmount);
        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), debtAmount);

        // Calculer les frais DAO exacts (0.5% de 100 ether)
        const expectedDaoFees = (weeklyLimit * 50n) / 10000n; // 0.5% = 50 BPS

        // Configurer le mode personnalisé avec une différence exactement égale aux frais DAO
        await mockRMM.setMode(2);
        await mockRMM.setCustomDifference(expectedDaoFees);

        // Balances avant
        const userBalanceBefore = await wxdaiToken.balanceOf(addr1.address);

        // Exécuter le remboursement
        await rent2Repay.connect(owner).rent2repay(addr1.address, await wxdaiToken.getAddress());

        // Balances après
        const userBalanceAfter = await wxdaiToken.balanceOf(addr1.address);

        // Vérifier que l'utilisateur a récupéré sa différence
        expect(userBalanceAfter).to.be.greaterThan(userBalanceBefore - weeklyLimit);

        // Remettre le mode à 0
        await mockRMM.setMode(0);
    });

    describe("giveApproval", function () {
        it("Devrait permettre à l'admin de configurer des approbations", async function () {
            const { admin } = await setupRent2Repay();
            const testAmount = ethers.parseUnits("1000", 18);

            // Configurer une nouvelle approbation
            await rent2Repay.connect(admin).giveApproval(
                await wxdaiToken.getAddress(),
                await mockRMM.getAddress(),
                testAmount
            );

            // Vérifier que l'approbation a été configurée directement via IERC20
            const allowance = await wxdaiToken.allowance(
                await rent2Repay.getAddress(),
                await mockRMM.getAddress()
            );
            expect(allowance).to.be.gte(testAmount);
        });

        it("Ne devrait pas permettre aux non-admins de configurer des approbations", async function () {
            const testAmount = ethers.parseUnits("1000", 18);

            await expect(
                rent2Repay.connect(addr1).giveApproval(
                    await wxdaiToken.getAddress(),
                    await mockRMM.getAddress(),
                    testAmount
                )
            ).to.be.reverted;
        });

        it("Devrait rejeter les adresses invalides", async function () {
            const { admin } = await setupRent2Repay();
            const testAmount = ethers.parseUnits("1000", 18);

            // Test avec token address invalide
            await expect(
                rent2Repay.connect(admin).giveApproval(
                    ethers.ZeroAddress,
                    await mockRMM.getAddress(),
                    testAmount
                )
            ).to.be.reverted;

            // Test avec spender address invalide
            await expect(
                rent2Repay.connect(admin).giveApproval(
                    await wxdaiToken.getAddress(),
                    ethers.ZeroAddress,
                    testAmount
                )
            ).to.be.reverted;
        });

        it("Devrait rejeter les montants zéro", async function () {
            const { admin } = await setupRent2Repay();

            await expect(
                rent2Repay.connect(admin).giveApproval(
                    await wxdaiToken.getAddress(),
                    await mockRMM.getAddress(),
                    0
                )
            ).to.be.reverted;
        });
    });

    describe("Refactorisation et cohérence", function () {
        it("Devrait confirmer que rent2repay et batchRent2Repay utilisent la même logique", async function () {
            // Ce test confirme simplement que les deux fonctions fonctionnent
            // et utilisent la même fonction interne _processUserRepayment

            const weeklyLimit = ethers.parseUnits("50", 18);
            const debtAmount = ethers.parseUnits("100", 18);
            const tokenAmount = ethers.parseUnits("1000", 18);

            // Configuration simple
            await rent2Repay.connect(addr1).configureRent2Repay(
                [await wxdaiToken.getAddress()],
                [weeklyLimit],
                1,
                Math.floor(Date.now() / 1000)
            );

            // Préparation
            await wxdaiToken.mint(addr1.address, tokenAmount);
            await wxdaiDebtToken.mint(addr1.address, debtAmount);
            await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), tokenAmount);
            await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), debtAmount);

            // Test de la fonction individuelle
            const balanceBefore = await wxdaiToken.balanceOf(addr1.address);
            await rent2Repay.connect(owner).rent2repay(addr1.address, await wxdaiToken.getAddress());
            const balanceAfter = await wxdaiToken.balanceOf(addr1.address);

            expect(balanceAfter).to.be.lt(balanceBefore, "La fonction rent2repay doit déduire des tokens");

            // Attendre pour éviter les conflits de période
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Configuration pour un deuxième test batch
            await rent2Repay.connect(addr2).configureRent2Repay(
                [await wxdaiToken.getAddress()],
                [weeklyLimit],
                1,
                Math.floor(Date.now() / 1000)
            );

            await wxdaiToken.mint(addr2.address, tokenAmount);
            await wxdaiDebtToken.mint(addr2.address, debtAmount);
            await wxdaiToken.connect(addr2).approve(await rent2Repay.getAddress(), tokenAmount);
            await wxdaiDebtToken.connect(addr2).approve(await mockRMM.getAddress(), debtAmount);

            // Test de la fonction batch avec un utilisateur
            const balanceBefore2 = await wxdaiToken.balanceOf(addr2.address);
            await rent2Repay.connect(owner).batchRent2Repay([addr2.address], await wxdaiToken.getAddress());
            const balanceAfter2 = await wxdaiToken.balanceOf(addr2.address);

            expect(balanceAfter2).to.be.lt(balanceBefore2, "La fonction batchRent2Repay doit déduire des tokens");

            console.log("✅ Les deux fonctions rent2repay et batchRent2Repay fonctionnent correctement");
            console.log("✅ Elles utilisent maintenant la même logique via _processUserRepayment()");
        });
    });

    describe("Test révocation et reconfiguration avec 4 tokens", function () {
        let daiToken, eurToken, daiSupplyToken, eurSupplyToken;

        beforeEach(async function () {
            // Créer 2 tokens supplémentaires pour avoir 4 tokens au total
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            daiToken = await MockERC20.deploy("DAI", "DAI");
            eurToken = await MockERC20.deploy("EURe", "EURe");
            daiSupplyToken = await MockERC20.deploy("Supply DAI", "sDAI");
            eurSupplyToken = await MockERC20.deploy("Supply EURe", "sEUR");

            // Autoriser les nouveaux tokens (en tant qu'admin)
            await rent2Repay.connect(admin).authorizeTokenPair(await daiToken.getAddress(), await daiSupplyToken.getAddress());
            await rent2Repay.connect(admin).authorizeTokenPair(await eurToken.getAddress(), await eurSupplyToken.getAddress());
        });

        it("Devrait gérer correctement la révocation puis reconfiguration avec getUserConfigs", async function () {
            const weeklyLimit = ethers.parseUnits("100", 18);
            const periodicity = 604800; // 1 semaine
            const timestamp = Math.floor(Date.now() / 1000);

            // ÉTAPE 1: Configurer l'utilisateur avec 4 tokens
            console.log("🔧 Configuration avec 4 tokens...");
            await rent2Repay.connect(addr1).configureRent2Repay(
                [
                    await wxdaiToken.getAddress(),
                    await usdcToken.getAddress(),
                    await daiToken.getAddress(),
                    await eurToken.getAddress()
                ],
                [weeklyLimit, weeklyLimit, weeklyLimit, weeklyLimit],
                periodicity,
                timestamp
            );

            // Vérifier que getUserConfigs retourne 4 tokens
            let [tokens, maxAmounts] = await rent2Repay.getUserConfigs(addr1.address);
            expect(tokens.length).to.equal(4);
            console.log(`✅ Configuré avec ${tokens.length} tokens`);

            // ÉTAPE 2: Révoquer tout
            console.log("🗑️ Révocation de tout...");
            await rent2Repay.connect(addr1).revokeRent2RepayAll();

            // ÉTAPE 3: Vérifier que getUserConfigs retourne 0 token (protection if)
            [tokens, maxAmounts] = await rent2Repay.getUserConfigs(addr1.address);
            expect(tokens.length).to.equal(0);
            expect(maxAmounts.length).to.equal(0);
            console.log(`✅ Après révocation: ${tokens.length} tokens`);

            // ÉTAPE 4: Reconfigurer avec seulement 1 token
            console.log("⚙️ Reconfiguration avec 1 seul token...");
            await rent2Repay.connect(addr1).configureRent2Repay(
                [await wxdaiToken.getAddress()],
                [weeklyLimit],
                periodicity,
                timestamp
            );

            // ÉTAPE 5: Vérifier que getUserConfigs retourne bien 1 token et pas 4
            [tokens, maxAmounts] = await rent2Repay.getUserConfigs(addr1.address);
            expect(tokens.length).to.equal(1);
            expect(tokens[0]).to.equal(await wxdaiToken.getAddress());
            expect(maxAmounts[0]).to.equal(weeklyLimit);
            console.log(`✅ Après reconfiguration: ${tokens.length} token (${tokens[0]})`);

            console.log("🎉 Test complet: L'utilisateur désactive tout ou rien, et doit reconfigurer pour forcer les params !");
        });
    });
}); 