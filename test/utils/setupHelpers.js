const { ethers } = require("hardhat");

async function setupRent2Repay() {
    const [owner, addr1, addr2, addr3, runner, daoTreasury] = await ethers.getSigners();

    // Déployer les tokens de base (WXDAI et USDC)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const wxdaiToken = await MockERC20.deploy("Wrapped xDAI", "WXDAI");
    const usdcToken = await MockERC20.deploy("USD Coin", "USDC");

    // Déployer les supply tokens (armmWXDAI et armmUSDC)
    const armmWXDAI = await MockERC20.deploy("Armm WXDAI", "armmWXDAI");
    const armmUSDC = await MockERC20.deploy("Armm USDC", "armmUSDC");

    // Déployer les debt tokens
    const MockDebtToken = await ethers.getContractFactory("MockDebtToken");
    const wxdaiDebtToken = await MockDebtToken.deploy("Debt WXDAI", "dWXDAI", await wxdaiToken.getAddress());
    const usdcDebtToken = await MockDebtToken.deploy("Debt USDC", "dUSDC", await usdcToken.getAddress());

    // Déployer le MockRMM
    const MockRMM = await ethers.getContractFactory("MockRMM");
    const mockRMM = await MockRMM.deploy(
        [await wxdaiToken.getAddress(), await usdcToken.getAddress()],
        [await wxdaiDebtToken.getAddress(), await usdcDebtToken.getAddress()],
        [await armmWXDAI.getAddress(), await armmUSDC.getAddress()]
    );

    // Mint some underlying tokens to the MockRMM for withdrawals
    await wxdaiToken.mint(await mockRMM.getAddress(), ethers.parseUnits("1000000", 18));
    await usdcToken.mint(await mockRMM.getAddress(), ethers.parseUnits("1000000", 6));

    // Déployer le contrat Rent2Repay
    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2Repay = await Rent2Repay.deploy(
        owner.address,    // admin
        owner.address,    // emergency
        owner.address,    // operator
        await mockRMM.getAddress(),  // rmm
        await wxdaiToken.getAddress(),     // wxdaiToken
        await wxdaiDebtToken.getAddress(), // wxdaiDebtToken
        await armmWXDAI.getAddress(),      // wxdaiArmmToken
        await usdcToken.getAddress(),      // usdcToken
        await usdcDebtToken.getAddress(),  // usdcDebtToken
        await armmUSDC.getAddress()        // usdcArmmToken
    );

    // Configurer l'adresse DAO treasury
    await rent2Repay.updateDaoTreasuryAddress(daoTreasury.address);

    return {
        rent2Repay,
        mockRMM,
        wxdaiToken,
        usdcToken,
        armmWXDAI,
        armmUSDC,
        wxdaiDebtToken,
        usdcDebtToken,
        owner,
        addr1,
        addr2,
        addr3,
        runner,
        daoTreasury
    };
}

module.exports = { setupRent2Repay }; 