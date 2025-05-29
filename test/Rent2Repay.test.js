const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Rent2Repay", function () {
    let rent2Repay, mockRMM, repaymentToken;
    let admin, emergency, operator, user, otherUser, anyone;

    // Constantes
    const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
    const WEEKLY_AMOUNT = ethers.parseEther("100");

    beforeEach(async function () {
        [admin, emergency, operator, user, otherUser, anyone] = await ethers.getSigners();

        // Déployer le token de repayment
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        repaymentToken = await MockERC20.deploy("USD Coin", "USDC");
        await repaymentToken.waitForDeployment();

        // Déployer le MockRMM
        const MockRMM = await ethers.getContractFactory("MockRMM");
        mockRMM = await MockRMM.deploy();
        await mockRMM.waitForDeployment();

        // Déployer Rent2Repay avec RMM et token
        const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
        rent2Repay = await Rent2Repay.deploy(
            admin.address,
            emergency.address,
            operator.address,
            await mockRMM.getAddress(),
            await repaymentToken.getAddress()
        );
        await rent2Repay.waitForDeployment();

        // Mint des tokens pour les tests et configuriner des dettes
        const mintAmount = ethers.parseEther("1000");
        await repaymentToken.mint(user.address, mintAmount);
        await repaymentToken.mint(otherUser.address, mintAmount);
        await repaymentToken.mint(anyone.address, mintAmount);

        // Configurer des dettes dans le MockRMM pour les tests
        const debtAmount = ethers.parseEther("500");
        await mockRMM.setDebt(user.address, await repaymentToken.getAddress(), debtAmount);
        await mockRMM.setDebt(otherUser.address, await repaymentToken.getAddress(), debtAmount);
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
    });

    describe("User Configuration", function () {
        it("Should allow user to configure Rent2Repay with valid amount", async function () {
            await expect(rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT))
                .to.emit(rent2Repay, "Rent2RepayConfigured")
                .withArgs(user.address, WEEKLY_AMOUNT);

            expect(await rent2Repay.isAuthorized(user.address)).to.be.true;

            const userConfig = await rent2Repay.userConfigs(user.address);
            expect(userConfig.weeklyMaxAmount).to.equal(WEEKLY_AMOUNT);
            expect(userConfig.lastRepayTimestamp).to.equal(0);
            expect(userConfig.currentWeekSpent).to.equal(0);
        });

        it("Should not allow configuration with zero amount", async function () {
            await expect(rent2Repay.connect(user).configureRent2Repay(0))
                .to.be.revertedWithCustomError(rent2Repay, "AmountMustBeGreaterThanZero");
        });

        it("Should not allow configuration when paused", async function () {
            await rent2Repay.connect(emergency).pause();

            await expect(rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT))
                .to.be.revertedWithCustomError(rent2Repay, "EnforcedPause");
        });

        it("Should allow user to reconfigure with different amount", async function () {
            const newAmount = ethers.parseEther("200");

            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);
            await rent2Repay.connect(user).configureRent2Repay(newAmount);

            const userConfig = await rent2Repay.userConfigs(user.address);
            expect(userConfig.weeklyMaxAmount).to.equal(newAmount);
        });
    });

    describe("User Revocation", function () {
        beforeEach(async function () {
            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);
        });

        it("Should allow user to revoke their own authorization", async function () {
            await expect(rent2Repay.connect(user).revokeRent2Repay())
                .to.emit(rent2Repay, "Rent2RepayRevoked")
                .withArgs(user.address);

            expect(await rent2Repay.isAuthorized(user.address)).to.be.false;

            const userConfig = await rent2Repay.userConfigs(user.address);
            expect(userConfig.weeklyMaxAmount).to.equal(0);
            expect(userConfig.lastRepayTimestamp).to.equal(0);
            expect(userConfig.currentWeekSpent).to.equal(0);
        });

        it("Should not allow non-authorized user to revoke", async function () {
            await expect(rent2Repay.connect(otherUser).revokeRent2Repay())
                .to.be.revertedWithCustomError(rent2Repay, "UserNotAuthorized");
        });
    });

    describe("Operator Functions", function () {
        beforeEach(async function () {
            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);
        });

        it("Should allow operator to remove user", async function () {
            await expect(rent2Repay.connect(operator).removeUser(user.address))
                .to.emit(rent2Repay, "UserRemovedByOperator")
                .withArgs(operator.address, user.address);

            expect(await rent2Repay.isAuthorized(user.address)).to.be.false;
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

    describe("Repayment Validation", function () {
        beforeEach(async function () {
            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);
        });

        it("Should allow anyone to validate repayment within limits", async function () {
            const repayAmount = ethers.parseEther("50");

            // Approuver le contrat pour dépenser les tokens
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);

            await expect(rent2Repay.connect(anyone).rent2repay(user.address, repayAmount))
                .to.emit(rent2Repay, "RepaymentExecuted")
                .withArgs(user.address, repayAmount, ethers.parseEther("50"), anyone.address);

            const userConfig = await rent2Repay.userConfigs(user.address);
            expect(userConfig.currentWeekSpent).to.equal(repayAmount);
        });

        it("Should reject repayment with zero address", async function () {
            const repayAmount = ethers.parseEther("50");
            const zeroAddress = "0x0000000000000000000000000000000000000000";

            await expect(rent2Repay.connect(anyone).rent2repay(zeroAddress, repayAmount))
                .to.be.revertedWithCustomError(rent2Repay, "InvalidUserAddress");
        });

        it("Should reject repayment when user tries to repay for themselves", async function () {
            const repayAmount = ethers.parseEther("50");

            await expect(rent2Repay.connect(user).rent2repay(user.address, repayAmount))
                .to.be.revertedWithCustomError(rent2Repay, "CannotRepayForSelf");
        });

        it("Should reject repayment when paused", async function () {
            await rent2Repay.connect(emergency).pause();

            await expect(rent2Repay.connect(anyone).rent2repay(user.address, ethers.parseEther("50")))
                .to.be.revertedWithCustomError(rent2Repay, "EnforcedPause");
        });

        it("Should reject repayment exceeding weekly limit", async function () {
            const repayAmount = ethers.parseEther("150");

            // Approuver le contrat pour dépenser les tokens
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);

            await expect(rent2Repay.connect(anyone).rent2repay(user.address, repayAmount))
                .to.be.revertedWithCustomError(rent2Repay, "WeeklyLimitExceeded");
        });

        it("Should reject repayment for unauthorized user", async function () {
            await expect(rent2Repay.connect(anyone).rent2repay(otherUser.address, ethers.parseEther("50")))
                .to.be.revertedWithCustomError(rent2Repay, "UserNotAuthorized");
        });

        it("Should reject zero amount repayment", async function () {
            await expect(rent2Repay.connect(anyone).rent2repay(user.address, 0))
                .to.be.revertedWithCustomError(rent2Repay, "AmountMustBeGreaterThanZero");
        });

        it("Should allow multiple repayments within weekly limit", async function () {
            const firstRepay = ethers.parseEther("30");
            const secondRepay = ethers.parseEther("40");

            // Approuver le contrat pour dépenser les tokens
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), firstRepay + secondRepay);

            await rent2Repay.connect(anyone).rent2repay(user.address, firstRepay);
            await rent2Repay.connect(anyone).rent2repay(user.address, secondRepay);

            const userConfig = await rent2Repay.userConfigs(user.address);
            expect(userConfig.currentWeekSpent).to.equal(ethers.parseEther("70")); // 30 + 40 = 70
        });

        it("Should reject repayment when cumulative amount exceeds limit", async function () {
            // Approuver le contrat pour dépenser les tokens
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), ethers.parseEther("60"));
            await rent2Repay.connect(anyone).rent2repay(user.address, ethers.parseEther("60"));

            // Approuver pour le second repayment
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), ethers.parseEther("50"));

            await expect(rent2Repay.connect(anyone).rent2repay(user.address, ethers.parseEther("50")))
                .to.be.revertedWithCustomError(rent2Repay, "WeeklyLimitExceeded");
        });

        it("Should handle edge case with maximum uint256 amount (overflow protection)", async function () {
            const maxUint256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

            await expect(rent2Repay.connect(anyone).rent2repay(user.address, maxUint256))
                .to.be.revertedWithCustomError(rent2Repay, "WeeklyLimitExceeded");
        });

        it("Should properly calculate remaining amount in event", async function () {
            const repayAmount = ethers.parseEther("30");
            const expectedRemaining = ethers.parseEther("70");

            // Approuver le contrat pour dépenser les tokens
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);

            const tx = await rent2Repay.connect(anyone).rent2repay(user.address, repayAmount);
            const receipt = await tx.wait();

            // Vérifier l'événement
            const event = receipt.logs.find(log => log.fragment?.name === "RepaymentExecuted");
            expect(event.args[0]).to.equal(user.address);
            expect(event.args[1]).to.equal(repayAmount);
            expect(event.args[2]).to.equal(expectedRemaining);
            expect(event.args[3]).to.equal(anyone.address);
        });

        it("Should reject repayment when caller has insufficient tokens", async function () {
            const repayAmount = ethers.parseEther("2000"); // Plus que le montant minté (1000)

            // Approuver le contrat même avec un montant insuffisant
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);

            await expect(rent2Repay.connect(anyone).rent2repay(user.address, repayAmount))
                .to.be.revertedWithCustomError(rent2Repay, "InsufficientTokenBalance");
        });
    });

    describe("Weekly Reset Logic", function () {
        beforeEach(async function () {
            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);
        });

        it("Should reset weekly limit after one week", async function () {
            // Premier repayment
            const firstAmount = ethers.parseEther("80");
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), firstAmount);
            await rent2Repay.connect(anyone).rent2repay(user.address, firstAmount);

            let userConfig = await rent2Repay.userConfigs(user.address);
            expect(userConfig.currentWeekSpent).to.equal(firstAmount);

            // Avancer d'une semaine
            await time.increase(WEEK_IN_SECONDS);

            // Nouveau repayment devrait fonctionner
            const secondAmount = ethers.parseEther("90");
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), secondAmount);
            await expect(rent2Repay.connect(anyone).rent2repay(user.address, secondAmount))
                .to.emit(rent2Repay, "RepaymentExecuted");

            userConfig = await rent2Repay.userConfigs(user.address);
            expect(userConfig.currentWeekSpent).to.equal(secondAmount); // Doit être remis à zéro puis le nouveau montant
        });

        it("Should return full amount for user with no previous repayments", async function () {
            const available = await rent2Repay.getAvailableAmountThisWeek(user.address);
            expect(available).to.equal(WEEKLY_AMOUNT);
        });

        it("Should return zero for unauthorized user", async function () {
            const available = await rent2Repay.getAvailableAmountThisWeek(otherUser.address);
            expect(available).to.equal(0);
        });
    });

    describe("View Functions", function () {
        it("Should return correct authorization status", async function () {
            expect(await rent2Repay.isAuthorized(user.address)).to.be.false;

            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);
            expect(await rent2Repay.isAuthorized(user.address)).to.be.true;

            await rent2Repay.connect(user).revokeRent2Repay();
            expect(await rent2Repay.isAuthorized(user.address)).to.be.false;
        });

        it("Should return correct user configuration", async function () {
            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);

            const userConfig = await rent2Repay.userConfigs(user.address);
            expect(userConfig.weeklyMaxAmount).to.equal(WEEKLY_AMOUNT);
            expect(userConfig.lastRepayTimestamp).to.equal(0);
            expect(userConfig.currentWeekSpent).to.equal(0);

            // Après un repayment
            const repayAmount = ethers.parseEther("30");
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);
            await rent2Repay.connect(anyone).rent2repay(user.address, repayAmount);

            const newUserConfig = await rent2Repay.userConfigs(user.address);
            expect(newUserConfig.lastRepayTimestamp).to.be.greaterThan(0);
            expect(newUserConfig.currentWeekSpent).to.equal(repayAmount);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle user reconfiguring after spending", async function () {
            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);

            const repayAmount = ethers.parseEther("50");
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);
            await rent2Repay.connect(anyone).rent2repay(user.address, repayAmount);

            // Reconfiguration avec un montant plus élevé
            const newAmount = ethers.parseEther("200");
            await rent2Repay.connect(user).configureRent2Repay(newAmount);

            // Les données devraient être réinitialisées
            const userConfig = await rent2Repay.userConfigs(user.address);
            expect(userConfig.weeklyMaxAmount).to.equal(newAmount);
            expect(userConfig.lastRepayTimestamp).to.equal(0);
            expect(userConfig.currentWeekSpent).to.equal(0);
        });

        it("Should handle operator removing user after partial spending", async function () {
            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);

            const repayAmount = ethers.parseEther("50");
            await repaymentToken.connect(anyone).approve(await rent2Repay.getAddress(), repayAmount);
            await rent2Repay.connect(anyone).rent2repay(user.address, repayAmount);

            await rent2Repay.connect(operator).removeUser(user.address);

            expect(await rent2Repay.isAuthorized(user.address)).to.be.false;
            const userConfig = await rent2Repay.userConfigs(user.address);
            expect(userConfig.weeklyMaxAmount).to.equal(0);
        });
    });
}); 