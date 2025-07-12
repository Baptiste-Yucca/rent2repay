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
}); 