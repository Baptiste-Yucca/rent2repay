const { ethers, upgrades } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Deploy Mock tokens first
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockWXDAI = await MockERC20.deploy("WXDAI", "WXDAI");
    const mockWXDAIDebt = await MockERC20.deploy("debtWXDAI", "dWXDAI");
    const mockWXDAIArmm = await MockERC20.deploy("aWXDAI", "aWXDAI");
    const mockUSDC = await MockERC20.deploy("USDC", "USDC");
    const mockUSDCDebt = await MockERC20.deploy("debtUSDC", "dUSDC");
    const mockUSDCArmm = await MockERC20.deploy("aUSDC", "aUSDC");

    console.log("Mock tokens deployed:");
    console.log("WXDAI:", await mockWXDAI.getAddress());
    console.log("WXDAI Debt:", await mockWXDAIDebt.getAddress());
    console.log("WXDAI Armm:", await mockWXDAIArmm.getAddress());
    console.log("USDC:", await mockUSDC.getAddress());
    console.log("USDC Debt:", await mockUSDCDebt.getAddress());
    console.log("USDC Armm:", await mockUSDCArmm.getAddress());

    // Deploy Mock RMM
    const MockRMM = await ethers.getContractFactory("MockRMM");
    const mockRMM = await MockRMM.deploy(
        [await mockWXDAI.getAddress(), await mockUSDC.getAddress()],
        [await mockWXDAIDebt.getAddress(), await mockUSDCDebt.getAddress()],
        [await mockWXDAIArmm.getAddress(), await mockUSDCArmm.getAddress()]
    );
    console.log("Mock RMM deployed:", await mockRMM.getAddress());

    // Get accounts for roles
    const accounts = await ethers.getSigners();
    const admin = accounts[0];
    const emergency = accounts[1];
    const operator = accounts[2];

    // Deploy the upgradeable Rent2Repay contract
    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2repay = await upgrades.deployProxy(Rent2Repay, [
        admin.address,
        emergency.address,
        operator.address,
        await mockRMM.getAddress(),
        await mockWXDAI.getAddress(),
        await mockWXDAIDebt.getAddress(),
        await mockWXDAIArmm.getAddress(),
        await mockUSDC.getAddress(),
        await mockUSDCDebt.getAddress(),
        await mockUSDCArmm.getAddress()
    ], {
        initializer: 'initialize'
    });

    console.log("Rent2Repay proxy deployed:", await rent2repay.getAddress());

    // Update config file
    const config = {
        CONTRACTS: {
            RENT2REPAY: await rent2repay.getAddress(),
            RMM: await mockRMM.getAddress(),
            WXDAI: await mockWXDAI.getAddress(),
            WXDAI_DEBT: await mockWXDAIDebt.getAddress(),
            WXDAI_ARMM: await mockWXDAIArmm.getAddress(),
            USDC: await mockUSDC.getAddress(),
            USDC_DEBT: await mockUSDCDebt.getAddress(),
            USDC_ARMM: await mockUSDCArmm.getAddress()
        }
    };

    const fs = require('fs');
    fs.writeFileSync('config.js', `module.exports = ${JSON.stringify(config, null, 2)};`);

    console.log("✅ Deployment complete!");
    console.log("✅ Config file updated!");
    console.log("✅ Rent2Repay Version:", await rent2repay.version());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 