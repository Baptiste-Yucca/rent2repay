const { ethers, upgrades } = require("hardhat");

async function setupRent2Repay() {
    const [owner, addr1, addr2, addr3, runner, daoTreasury, admin, emergency, operator] = await ethers.getSigners();

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

    // Distribuer les debt tokens aux adresses de test
    const debtAmount = ethers.parseUnits("10000", 18);
    await wxdaiDebtToken.transfer(addr1.address, debtAmount);
    await wxdaiDebtToken.transfer(addr2.address, debtAmount);
    await wxdaiDebtToken.transfer(addr3.address, debtAmount);
    await usdcDebtToken.transfer(addr1.address, debtAmount);
    await usdcDebtToken.transfer(addr2.address, debtAmount);
    await usdcDebtToken.transfer(addr3.address, debtAmount);

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

    // Déployer le contrat Rent2Repay upgradable avec des rôles séparés
    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2Repay = await upgrades.deployProxy(Rent2Repay, [
        admin.address,    // admin - peut unpause, gérer les fees, etc.
        emergency.address,    // emergency - peut pause
        operator.address,    // operator - peut supprimer des utilisateurs
        await mockRMM.getAddress(),  // rmm
        await wxdaiToken.getAddress(),     // wxdaiToken
        await armmWXDAI.getAddress(),      // wxdaiArmmToken
        await usdcToken.getAddress(),      // usdcToken
        await armmUSDC.getAddress()        // usdcArmmToken
    ], {
        initializer: 'initialize'
    });

    // Configurer l'adresse DAO treasury
    await rent2Repay.connect(admin).updateDaoTreasuryAddress(daoTreasury.address);

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
        daoTreasury,
        admin,
        emergency,
        operator
    };
}

module.exports = { setupRent2Repay }; 