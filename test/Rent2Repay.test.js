const { expect } = require("chai");
const { ethers } = require("hardhat");
const { setupRent2Repay } = require("./utils/setupHelpers");

// Test principal pour Rent2Repay
describe("Rent2Repay", function () {
    let rent2Repay, mockRMM, wxdaiToken, armmWXDAI, wxdaiDebtToken, owner, addr1, addr2, runner, daoTreasury;

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
            runner,
            daoTreasury
        } = await setupRent2Repay());
    });

    it("Devrait configurer Rent2Repay correctement", async function () {
        const weeklyLimit = ethers.parseUnits("100", 18);
        const periodicity = 604800; // 1 semaine
        const timestamp = Math.floor(Date.now() / 1000);

        await rent2Repay.connect(addr1).configureRent2Repay(
            [await wxdaiToken.getAddress()],
            [weeklyLimit],
            periodicity,
            timestamp
        );

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
            1, // 1 seconde pour le test
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
        await rent2Repay.connect(addr1).revokeRent2RepayAll();

        // Vérifier que l'utilisateur n'est plus autorisé
        expect(await rent2Repay.isAuthorized(addr1.address)).to.be.false;
    });
}); 