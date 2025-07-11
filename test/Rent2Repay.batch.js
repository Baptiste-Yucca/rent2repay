const { expect } = require("chai");
const { ethers } = require("hardhat");

// Début du test pour la fonction batchRent2Repay

describe("Rent2Repay - Batch", function () {
    let Rent2Repay, rent2Repay, owner, addr1, addr2, addr3, token;

    beforeEach(async function () {
        // Déploiement du contrat Rent2Repay
        Rent2Repay = await ethers.getContractFactory("Rent2Repay");
        [owner, addr1, addr2, addr3, _] = await ethers.getSigners();

        // Déployer un mock token ERC20
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        token = await MockERC20.deploy("MockToken", "MTK");

        // Déployer le contrat Rent2Repay
        rent2Repay = await Rent2Repay.deploy(owner.address, owner.address, owner.address, token.address, token.address, token.address, token.address, token.address, token.address);
    });

    it("Devrait effectuer un remboursement batch", async function () {
        await rent2Repay.connect(addr1).configureRent2Repay([token.address], [1000], 604800, 0);
        await rent2Repay.connect(addr2).configureRent2Repay([token.address], [1000], 604800, 0);
        await rent2Repay.connect(addr3).configureRent2Repay([token.address], [1000], 604800, 0);

        await token.mint(addr1.address, 1000);
        await token.mint(addr2.address, 1000);
        await token.mint(addr3.address, 1000);

        await token.connect(addr1).approve(rent2Repay.address, 1000);
        await token.connect(addr2).approve(rent2Repay.address, 1000);
        await token.connect(addr3).approve(rent2Repay.address, 1000);

        await rent2Repay.batchRent2Repay([addr1.address, addr2.address, addr3.address], token.address);

        const balance1 = await token.balanceOf(addr1.address);
        const balance2 = await token.balanceOf(addr2.address);
        const balance3 = await token.balanceOf(addr3.address);

        expect(balance1).to.equal(0);
        expect(balance2).to.equal(0);
        expect(balance3).to.equal(0);
    });
}); 