const { ethers } = require("hardhat");

async function setupRent2Repay() {
    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("MockToken", "MTK");

    const rent2Repay = await Rent2Repay.deploy(owner.address, owner.address, owner.address, token.address, token.address, token.address, token.address, token.address, token.address);

    return { rent2Repay, token, owner, addr1, addr2, addr3 };
}

module.exports = { setupRent2Repay }; 