const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("AutoRepayUpgradeable", function () {
  let autoRepay;
  let owner;
  let user;
  let bot;
  let mockToken;
  let mockRMM;

  beforeEach(async function () {
    [owner, user, bot] = await ethers.getSigners();

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // Deploy mock RMM
    const MockRMM = await ethers.getContractFactory("MockRMM");
    mockRMM = await MockRMM.deploy();
    await mockRMM.waitForDeployment();

    // Deploy AutoRepay
    const AutoRepayUpgradeable = await ethers.getContractFactory("AutoRepayUpgradeable");
    autoRepay = await upgrades.deployProxy(AutoRepayUpgradeable, [
      owner.address,
      50, // 0.5% bot fee
      20, // 0.2% DAO fee
      owner.address // DAO fee recipient
    ], {
      initializer: 'initialize',
      kind: 'uups'
    });
    await autoRepay.waitForDeployment();
  });

  describe("Authorization", function () {
    it("Should allow user to authorize auto repay", async function () {
      const weeklyLimit = ethers.parseEther("1");
      await autoRepay.connect(user).authorizeAutoRepay(weeklyLimit, await mockToken.getAddress());

      const config = await autoRepay.autoRepaySettings(user.address);
      expect(config.weeklyLimit).to.equal(weeklyLimit);
      expect(config.isActive).to.be.true;
    });

    it("Should allow user to revoke auto repay", async function () {
      const weeklyLimit = ethers.parseEther("1");
      await autoRepay.connect(user).authorizeAutoRepay(weeklyLimit, await mockToken.getAddress());
      await autoRepay.connect(user).revokeAutoRepay();

      const config = await autoRepay.autoRepaySettings(user.address);
      expect(config.isActive).to.be.false;
    });
  });

  describe("Fees", function () {
    it("Should allow fee manager to update fees", async function () {
      await autoRepay.connect(owner).updateFees(100, 50); // 1% bot fee, 0.5% DAO fee
      
      const botFee = await autoRepay.botFeeBps();
      const daoFee = await autoRepay.daoFeeBps();
      
      expect(botFee).to.equal(100);
      expect(daoFee).to.equal(50);
    });

    it("Should not allow non-fee manager to update fees", async function () {
      await expect(
        autoRepay.connect(user).updateFees(100, 50)
      ).to.be.revertedWithCustomError(autoRepay, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Auto Repay Execution", function () {
    beforeEach(async function () {
      // Setup user with auto repay authorization
      const weeklyLimit = ethers.parseEther("10");
      await autoRepay.connect(user).authorizeAutoRepay(weeklyLimit, await mockToken.getAddress());
      
      // Mint tokens to user and approve AutoRepay contract
      await mockToken.mint(user.address, ethers.parseEther("100"));
      await mockToken.connect(user).approve(await autoRepay.getAddress(), ethers.parseEther("100"));
    });

    it("Should execute auto repay successfully", async function () {
      const amount = ethers.parseEther("1");
      const initialUserBalance = await mockToken.balanceOf(user.address);
      const initialBotBalance = await mockToken.balanceOf(bot.address);
      const initialDaoBalance = await mockToken.balanceOf(owner.address);

      await autoRepay.connect(bot).executeAutoRepay(user.address, amount);

      const finalUserBalance = await mockToken.balanceOf(user.address);
      const finalBotBalance = await mockToken.balanceOf(bot.address);
      const finalDaoBalance = await mockToken.balanceOf(owner.address);

      // Check balances
      expect(finalUserBalance).to.equal(initialUserBalance.sub(amount));
      expect(finalBotBalance).to.equal(initialBotBalance.add(amount.mul(50).div(10000))); // 0.5% bot fee
      expect(finalDaoBalance).to.equal(initialDaoBalance.add(amount.mul(20).div(10000))); // 0.2% DAO fee
    });

    it("Should respect weekly limits", async function () {
      const amount = ethers.parseEther("1");
      
      // First repayment should succeed
      await autoRepay.connect(bot).executeAutoRepay(user.address, amount);
      
      // Second repayment should succeed
      await autoRepay.connect(bot).executeAutoRepay(user.address, amount);
      
      // Third repayment should fail (exceeds weekly limit)
      await expect(
        autoRepay.connect(bot).executeAutoRepay(user.address, amount)
      ).to.be.revertedWith("Exceeds weekly limit");
    });

    it("Should not allow non-authorized users to execute auto repay", async function () {
      const amount = ethers.parseEther("1");
      await expect(
        autoRepay.connect(user).executeAutoRepay(user.address, amount)
      ).to.be.revertedWith("User not enrolled");
    });
  });

  describe("Pause/Unpause", function () {
    it("Should not allow auto repay when paused", async function () {
      const weeklyLimit = ethers.parseEther("1");
      await autoRepay.connect(user).authorizeAutoRepay(weeklyLimit, await mockToken.getAddress());
      await autoRepay.connect(owner).pause();

      await expect(
        autoRepay.connect(bot).executeAutoRepay(user.address, ethers.parseEther("0.5"))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow auto repay after unpause", async function () {
      const weeklyLimit = ethers.parseEther("1");
      await autoRepay.connect(user).authorizeAutoRepay(weeklyLimit, await mockToken.getAddress());
      await autoRepay.connect(owner).pause();
      await autoRepay.connect(owner).unpause();

      await mockToken.mint(user.address, ethers.parseEther("1"));
      await mockToken.connect(user).approve(await autoRepay.getAddress(), ethers.parseEther("1"));
      
      await expect(
        autoRepay.connect(bot).executeAutoRepay(user.address, ethers.parseEther("0.5"))
      ).to.not.be.reverted;
    });
  });

  describe("Upgrade", function () {
    it("Should allow upgrade by UPGRADER_ROLE", async function () {
      const AutoRepayUpgradeableV2 = await ethers.getContractFactory("AutoRepayUpgradeable");
      await expect(
        upgrades.upgradeProxy(await autoRepay.getAddress(), AutoRepayUpgradeableV2)
      ).to.not.be.reverted;
    });

    it("Should not allow upgrade by non-UPGRADER_ROLE", async function () {
      const AutoRepayUpgradeableV2 = await ethers.getContractFactory("AutoRepayUpgradeable");
      await expect(
        upgrades.upgradeProxy(await autoRepay.getAddress(), AutoRepayUpgradeableV2.connect(user))
      ).to.be.reverted;
    });
  });
}); 