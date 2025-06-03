const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Token Management Behavior", function () {
    let rent2Repay, mockRMM, wxdaiToken, usdcToken, daiToken;
    let admin, emergency, operator, user, anyone;

    beforeEach(async function () {
        [admin, emergency, operator, user, anyone] = await ethers.getSigners();

        // Deploy test tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        wxdaiToken = await MockERC20.deploy("Wrapped XDAI", "WXDAI");
        usdcToken = await MockERC20.deploy("USD Coin", "USDC");
        daiToken = await MockERC20.deploy("DAI Stablecoin", "DAI");

        await wxdaiToken.waitForDeployment();
        await usdcToken.waitForDeployment();
        await daiToken.waitForDeployment();

        // Deploy MockRMM
        const MockRMM = await ethers.getContractFactory("MockRMM");
        mockRMM = await MockRMM.deploy();
        await mockRMM.waitForDeployment();

        // Deploy Rent2Repay
        const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
        rent2Repay = await Rent2Repay.deploy(
            admin.address,
            emergency.address,
            operator.address,
            await mockRMM.getAddress(),
            await wxdaiToken.getAddress(),
            await usdcToken.getAddress()
        );
        await rent2Repay.waitForDeployment();

        // Mint tokens for testing
        const mintAmount = ethers.parseEther("10000");
        await wxdaiToken.mint(user.address, mintAmount);
        await wxdaiToken.mint(anyone.address, mintAmount);
        await daiToken.mint(user.address, mintAmount);
        await daiToken.mint(anyone.address, mintAmount);
    });

    describe("Token Authorization Management", function () {
        it("Should allow admin to add new token", async function () {
            // Initially 2 tokens (WXDAI, USDC)
            let authorizedTokens = await rent2Repay.getAuthorizedTokens();
            expect(authorizedTokens.length).to.equal(2);

            // Admin adds DAI
            await expect(rent2Repay.connect(admin).authorizeToken(await daiToken.getAddress()))
                .to.emit(rent2Repay, "TokenAuthorized")
                .withArgs(await daiToken.getAddress());

            // Now 3 tokens
            authorizedTokens = await rent2Repay.getAuthorizedTokens();
            expect(authorizedTokens.length).to.equal(3);
            expect(await rent2Repay.authorizedTokens(await daiToken.getAddress())).to.be.true;
        });

        it("Should not allow non-admin to add token", async function () {
            await expect(rent2Repay.connect(user).authorizeToken(await daiToken.getAddress()))
                .to.be.revertedWithCustomError(rent2Repay, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Token Removal Behavior", function () {
        beforeEach(async function () {
            // Add DAI and configure user with it
            await rent2Repay.connect(admin).authorizeToken(await daiToken.getAddress());

            // User configures both WXDAI and DAI
            await rent2Repay.connect(user).configureRent2Repay(
                [await wxdaiToken.getAddress(), await daiToken.getAddress()],
                [ethers.parseEther("100"), ethers.parseEther("200")]
            );
        });

        it("Should preserve existing user configurations when token is unauthorized", async function () {
            // Verify user has both tokens configured
            expect(await rent2Repay.isAuthorizedForToken(user.address, await wxdaiToken.getAddress())).to.be.true;
            expect(await rent2Repay.isAuthorizedForToken(user.address, await daiToken.getAddress())).to.be.true;

            // Admin removes DAI from authorized tokens
            await expect(rent2Repay.connect(admin).unauthorizeToken(await daiToken.getAddress()))
                .to.emit(rent2Repay, "TokenUnauthorized")
                .withArgs(await daiToken.getAddress());

            // User's DAI configuration is still there (data preserved)
            const daiConfig = await rent2Repay.getUserConfigForToken(user.address, await daiToken.getAddress());
            expect(daiConfig[0]).to.equal(ethers.parseEther("200")); // weeklyMaxAmount still there

            // But DAI is no longer in authorized tokens
            expect(await rent2Repay.authorizedTokens(await daiToken.getAddress())).to.be.false;

            // And not in the token list
            const authorizedTokens = await rent2Repay.getAuthorizedTokens();
            expect(authorizedTokens).to.not.include(await daiToken.getAddress());
        });

        it("Should prevent new configurations with unauthorized token", async function () {
            // Remove DAI
            await rent2Repay.connect(admin).unauthorizeToken(await daiToken.getAddress());

            // Try to configure DAI - should fail
            await expect(rent2Repay.connect(anyone).configureRent2Repay(
                [await daiToken.getAddress()],
                [ethers.parseEther("50")]
            )).to.be.revertedWithCustomError(rent2Repay, "TokenNotAuthorized");
        });

        it("Should prevent repayments with unauthorized token", async function () {
            // Setup for repayment test
            await daiToken.mint(anyone.address, ethers.parseEther("100"));
            await daiToken.connect(anyone).approve(await rent2Repay.getAddress(), ethers.parseEther("50"));
            await mockRMM.setDebt(user.address, await daiToken.getAddress(), ethers.parseEther("1000"));

            // Remove DAI after user configuration
            await rent2Repay.connect(admin).unauthorizeToken(await daiToken.getAddress());

            // Try to repay with DAI - should fail
            await expect(rent2Repay.connect(anyone).rent2repay(
                user.address,
                await daiToken.getAddress(),
                ethers.parseEther("50")
            )).to.be.revertedWithCustomError(rent2Repay, "TokenNotAuthorized");
        });

        it("Should still allow user to revoke unauthorized token configuration", async function () {
            // Remove DAI
            await rent2Repay.connect(admin).unauthorizeToken(await daiToken.getAddress());

            // User can still revoke their DAI configuration
            await expect(rent2Repay.connect(user).revokeRent2RepayForToken(await daiToken.getAddress()))
                .to.emit(rent2Repay, "Rent2RepayRevoked")
                .withArgs(user.address, await daiToken.getAddress());

            // Configuration should be cleared
            const daiConfig = await rent2Repay.getUserConfigForToken(user.address, await daiToken.getAddress());
            expect(daiConfig[0]).to.equal(0); // weeklyMaxAmount now 0
        });

        it("Should handle getUserConfigs correctly with unauthorized tokens", async function () {
            // Before removal - user has 2 tokens configured
            let userConfigs = await rent2Repay.getUserConfigs(user.address);
            expect(userConfigs[0].length).to.equal(2); // 2 tokens

            // Remove DAI
            await rent2Repay.connect(admin).unauthorizeToken(await daiToken.getAddress());

            // getUserConfigs should still return DAI if user has it configured
            // (because the function checks weeklyMaxAmounts, not authorizedTokens)
            userConfigs = await rent2Repay.getUserConfigs(user.address);
            expect(userConfigs[0].length).to.equal(2); // Still 2 tokens in user's config
        });
    });

    describe("Re-authorization of tokens", function () {
        it("Should allow re-authorization of previously unauthorized token", async function () {
            // Add DAI
            await rent2Repay.connect(admin).authorizeToken(await daiToken.getAddress());

            // Remove DAI
            await rent2Repay.connect(admin).unauthorizeToken(await daiToken.getAddress());

            // Re-add DAI
            await expect(rent2Repay.connect(admin).authorizeToken(await daiToken.getAddress()))
                .to.emit(rent2Repay, "TokenAuthorized")
                .withArgs(await daiToken.getAddress());

            expect(await rent2Repay.authorizedTokens(await daiToken.getAddress())).to.be.true;
        });
    });

    describe("Admin Cleanup Functions", function () {
        beforeEach(async function () {
            // Add DAI and configure users with it
            await rent2Repay.connect(admin).authorizeToken(await daiToken.getAddress());

            // Multiple users configure DAI
            await rent2Repay.connect(user).configureRent2Repay(
                [await daiToken.getAddress()],
                [ethers.parseEther("100")]
            );
            await rent2Repay.connect(anyone).configureRent2Repay(
                [await daiToken.getAddress()],
                [ethers.parseEther("50")]
            );

            // Then remove DAI
            await rent2Repay.connect(admin).unauthorizeToken(await daiToken.getAddress());
        });

        it("Should allow admin to cleanup user configurations for unauthorized token", async function () {
            // Verify both users have DAI configured before cleanup
            let userConfig = await rent2Repay.getUserConfigForToken(user.address, await daiToken.getAddress());
            let anyoneConfig = await rent2Repay.getUserConfigForToken(anyone.address, await daiToken.getAddress());

            expect(userConfig[0]).to.equal(ethers.parseEther("100"));
            expect(anyoneConfig[0]).to.equal(ethers.parseEther("50"));

            // Admin cleans up configurations
            await expect(rent2Repay.connect(admin).cleanupUnauthorizedTokenConfigs(
                await daiToken.getAddress(),
                [user.address, anyone.address]
            ))
                .to.emit(rent2Repay, "Rent2RepayRevoked")
                .withArgs(user.address, await daiToken.getAddress())
                .and.to.emit(rent2Repay, "Rent2RepayRevoked")
                .withArgs(anyone.address, await daiToken.getAddress());

            // Verify configurations are cleared
            userConfig = await rent2Repay.getUserConfigForToken(user.address, await daiToken.getAddress());
            anyoneConfig = await rent2Repay.getUserConfigForToken(anyone.address, await daiToken.getAddress());

            expect(userConfig[0]).to.equal(0);
            expect(anyoneConfig[0]).to.equal(0);
        });

        it("Should not allow cleanup of authorized tokens", async function () {
            // Try to cleanup WXDAI (which is still authorized)
            await expect(rent2Repay.connect(admin).cleanupUnauthorizedTokenConfigs(
                await wxdaiToken.getAddress(),
                [user.address]
            )).to.be.revertedWithCustomError(rent2Repay, "TokenStillAuthorized");
        });

        it("Should not allow non-admin to cleanup", async function () {
            await expect(rent2Repay.connect(user).cleanupUnauthorizedTokenConfigs(
                await daiToken.getAddress(),
                [user.address]
            )).to.be.revertedWithCustomError(rent2Repay, "AccessControlUnauthorizedAccount");
        });

        it("Should handle empty user array gracefully", async function () {
            // Should not revert with empty array
            await rent2Repay.connect(admin).cleanupUnauthorizedTokenConfigs(
                await daiToken.getAddress(),
                []
            );
        });

        it("Should skip users with no configuration", async function () {
            // Create a user with no DAI configuration
            const [, , , , userWithoutConfig] = await ethers.getSigners();

            // Should not revert when including user without config
            await rent2Repay.connect(admin).cleanupUnauthorizedTokenConfigs(
                await daiToken.getAddress(),
                [user.address, userWithoutConfig.address]
            );

            // Only user should have emitted event, not userWithoutConfig
            const userConfig = await rent2Repay.getUserConfigForToken(user.address, await daiToken.getAddress());
            expect(userConfig[0]).to.equal(0);
        });
    });
}); 