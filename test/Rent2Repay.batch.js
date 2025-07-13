const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupRent2Repay } = require("./utils/setupHelpers");

// Test pour la fonction batchRent2Repay
describe("Rent2Repay - Batch", function () {
    let rent2Repay, mockRMM, wxdaiToken, armmWXDAI, wxdaiDebtToken, owner, addr1, addr2, addr3, runner, daoTreasury;

    beforeEach(async function () {
        ({
            rent2Repay,
            mockRMM,
            wxdaiToken,
            armmWXDAI,
            wxdaiDebtToken,
            owner,
            addr1,
            addr2,
            addr3,
            runner,
            daoTreasury
        } = await setupRent2Repay());
    });

    it("Devrait effectuer un remboursement batch avec token de base", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("50", 18);
        const tokenAmount = ethers.parseUnits("1000", 18);

        // Configuration pour chaque utilisateur
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1, // 1 seconde pour le test
            Math.floor(Date.now() / 1000)
        );
        await rent2Repay.connect(addr2).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );
        await rent2Repay.connect(addr3).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );

        // Mint des tokens pour chaque utilisateur
        await wxdaiToken.mint(addr1.address, tokenAmount);
        await wxdaiToken.mint(addr2.address, tokenAmount);
        await wxdaiToken.mint(addr3.address, tokenAmount);

        await wxdaiDebtToken.mint(addr1.address, debtAmount);
        await wxdaiDebtToken.mint(addr2.address, debtAmount);
        await wxdaiDebtToken.mint(addr3.address, debtAmount);

        // Approbations
        await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), ethers.MaxUint256);
        await wxdaiToken.connect(addr2).approve(await rent2Repay.getAddress(), ethers.MaxUint256);
        await wxdaiToken.connect(addr3).approve(await rent2Repay.getAddress(), ethers.MaxUint256);

        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), ethers.MaxUint256);
        await wxdaiDebtToken.connect(addr2).approve(await mockRMM.getAddress(), ethers.MaxUint256);
        await wxdaiDebtToken.connect(addr3).approve(await mockRMM.getAddress(), ethers.MaxUint256);

        // Attendre la période
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Balances avant
        const balance1Before = await wxdaiToken.balanceOf(addr1.address);
        const balance2Before = await wxdaiToken.balanceOf(addr2.address);
        const balance3Before = await wxdaiToken.balanceOf(addr3.address);

        const debt1Before = await wxdaiDebtToken.balanceOf(addr1.address);
        const debt2Before = await wxdaiDebtToken.balanceOf(addr2.address);
        const debt3Before = await wxdaiDebtToken.balanceOf(addr3.address);

        // Exécuter le remboursement batch
        await rent2Repay.connect(runner).batchRent2Repay(
            [addr1.address, addr2.address, addr3.address],
            await wxdaiToken.getAddress()
        );

        // Balances après
        const balance1After = await wxdaiToken.balanceOf(addr1.address);
        const balance2After = await wxdaiToken.balanceOf(addr2.address);
        const balance3After = await wxdaiToken.balanceOf(addr3.address);

        const debt1After = await wxdaiDebtToken.balanceOf(addr1.address);
        const debt2After = await wxdaiDebtToken.balanceOf(addr2.address);
        const debt3After = await wxdaiDebtToken.balanceOf(addr3.address);

        // Vérifier que les tokens ont été prélevés et les dettes remboursées
        expect(balance1Before).to.be.gt(balance1After);
        expect(balance2Before).to.be.gt(balance2After);
        expect(balance3Before).to.be.gt(balance3After);

        expect(debt1Before).to.be.gt(debt1After);
        expect(debt2Before).to.be.gt(debt2After);
        expect(debt3Before).to.be.gt(debt3After);
    });

    it("Devrait effectuer un remboursement batch avec supply token", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("50", 18);
        const supplyTokenAmount = ethers.parseUnits("1000", 18);

        // Configuration pour chaque utilisateur
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await armmWXDAI.getAddress()],
            [weeklyLimit],
            1, // 1 seconde pour le test
            Math.floor(Date.now() / 1000)
        );
        await rent2Repay.connect(addr2).configureRent2Repay(
            [await armmWXDAI.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );
        await rent2Repay.connect(addr3).configureRent2Repay(
            [await armmWXDAI.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );

        // Mint des tokens pour chaque utilisateur
        await armmWXDAI.mint(addr1.address, supplyTokenAmount);
        await armmWXDAI.mint(addr2.address, supplyTokenAmount);
        await armmWXDAI.mint(addr3.address, supplyTokenAmount);

        await wxdaiDebtToken.mint(addr1.address, debtAmount);
        await wxdaiDebtToken.mint(addr2.address, debtAmount);
        await wxdaiDebtToken.mint(addr3.address, debtAmount);

        // Approbations
        await armmWXDAI.connect(addr1).approve(await rent2Repay.getAddress(), ethers.MaxUint256);
        await armmWXDAI.connect(addr2).approve(await rent2Repay.getAddress(), ethers.MaxUint256);
        await armmWXDAI.connect(addr3).approve(await rent2Repay.getAddress(), ethers.MaxUint256);

        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), ethers.MaxUint256);
        await wxdaiDebtToken.connect(addr2).approve(await mockRMM.getAddress(), ethers.MaxUint256);
        await wxdaiDebtToken.connect(addr3).approve(await mockRMM.getAddress(), ethers.MaxUint256);

        // Attendre la période
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Balances avant
        const balance1Before = await armmWXDAI.balanceOf(addr1.address);
        const balance2Before = await armmWXDAI.balanceOf(addr2.address);
        const balance3Before = await armmWXDAI.balanceOf(addr3.address);

        const debt1Before = await wxdaiDebtToken.balanceOf(addr1.address);
        const debt2Before = await wxdaiDebtToken.balanceOf(addr2.address);
        const debt3Before = await wxdaiDebtToken.balanceOf(addr3.address);

        // Exécuter le remboursement batch avec supply token
        await rent2Repay.connect(runner).batchRent2Repay(
            [addr1.address, addr2.address, addr3.address],
            await armmWXDAI.getAddress()
        );

        // Balances après
        const balance1After = await armmWXDAI.balanceOf(addr1.address);
        const balance2After = await armmWXDAI.balanceOf(addr2.address);
        const balance3After = await armmWXDAI.balanceOf(addr3.address);

        const debt1After = await wxdaiDebtToken.balanceOf(addr1.address);
        const debt2After = await wxdaiDebtToken.balanceOf(addr2.address);
        const debt3After = await wxdaiDebtToken.balanceOf(addr3.address);

        // Vérifier que les supply tokens ont été prélevés et les dettes remboursées
        expect(balance1Before).to.be.gt(balance1After);
        expect(balance2Before).to.be.gt(balance2After);
        expect(balance3Before).to.be.gt(balance3After);

        expect(debt1Before).to.be.gt(debt1After);
        expect(debt2Before).to.be.gt(debt2After);
        expect(debt3Before).to.be.gt(debt3After);
    });

    it("Devrait calculer les fees correctement lors d'un batch", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("50", 18);
        const tokenAmount = ethers.parseUnits("1000", 18);

        // Configuration pour chaque utilisateur
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );
        await rent2Repay.connect(addr2).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );

        // Mint des tokens
        await wxdaiToken.mint(addr1.address, tokenAmount);
        await wxdaiToken.mint(addr2.address, tokenAmount);
        await wxdaiDebtToken.mint(addr1.address, debtAmount);
        await wxdaiDebtToken.mint(addr2.address, debtAmount);

        // Approbations
        await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), ethers.MaxUint256);
        await wxdaiToken.connect(addr2).approve(await rent2Repay.getAddress(), ethers.MaxUint256);
        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), ethers.MaxUint256);
        await wxdaiDebtToken.connect(addr2).approve(await mockRMM.getAddress(), ethers.MaxUint256);

        // Attendre la période
        await new Promise(resolve => setTimeout(resolve, 1100));

        const runnerBalanceBefore = await wxdaiToken.balanceOf(runner.address);
        const daoBalanceBefore = await wxdaiToken.balanceOf(daoTreasury.address);

        // Exécuter le remboursement batch
        await rent2Repay.connect(runner).batchRent2Repay(
            [addr1.address, addr2.address],
            await wxdaiToken.getAddress()
        );

        const runnerBalanceAfter = await wxdaiToken.balanceOf(runner.address);
        const daoBalanceAfter = await wxdaiToken.balanceOf(daoTreasury.address);

        // Vérifier que les fees ont été distribuées (somme des fees des deux utilisateurs)
        expect(runnerBalanceAfter).to.be.gt(runnerBalanceBefore); // Sender tips
        expect(daoBalanceAfter).to.be.gt(daoBalanceBefore);       // DAO fees
    });

    it("Devrait échouer si un utilisateur n'est pas configuré", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);

        // Configuration seulement pour addr1
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );

        // Attendre la période
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Essayer de faire un batch avec addr2 non configuré
        await expect(
            rent2Repay.connect(runner).batchRent2Repay(
                [addr1.address, addr2.address],
                await wxdaiToken.getAddress()
            )
        ).to.be.revertedWith("User not configured for token");
    });

    it("Devrait effectuer un remboursement batch avec différence > 0 (mode 1)", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("200", 18); // Augmenté pour couvrir les frais
        const tokenAmount = ethers.parseUnits("1000", 18);

        // Configuration pour chaque utilisateur
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );
        await rent2Repay.connect(addr2).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );

        // Mint des tokens pour chaque utilisateur
        await wxdaiToken.mint(addr1.address, tokenAmount);
        await wxdaiToken.mint(addr2.address, tokenAmount);
        await wxdaiDebtToken.mint(addr1.address, debtAmount);
        await wxdaiDebtToken.mint(addr2.address, debtAmount);

        // Approvals pour chaque utilisateur
        await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), tokenAmount);
        await wxdaiToken.connect(addr2).approve(await rent2Repay.getAddress(), tokenAmount);
        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), debtAmount);
        await wxdaiDebtToken.connect(addr2).approve(await mockRMM.getAddress(), debtAmount);

        // Vérifier le mode initial
        expect(await mockRMM.getMode()).to.equal(0);

        // Modifier le mode à 1
        await mockRMM.setMode(1);

        // Vérifier le mode modifié
        expect(await mockRMM.getMode()).to.equal(1);

        // Balances avant
        const user1BalanceBefore = await wxdaiToken.balanceOf(addr1.address);
        const user2BalanceBefore = await wxdaiToken.balanceOf(addr2.address);
        const user1DebtBalanceBefore = await wxdaiDebtToken.balanceOf(addr1.address);
        const user2DebtBalanceBefore = await wxdaiDebtToken.balanceOf(addr2.address);

        // Exécuter le remboursement batch
        await rent2Repay.connect(owner).batchRent2Repay(
            [addr1.address, addr2.address],
            await wxdaiToken.getAddress()
        );

        // Balances après
        const user1BalanceAfter = await wxdaiToken.balanceOf(addr1.address);
        const user2BalanceAfter = await wxdaiToken.balanceOf(addr2.address);
        const user1DebtBalanceAfter = await wxdaiDebtToken.balanceOf(addr1.address);
        const user2DebtBalanceAfter = await wxdaiDebtToken.balanceOf(addr2.address);

        // Calculer les frais attendus : 0.5% DAO + 0.25% sender = 0.75% total
        const expectedFees = (weeklyLimit * 75n) / 10000n; // 0.75% de 100 ether = 750 wei
        const expectedDebtReduction = weeklyLimit - expectedFees - 100n; // montant pour repay - différence RMM

        // Vérifications pour addr1
        // En mode 1, la différence de 100 wei réduit les frais, donc l'utilisateur récupère plus
        const expectedBalance1 = user1BalanceBefore - weeklyLimit + 100n;
        expect(user1BalanceAfter).to.be.greaterThanOrEqual(expectedBalance1);
        expect(user1DebtBalanceAfter).to.equal(user1DebtBalanceBefore - expectedDebtReduction);

        // Vérifications pour addr2
        const expectedBalance2 = user2BalanceBefore - weeklyLimit + 100n;
        expect(user2BalanceAfter).to.be.greaterThanOrEqual(expectedBalance2);
        expect(user2DebtBalanceAfter).to.equal(user2DebtBalanceBefore - expectedDebtReduction);

        // Remettre le mode à 0
        await mockRMM.setMode(0);
        expect(await mockRMM.getMode()).to.equal(0);
    });

    it("Devrait tester la gestion du mode RMM en batch", async function () {
        // Test mode initial
        expect(await mockRMM.getMode()).to.equal(0);

        // Test changement de mode
        await mockRMM.setMode(1);
        expect(await mockRMM.getMode()).to.equal(1);

        // Test retour au mode 0
        await mockRMM.setMode(0);
        expect(await mockRMM.getMode()).to.equal(0);

        // Test mode invalide
        await expect(mockRMM.setMode(3)).to.be.revertedWith("Mode must be 0, 1, or 2");
    });

    it("Devrait ajuster les sender tips en batch quand la différence est plus grande que les frais DAO", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("200", 18);
        const tokenAmount = ethers.parseUnits("1000", 18);

        // Configuration pour chaque utilisateur
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );
        await rent2Repay.connect(addr2).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );

        // Mint des tokens pour chaque utilisateur
        await wxdaiToken.mint(addr1.address, tokenAmount);
        await wxdaiToken.mint(addr2.address, tokenAmount);
        await wxdaiDebtToken.mint(addr1.address, debtAmount);
        await wxdaiDebtToken.mint(addr2.address, debtAmount);

        // Approvals pour chaque utilisateur
        await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), tokenAmount);
        await wxdaiToken.connect(addr2).approve(await rent2Repay.getAddress(), tokenAmount);
        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), debtAmount);
        await wxdaiDebtToken.connect(addr2).approve(await mockRMM.getAddress(), debtAmount);

        // Calculer les frais DAO (0.5% de 100 ether) + 200 wei pour dépasser
        const expectedDaoFees = (weeklyLimit * 50n) / 10000n; // 0.5% = 50 BPS
        const bigDifference = expectedDaoFees + 200n; // Plus que les frais DAO

        // Configurer le mode personnalisé avec une différence importante
        await mockRMM.setMode(2);
        await mockRMM.setCustomDifference(bigDifference);

        // Balances avant
        const user1BalanceBefore = await wxdaiToken.balanceOf(addr1.address);
        const user2BalanceBefore = await wxdaiToken.balanceOf(addr2.address);

        // Exécuter le remboursement batch
        await rent2Repay.connect(owner).batchRent2Repay(
            [addr1.address, addr2.address],
            await wxdaiToken.getAddress()
        );

        // Balances après
        const user1BalanceAfter = await wxdaiToken.balanceOf(addr1.address);
        const user2BalanceAfter = await wxdaiToken.balanceOf(addr2.address);

        // Vérifier que les utilisateurs ont récupéré leurs différences
        expect(user1BalanceAfter).to.be.greaterThan(user1BalanceBefore - weeklyLimit);
        expect(user2BalanceAfter).to.be.greaterThan(user2BalanceBefore - weeklyLimit);

        // Remettre le mode à 0
        await mockRMM.setMode(0);
    });

    it("Devrait gérer une différence égale aux frais DAO totaux en batch", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const debtAmount = ethers.parseUnits("200", 18);
        const tokenAmount = ethers.parseUnits("1000", 18);

        // Configuration pour chaque utilisateur
        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );
        await rent2Repay.connect(addr2).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            1,
            Math.floor(Date.now() / 1000)
        );

        // Mint des tokens pour chaque utilisateur
        await wxdaiToken.mint(addr1.address, tokenAmount);
        await wxdaiToken.mint(addr2.address, tokenAmount);
        await wxdaiDebtToken.mint(addr1.address, debtAmount);
        await wxdaiDebtToken.mint(addr2.address, debtAmount);

        // Approvals pour chaque utilisateur
        await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), tokenAmount);
        await wxdaiToken.connect(addr2).approve(await rent2Repay.getAddress(), tokenAmount);
        await wxdaiDebtToken.connect(addr1).approve(await mockRMM.getAddress(), debtAmount);
        await wxdaiDebtToken.connect(addr2).approve(await mockRMM.getAddress(), debtAmount);

        // Calculer les frais DAO exacts (0.5% de 100 ether)
        const expectedDaoFees = (weeklyLimit * 50n) / 10000n; // 0.5% = 50 BPS

        // Configurer le mode personnalisé avec une différence exactement égale aux frais DAO
        await mockRMM.setMode(2);
        await mockRMM.setCustomDifference(expectedDaoFees);

        // Balances avant
        const user1BalanceBefore = await wxdaiToken.balanceOf(addr1.address);
        const user2BalanceBefore = await wxdaiToken.balanceOf(addr2.address);

        // Exécuter le remboursement batch
        await rent2Repay.connect(owner).batchRent2Repay(
            [addr1.address, addr2.address],
            await wxdaiToken.getAddress()
        );

        // Balances après
        const user1BalanceAfter = await wxdaiToken.balanceOf(addr1.address);
        const user2BalanceAfter = await wxdaiToken.balanceOf(addr2.address);

        // Vérifier que les utilisateurs ont récupéré leurs différences
        expect(user1BalanceAfter).to.be.greaterThan(user1BalanceBefore - weeklyLimit);
        expect(user2BalanceAfter).to.be.greaterThan(user2BalanceBefore - weeklyLimit);

        // Remettre le mode à 0
        await mockRMM.setMode(0);
    });

    it("Devrait tester le nouveau mode 2 du RMM en batch", async function () {
        // Test mode initial
        expect(await mockRMM.getMode()).to.equal(0);

        // Test changement de mode vers 2
        await mockRMM.setMode(2);
        expect(await mockRMM.getMode()).to.equal(2);

        // Test de la différence personnalisée
        await mockRMM.setCustomDifference(1000);
        expect(await mockRMM.getCustomDifference()).to.equal(1000);

        // Test retour au mode 0
        await mockRMM.setMode(0);
        expect(await mockRMM.getMode()).to.equal(0);

        // Test mode invalide
        await expect(mockRMM.setMode(3)).to.be.revertedWith("Mode must be 0, 1, or 2");
    });
}); 