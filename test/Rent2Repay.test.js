const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Rent2Repay Multi-Token", function () {
    let rent2Repay, mockRMM, wxdaiToken, usdcToken;
    let admin, emergency, operator, user, otherUser, anyone;

    // Constantes
    const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
    const WEEKLY_AMOUNT_WXDAI = ethers.parseEther("100"); // 100 WXDAI
    const WEEKLY_AMOUNT_USDC = ethers.parseUnits("150", 6); // 150 USDC (6 decimals)

    beforeEach(async function () {
        [admin, emergency, operator, user, otherUser, anyone] = await ethers.getSigners();

        // Déployer les tokens de test
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        wxdaiToken = await MockERC20.deploy("Wrapped XDAI", "WXDAI");
        await wxdaiToken.waitForDeployment();

        usdcToken = await MockERC20.deploy("USD Coin", "USDC");
        await usdcToken.waitForDeployment();

        // Déployer le MockRMM
        const MockRMM = await ethers.getContractFactory("MockRMM");
        mockRMM = await MockRMM.deploy();
        await mockRMM.waitForDeployment();

        // Déployer Rent2Repay avec WXDAI et USDC comme tokens autorisés
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

        // Mint des tokens pour les tests
        const mintAmount = ethers.parseEther("10000");
        await wxdaiToken.mint(user.address, mintAmount);
        await wxdaiToken.mint(otherUser.address, mintAmount);
        await wxdaiToken.mint(anyone.address, mintAmount);

        const usdcMintAmount = ethers.parseUnits("10000", 6);
        await usdcToken.mint(user.address, usdcMintAmount);
        await usdcToken.mint(otherUser.address, usdcMintAmount);
        await usdcToken.mint(anyone.address, usdcMintAmount);

        // Configurer des dettes dans le MockRMM pour les tests
        const debtAmount = ethers.parseEther("5000");
        await mockRMM.setDebt(user.address, await wxdaiToken.getAddress(), debtAmount);
        await mockRMM.setDebt(otherUser.address, await wxdaiToken.getAddress(), debtAmount);

        const usdcDebtAmount = ethers.parseUnits("5000", 6);
        await mockRMM.setDebt(user.address, await usdcToken.getAddress(), usdcDebtAmount);
        await mockRMM.setDebt(otherUser.address, await usdcToken.getAddress(), usdcDebtAmount);
    });

    describe("Deployment & Roles", function () {
        it("Should set correct roles on deployment", async function () {
            const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
            const ADMIN_ROLE = await rent2Repay.ADMIN_ROLE();
            const EMERGENCY_ROLE = await rent2Repay.EMERGENCY_ROLE();
            const OPERATOR_ROLE = await rent2Repay.OPERATOR_ROLE();

            expect(await rent2Repay.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
            expect(await rent2Repay.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
            expect(await rent2Repay.hasRole(EMERGENCY_ROLE, emergency.address)).to.be.true;
            expect(await rent2Repay.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
        });

        it("Should not be paused on deployment", async function () {
            expect(await rent2Repay.paused()).to.be.false;
        });

        it("Should have WXDAI and USDC as authorized tokens", async function () {
            expect(await rent2Repay.authorizedTokens(await wxdaiToken.getAddress())).to.be.true;
            expect(await rent2Repay.authorizedTokens(await usdcToken.getAddress())).to.be.true;

            const authorizedTokens = await rent2Repay.getAuthorizedTokens();
            expect(authorizedTokens.length).to.equal(2);
            expect(authorizedTokens).to.include(await wxdaiToken.getAddress());
            expect(authorizedTokens).to.include(await usdcToken.getAddress());
        });
    });

    describe("Token Management", function () {
        it("Should allow admin to authorize new token", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const newToken = await MockERC20.deploy("New Token", "NEW");
            await newToken.waitForDeployment();

            await expect(rent2Repay.connect(admin).authorizeToken(await newToken.getAddress()))
                .to.emit(rent2Repay, "TokenAuthorized")
                .withArgs(await newToken.getAddress());

            expect(await rent2Repay.authorizedTokens(await newToken.getAddress())).to.be.true;
        });

        it("Should not allow non-admin to authorize token", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const newToken = await MockERC20.deploy("New Token", "NEW");
            await newToken.waitForDeployment();

            await expect(rent2Repay.connect(user).authorizeToken(await newToken.getAddress()))
                .to.be.revertedWithCustomError(rent2Repay, "AccessControlUnauthorizedAccount");
        });

        it("Should allow admin to unauthorize token", async function () {
            await expect(rent2Repay.connect(admin).unauthorizeToken(await wxdaiToken.getAddress()))
                .to.emit(rent2Repay, "TokenUnauthorized")
                .withArgs(await wxdaiToken.getAddress());

            expect(await rent2Repay.authorizedTokens(await wxdaiToken.getAddress())).to.be.false;
        });
    });

    describe("User Configuration - Single Token", function () {
        it("Should allow user to configure Rent2Repay for WXDAI", async function () {
            await expect(rent2Repay.connect(user).configureRent2Repay(
                await wxdaiToken.getAddress(),
                WEEKLY_AMOUNT_WXDAI
            ))
                .to.emit(rent2Repay, "Rent2RepayConfigured")
                .withArgs(user.address, await wxdaiToken.getAddress(), WEEKLY_AMOUNT_WXDAI);

            expect(await rent2Repay.isAuthorized(user.address)).to.be.true;
            expect(await rent2Repay.isAuthorizedForToken(user.address, await wxdaiToken.getAddress())).to.be.true;

            const config = await rent2Repay.getUserConfigForToken(user.address, await wxdaiToken.getAddress());
            expect(config[0]).to.equal(WEEKLY_AMOUNT_WXDAI); // weeklyMaxAmount
            expect(config[1]).to.equal(0); // currentSpent
        });

        it("Should allow user to configure Rent2Repay for USDC", async function () {
            await expect(rent2Repay.connect(user).configureRent2Repay(
                await usdcToken.getAddress(),
                WEEKLY_AMOUNT_USDC
            ))
                .to.emit(rent2Repay, "Rent2RepayConfigured")
                .withArgs(user.address, await usdcToken.getAddress(), WEEKLY_AMOUNT_USDC);

            expect(await rent2Repay.isAuthorizedForToken(user.address, await usdcToken.getAddress())).to.be.true;
        });

        it("Should not allow configuration with unauthorized token", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const unauthorizedToken = await MockERC20.deploy("Unauthorized", "UNAUTH");
            await unauthorizedToken.waitForDeployment();

            await expect(rent2Repay.connect(user).configureRent2Repay(
                await unauthorizedToken.getAddress(),
                WEEKLY_AMOUNT_WXDAI
            )).to.be.revertedWithCustomError(rent2Repay, "TokenNotAuthorized");
        });

        it("Should not allow configuration with zero amount", async function () {
            await expect(rent2Repay.connect(user).configureRent2Repay(
                await wxdaiToken.getAddress(),
                0
            )).to.be.revertedWithCustomError(rent2Repay, "AmountMustBeGreaterThanZero");
        });

        it("Should not allow configuration when paused", async function () {
            await rent2Repay.connect(emergency).pause();

            await expect(rent2Repay.connect(user).configureRent2Repay(
                await wxdaiToken.getAddress(),
                WEEKLY_AMOUNT_WXDAI
            )).to.be.revertedWithCustomError(rent2Repay, "EnforcedPause");
        });
    });

    describe("User Configuration - Multiple Tokens", function () {
        it("Should allow user to configure multiple tokens at once", async function () {
            const tokens = [await wxdaiToken.getAddress(), await usdcToken.getAddress()];
            const amounts = [WEEKLY_AMOUNT_WXDAI, WEEKLY_AMOUNT_USDC];

            await rent2Repay.connect(user).configureRent2RepayMultiple(tokens, amounts);

            expect(await rent2Repay.isAuthorizedForToken(user.address, await wxdaiToken.getAddress())).to.be.true;
            expect(await rent2Repay.isAuthorizedForToken(user.address, await usdcToken.getAddress())).to.be.true;

            const wxdaiConfig = await rent2Repay.getUserConfigForToken(user.address, await wxdaiToken.getAddress());
            const usdcConfig = await rent2Repay.getUserConfigForToken(user.address, await usdcToken.getAddress());

            expect(wxdaiConfig[0]).to.equal(WEEKLY_AMOUNT_WXDAI);
            expect(usdcConfig[0]).to.equal(WEEKLY_AMOUNT_USDC);
        });

        it("Should get all user configurations", async function () {
            const tokens = [await wxdaiToken.getAddress(), await usdcToken.getAddress()];
            const amounts = [WEEKLY_AMOUNT_WXDAI, WEEKLY_AMOUNT_USDC];

            await rent2Repay.connect(user).configureRent2RepayMultiple(tokens, amounts);

            const userConfigs = await rent2Repay.getUserConfigs(user.address);
            expect(userConfigs[0].length).to.equal(2); // tokens array
            expect(userConfigs[1].length).to.equal(2); // maxAmounts array  
            expect(userConfigs[2].length).to.equal(2); // spentAmounts array
        });
    });

    describe("User Revocation", function () {
        beforeEach(async function () {
            await rent2Repay.connect(user).configureRent2Repay(await wxdaiToken.getAddress(), WEEKLY_AMOUNT_WXDAI);
            await rent2Repay.connect(user).configureRent2Repay(await usdcToken.getAddress(), WEEKLY_AMOUNT_USDC);
        });

        it("Should allow user to revoke authorization for specific token", async function () {
            await expect(rent2Repay.connect(user).revokeRent2RepayForToken(await wxdaiToken.getAddress()))
                .to.emit(rent2Repay, "Rent2RepayRevoked")
                .withArgs(user.address, await wxdaiToken.getAddress());

            expect(await rent2Repay.isAuthorizedForToken(user.address, await wxdaiToken.getAddress())).to.be.false;
            expect(await rent2Repay.isAuthorizedForToken(user.address, await usdcToken.getAddress())).to.be.true; // Still authorized for USDC
            expect(await rent2Repay.isAuthorized(user.address)).to.be.true; // Still authorized overall
        });

        it("Should allow user to revoke all authorizations", async function () {
            await expect(rent2Repay.connect(user).revokeRent2RepayAll())
                .to.emit(rent2Repay, "Rent2RepayRevokedAll")
                .withArgs(user.address);

            expect(await rent2Repay.isAuthorized(user.address)).to.be.false;
            expect(await rent2Repay.isAuthorizedForToken(user.address, await wxdaiToken.getAddress())).to.be.false;
            expect(await rent2Repay.isAuthorizedForToken(user.address, await usdcToken.getAddress())).to.be.false;
        });

        it("Should not allow non-authorized user to revoke", async function () {
            await expect(rent2Repay.connect(otherUser).revokeRent2RepayForToken(await wxdaiToken.getAddress()))
                .to.be.revertedWithCustomError(rent2Repay, "UserNotAuthorizedForToken");
        });
    });

    describe("Operator Functions", function () {
        beforeEach(async function () {
            await rent2Repay.connect(user).configureRent2Repay(await wxdaiToken.getAddress(), WEEKLY_AMOUNT_WXDAI);
            await rent2Repay.connect(user).configureRent2Repay(await usdcToken.getAddress(), WEEKLY_AMOUNT_USDC);
        });

        it("Should allow operator to remove user (all tokens)", async function () {
            await expect(rent2Repay.connect(operator).removeUser(user.address))
                .to.emit(rent2Repay, "UserRemovedByOperator")
                .withArgs(operator.address, user.address);

            expect(await rent2Repay.isAuthorized(user.address)).to.be.false;
            expect(await rent2Repay.isAuthorizedForToken(user.address, await wxdaiToken.getAddress())).to.be.false;
            expect(await rent2Repay.isAuthorizedForToken(user.address, await usdcToken.getAddress())).to.be.false;
        });

        it("Should not allow non-operator to remove user", async function () {
            await expect(rent2Repay.connect(anyone).removeUser(user.address))
                .to.be.revertedWithCustomError(rent2Repay, "AccessControlUnauthorizedAccount");
        });

        it("Should not allow operator to remove non-authorized user", async function () {
            await expect(rent2Repay.connect(operator).removeUser(otherUser.address))
                .to.be.revertedWithCustomError(rent2Repay, "UserNotAuthorized");
        });
    });

    describe("Emergency Functions", function () {
        it("Should allow emergency role to pause contract", async function () {
            await expect(rent2Repay.connect(emergency).pause())
                .to.emit(rent2Repay, "Paused")
                .withArgs(emergency.address);

            expect(await rent2Repay.paused()).to.be.true;
        });

        it("Should allow emergency role to unpause contract", async function () {
            await rent2Repay.connect(emergency).pause();

            await expect(rent2Repay.connect(emergency).unpause())
                .to.emit(rent2Repay, "Unpaused")
                .withArgs(emergency.address);

            expect(await rent2Repay.paused()).to.be.false;
        });

        it("Should not allow non-emergency role to pause", async function () {
            await expect(rent2Repay.connect(anyone).pause())
                .to.be.revertedWithCustomError(rent2Repay, "AccessControlUnauthorizedAccount");
        });

        it("Should not allow non-emergency role to unpause", async function () {
            await rent2Repay.connect(emergency).pause();

            await expect(rent2Repay.connect(anyone).unpause())
                .to.be.revertedWithCustomError(rent2Repay, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Repayment Validation - WXDAI", function () {
        beforeEach(async function () {
            await rent2Repay.connect(user).configureRent2Repay(await wxdaiToken.getAddress(), WEEKLY_AMOUNT_WXDAI);
        });

        it("Should allow anyone to validate WXDAI repayment within limits", async function () {
            const repayAmount = ethers.parseEther("50");

            // Approuver le contrat pour dépenser les tokens
            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);

            await expect(rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                repayAmount
            ))
                .to.emit(rent2Repay, "RepaymentExecuted")
                .withArgs(
                    user.address,
                    await wxdaiToken.getAddress(),
                    repayAmount,
                    ethers.parseEther("50"), // remaining
                    anyone.address
                );

            const config = await rent2Repay.getUserConfigForToken(user.address, await wxdaiToken.getAddress());
            expect(config[1]).to.equal(repayAmount); // currentSpent
        });

        it("Should track separate limits for different tokens", async function () {
            // Configure both tokens
            await rent2Repay.connect(user).configureRent2Repay(await usdcToken.getAddress(), WEEKLY_AMOUNT_USDC);

            const wxdaiRepayAmount = ethers.parseEther("50");
            const usdcRepayAmount = ethers.parseUnits("75", 6);

            // Approve and repay WXDAI
            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), wxdaiRepayAmount);
            await rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                wxdaiRepayAmount
            );

            // Approve and repay USDC
            await usdcToken.connect(anyone).approve(await rent2Repay.getAddress(), usdcRepayAmount);
            await rent2Repay.connect(anyone).rent2repay(
                user.address,
                await usdcToken.getAddress(),
                usdcRepayAmount
            );

            // Check separate tracking
            const wxdaiConfig = await rent2Repay.getUserConfigForToken(user.address, await wxdaiToken.getAddress());
            const usdcConfig = await rent2Repay.getUserConfigForToken(user.address, await usdcToken.getAddress());

            expect(wxdaiConfig[1]).to.equal(wxdaiRepayAmount); // WXDAI spent
            expect(usdcConfig[1]).to.equal(usdcRepayAmount); // USDC spent

            // Check available amounts
            expect(await rent2Repay.getAvailableAmountThisWeek(user.address, await wxdaiToken.getAddress()))
                .to.equal(ethers.parseEther("50")); // 100 - 50 = 50 WXDAI remaining
            expect(await rent2Repay.getAvailableAmountThisWeek(user.address, await usdcToken.getAddress()))
                .to.equal(ethers.parseUnits("75", 6)); // 150 - 75 = 75 USDC remaining
        });

        it("Should reject repayment when exceeding token-specific limit", async function () {
            const repayAmount = ethers.parseEther("150"); // More than 100 WXDAI limit

            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);

            await expect(rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                repayAmount
            )).to.be.revertedWithCustomError(rent2Repay, "WeeklyLimitExceeded");
        });

        it("Should reject repayment with unauthorized token", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const unauthorizedToken = await MockERC20.deploy("Unauthorized", "UNAUTH");
            await unauthorizedToken.waitForDeployment();

            const repayAmount = ethers.parseEther("50");

            await expect(rent2Repay.connect(anyone).rent2repay(
                user.address,
                await unauthorizedToken.getAddress(),
                repayAmount
            )).to.be.revertedWithCustomError(rent2Repay, "TokenNotAuthorized");
        });

        it("Should reject repayment when user not authorized for specific token", async function () {
            const repayAmount = ethers.parseUnits("50", 6);

            await usdcToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);

            await expect(rent2Repay.connect(anyone).rent2repay(
                user.address,
                await usdcToken.getAddress(),
                repayAmount
            )).to.be.revertedWithCustomError(rent2Repay, "UserNotAuthorizedForToken");
        });

        it("Should reject repayment when paused", async function () {
            await rent2Repay.connect(emergency).pause();

            await expect(rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                ethers.parseEther("50")
            )).to.be.revertedWithCustomError(rent2Repay, "EnforcedPause");
        });

        it("Should reject repayment with zero amount", async function () {
            await expect(rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                0
            )).to.be.revertedWithCustomError(rent2Repay, "AmountMustBeGreaterThanZero");
        });

        it("Should reject when user tries to repay for themselves", async function () {
            const repayAmount = ethers.parseEther("50");

            await expect(rent2Repay.connect(user).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                repayAmount
            )).to.be.revertedWithCustomError(rent2Repay, "CannotRepayForSelf");
        });

        it("Should allow multiple repayments within the same week", async function () {
            const repayAmount1 = ethers.parseEther("30");
            const repayAmount2 = ethers.parseEther("40");

            // First repayment
            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount1);
            await rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                repayAmount1
            );

            // Second repayment
            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount2);
            await rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                repayAmount2
            );

            const config = await rent2Repay.getUserConfigForToken(user.address, await wxdaiToken.getAddress());
            expect(config[1]).to.equal(ethers.parseEther("70")); // Total spent: 30 + 40 = 70
        });

        it("Should reject when cumulative amount exceeds limit", async function () {
            const repayAmount1 = ethers.parseEther("60");
            const repayAmount2 = ethers.parseEther("50"); // Total would be 110 > 100 limit

            // First repayment (should work)
            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount1);
            await rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                repayAmount1
            );

            // Second repayment (should fail)
            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount2);
            await expect(rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                repayAmount2
            )).to.be.revertedWithCustomError(rent2Repay, "WeeklyLimitExceeded");
        });
    });

    describe("Weekly Reset Logic", function () {
        beforeEach(async function () {
            await rent2Repay.connect(user).configureRent2Repay(await wxdaiToken.getAddress(), WEEKLY_AMOUNT_WXDAI);
            await rent2Repay.connect(user).configureRent2Repay(await usdcToken.getAddress(), WEEKLY_AMOUNT_USDC);
        });

        it("Should reset weekly counter after one week for all tokens", async function () {
            const repayAmount = ethers.parseEther("50");
            const usdcRepayAmount = ethers.parseUnits("75", 6);

            // Make repayments
            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);
            await rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                repayAmount
            );

            await usdcToken.connect(anyone).approve(await rent2Repay.getAddress(), usdcRepayAmount);
            await rent2Repay.connect(anyone).rent2repay(
                user.address,
                await usdcToken.getAddress(),
                usdcRepayAmount
            );

            // Advance time by one week
            await time.increase(WEEK_IN_SECONDS);

            // Check available amounts (should be full limits again)
            expect(await rent2Repay.getAvailableAmountThisWeek(user.address, await wxdaiToken.getAddress()))
                .to.equal(WEEKLY_AMOUNT_WXDAI);
            expect(await rent2Repay.getAvailableAmountThisWeek(user.address, await usdcToken.getAddress()))
                .to.equal(WEEKLY_AMOUNT_USDC);

            // Make another repayment to verify reset worked
            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);
            await rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                repayAmount
            );

            const config = await rent2Repay.getUserConfigForToken(user.address, await wxdaiToken.getAddress());
            expect(config[1]).to.equal(repayAmount); // Should show only the new repayment
        });

        it("Should return full amount for newly authorized user", async function () {
            expect(await rent2Repay.getAvailableAmountThisWeek(otherUser.address, await wxdaiToken.getAddress()))
                .to.equal(0); // Not authorized

            await rent2Repay.connect(otherUser).configureRent2Repay(await wxdaiToken.getAddress(), WEEKLY_AMOUNT_WXDAI);

            expect(await rent2Repay.getAvailableAmountThisWeek(otherUser.address, await wxdaiToken.getAddress()))
                .to.equal(WEEKLY_AMOUNT_WXDAI);
        });

        it("Should return zero for user not authorized for specific token", async function () {
            // Dans ce test, l'utilisateur a configuré both WXDAI et USDC dans le beforeEach
            // donc utilisons otherUser qui n'a rien configuré
            expect(await rent2Repay.getAvailableAmountThisWeek(otherUser.address, await usdcToken.getAddress()))
                .to.equal(0); // otherUser is not authorized for any token

            // But user should have both tokens configured
            expect(await rent2Repay.getAvailableAmountThisWeek(user.address, await wxdaiToken.getAddress()))
                .to.equal(WEEKLY_AMOUNT_WXDAI);
            expect(await rent2Repay.getAvailableAmountThisWeek(user.address, await usdcToken.getAddress()))
                .to.equal(WEEKLY_AMOUNT_USDC);
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            await rent2Repay.connect(user).configureRent2Repay(await wxdaiToken.getAddress(), WEEKLY_AMOUNT_WXDAI);
            await rent2Repay.connect(user).configureRent2Repay(await usdcToken.getAddress(), WEEKLY_AMOUNT_USDC);
        });

        it("Should return correct authorization status", async function () {
            expect(await rent2Repay.isAuthorized(user.address)).to.be.true;
            expect(await rent2Repay.isAuthorized(otherUser.address)).to.be.false;

            expect(await rent2Repay.isAuthorizedForToken(user.address, await wxdaiToken.getAddress())).to.be.true;
            expect(await rent2Repay.isAuthorizedForToken(user.address, await usdcToken.getAddress())).to.be.true;
            expect(await rent2Repay.isAuthorizedForToken(otherUser.address, await wxdaiToken.getAddress())).to.be.false;
        });

        it("Should return correct user configuration", async function () {
            const wxdaiConfig = await rent2Repay.getUserConfigForToken(user.address, await wxdaiToken.getAddress());
            const usdcConfig = await rent2Repay.getUserConfigForToken(user.address, await usdcToken.getAddress());

            expect(wxdaiConfig[0]).to.equal(WEEKLY_AMOUNT_WXDAI); // weeklyMaxAmount
            expect(wxdaiConfig[1]).to.equal(0); // currentSpent
            expect(wxdaiConfig[2]).to.be.gt(0); // lastRepayTimestamp (should be set)

            expect(usdcConfig[0]).to.equal(WEEKLY_AMOUNT_USDC);
            expect(usdcConfig[1]).to.equal(0);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle reconfiguration after spending", async function () {
            await rent2Repay.connect(user).configureRent2Repay(await wxdaiToken.getAddress(), WEEKLY_AMOUNT_WXDAI);

            // Make a repayment
            const repayAmount = ethers.parseEther("50");
            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);
            await rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                repayAmount
            );

            // Reconfigure with higher limit
            const newLimit = ethers.parseEther("200");
            await rent2Repay.connect(user).configureRent2Repay(await wxdaiToken.getAddress(), newLimit);

            // Should be able to spend more now
            const additionalAmount = ethers.parseEther("120");
            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), additionalAmount);
            await rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                additionalAmount
            );

            const config = await rent2Repay.getUserConfigForToken(user.address, await wxdaiToken.getAddress());
            expect(config[1]).to.equal(additionalAmount); // currentSpent should be reset on reconfiguration
        });

        it("Should handle operator removal after partial spending", async function () {
            await rent2Repay.connect(user).configureRent2Repay(await wxdaiToken.getAddress(), WEEKLY_AMOUNT_WXDAI);

            // Make a repayment
            const repayAmount = ethers.parseEther("50");
            await wxdaiToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);
            await rent2Repay.connect(anyone).rent2repay(
                user.address,
                await wxdaiToken.getAddress(),
                repayAmount
            );

            // Operator removes user
            await rent2Repay.connect(operator).removeUser(user.address);

            expect(await rent2Repay.isAuthorized(user.address)).to.be.false;
            expect(await rent2Repay.getAvailableAmountThisWeek(user.address, await wxdaiToken.getAddress())).to.equal(0);
        });
    });
}); 