const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Rent2Repay", function () {
    let rent2Repay;
    let admin, emergency, operator, user, otherUser, anyone;

    // Constantes
    const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
    const WEEKLY_AMOUNT = ethers.parseEther("100");

    beforeEach(async function () {
        [admin, emergency, operator, user, otherUser, anyone] = await ethers.getSigners();

        const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
        rent2Repay = await Rent2Repay.deploy(
            admin.address,
            emergency.address,
            operator.address
        );
        await rent2Repay.waitForDeployment();
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

            const [maxAmount, lastTimestamp, currentSpent] = await rent2Repay.getUserConfig(user.address);
            expect(maxAmount).to.equal(WEEKLY_AMOUNT);
            expect(lastTimestamp).to.equal(0);
            expect(currentSpent).to.equal(0);
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

            const [maxAmount] = await rent2Repay.getUserConfig(user.address);
            expect(maxAmount).to.equal(newAmount);
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

            const [maxAmount, lastTimestamp, currentSpent] = await rent2Repay.getUserConfig(user.address);
            expect(maxAmount).to.equal(0);
            expect(lastTimestamp).to.equal(0);
            expect(currentSpent).to.equal(0);
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

            await expect(rent2Repay.connect(anyone).rent2repay(user.address, repayAmount))
                .to.emit(rent2Repay, "RepaymentExecuted")
                .withArgs(user.address, repayAmount, ethers.parseEther("50"));

            const [, , currentSpent] = await rent2Repay.getUserConfig(user.address);
            expect(currentSpent).to.equal(repayAmount);
        });

        it("Should reject repayment when paused", async function () {
            await rent2Repay.connect(emergency).pause();

            await expect(rent2Repay.connect(anyone).rent2repay(user.address, ethers.parseEther("50")))
                .to.be.revertedWithCustomError(rent2Repay, "EnforcedPause");
        });

        it("Should reject repayment exceeding weekly limit", async function () {
            const repayAmount = ethers.parseEther("150");

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

            await rent2Repay.connect(anyone).rent2repay(user.address, firstRepay);
            await rent2Repay.connect(anyone).rent2repay(user.address, secondRepay);

            const available = await rent2Repay.getAvailableAmountThisWeek(user.address);
            expect(available).to.equal(ethers.parseEther("30")); // 100 - 30 - 40 = 30
        });

        it("Should reject repayment when cumulative amount exceeds limit", async function () {
            await rent2Repay.connect(anyone).rent2repay(user.address, ethers.parseEther("60"));

            await expect(rent2Repay.connect(anyone).rent2repay(user.address, ethers.parseEther("50")))
                .to.be.revertedWithCustomError(rent2Repay, "WeeklyLimitExceeded");
        });
    });

    describe("Weekly Reset Logic", function () {
        beforeEach(async function () {
            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);
        });

        it("Should reset weekly limit after one week", async function () {
            // Premier repayment
            await rent2Repay.connect(anyone).rent2repay(user.address, ethers.parseEther("80"));

            expect(await rent2Repay.getAvailableAmountThisWeek(user.address)).to.equal(ethers.parseEther("20"));

            // Avancer d'une semaine
            await time.increase(WEEK_IN_SECONDS);

            // Le montant disponible devrait être réinitialisé
            expect(await rent2Repay.getAvailableAmountThisWeek(user.address)).to.equal(WEEKLY_AMOUNT);

            // Nouveau repayment devrait fonctionner
            await expect(rent2Repay.connect(anyone).rent2repay(user.address, ethers.parseEther("90")))
                .to.emit(rent2Repay, "RepaymentExecuted");
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

            const [maxAmount, lastTimestamp, currentSpent] = await rent2Repay.getUserConfig(user.address);
            expect(maxAmount).to.equal(WEEKLY_AMOUNT);
            expect(lastTimestamp).to.equal(0);
            expect(currentSpent).to.equal(0);

            // Après un repayment
            await rent2Repay.connect(anyone).rent2repay(user.address, ethers.parseEther("30"));

            const [, newTimestamp, newSpent] = await rent2Repay.getUserConfig(user.address);
            expect(newTimestamp).to.be.greaterThan(0);
            expect(newSpent).to.equal(ethers.parseEther("30"));
        });
    });

    describe("Edge Cases", function () {
        it("Should handle user reconfiguring after spending", async function () {
            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);
            await rent2Repay.connect(anyone).rent2repay(user.address, ethers.parseEther("50"));

            // Reconfiguration avec un montant plus élevé
            const newAmount = ethers.parseEther("200");
            await rent2Repay.connect(user).configureRent2Repay(newAmount);

            // Les données devraient être réinitialisées
            const [maxAmount, lastTimestamp, currentSpent] = await rent2Repay.getUserConfig(user.address);
            expect(maxAmount).to.equal(newAmount);
            expect(lastTimestamp).to.equal(0);
            expect(currentSpent).to.equal(0);
        });

        it("Should handle operator removing user after partial spending", async function () {
            await rent2Repay.connect(user).configureRent2Repay(WEEKLY_AMOUNT);
            await rent2Repay.connect(anyone).rent2repay(user.address, ethers.parseEther("50"));

            await rent2Repay.connect(operator).removeUser(user.address);

            expect(await rent2Repay.isAuthorized(user.address)).to.be.false;
            expect(await rent2Repay.getAvailableAmountThisWeek(user.address)).to.equal(0);
        });
    });
}); 