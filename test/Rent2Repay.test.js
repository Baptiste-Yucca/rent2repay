const { expect } = require("chai");
const { ethers } = require("hardhat");

// Début du test principal pour Rent2Repay

describe("Rent2Repay", function () {
    let Rent2Repay, rent2Repay, owner, addr1, addr2, token;

    beforeEach(async function () {
        // Déploiement du contrat Rent2Repay
        Rent2Repay = await ethers.getContractFactory("Rent2Repay");
        [owner, addr1, addr2, _] = await ethers.getSigners();

        // Déployer un mock token ERC20
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        token = await MockERC20.deploy("MockToken", "MTK");

        // Déployer le contrat Rent2Repay
        rent2Repay = await Rent2Repay.deploy(owner.address, owner.address, owner.address, token.address, token.address, token.address, token.address, token.address, token.address);
    });

    it("Devrait configurer Rent2Repay correctement", async function () {
        await rent2Repay.connect(addr1).configureRent2Repay([token.address], [1000], 604800, 0);
        const config = await rent2Repay.getUserConfigForToken(addr1.address, token.address);
        expect(config[0]).to.equal(1000);
    });

    it("Devrait effectuer un remboursement", async function () {
        await rent2Repay.connect(addr1).configureRent2Repay([token.address], [1000], 604800, 0);
        await token.mint(addr1.address, 1000);
        await token.connect(addr1).approve(rent2Repay.address, 1000);
        await rent2Repay.connect(addr1).rent2repay(addr1.address, token.address);
        const balance = await token.balanceOf(addr1.address);
        expect(balance).to.equal(0);
    });
}); 