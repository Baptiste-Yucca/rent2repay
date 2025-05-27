const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Rent2RepayAuthorizer", function () {
    let rent2RepayAuthorizer;
    let owner;
    let user;

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();
        const Rent2RepayAuthorizer = await ethers.getContractFactory("Rent2RepayAuthorizer");
        rent2RepayAuthorizer = await Rent2RepayAuthorizer.deploy();
        await rent2RepayAuthorizer.waitForDeployment();
    });

    describe("Configuration", function () {
        it("Should allow user to configure Rent2Repay with valid amount", async function () {
            const weeklyAmount = ethers.parseEther("100");
            
            await expect(rent2RepayAuthorizer.connect(user).configureRent2Repay(weeklyAmount))
                .to.emit(rent2RepayAuthorizer, "Rent2RepayConfigured")
                .withArgs(user.address, weeklyAmount);

            expect(await rent2RepayAuthorizer.isAuthorized(user.address)).to.be.true;
            
            const [maxAmount, lastTimestamp, currentSpent] = await rent2RepayAuthorizer.getUserConfig(user.address);
            expect(maxAmount).to.equal(weeklyAmount);
            expect(lastTimestamp).to.equal(0);
            expect(currentSpent).to.equal(0);
        });

        it("Should not allow user to configure Rent2Repay with zero amount", async function () {
            await expect(rent2RepayAuthorizer.connect(user).configureRent2Repay(0))
                .to.be.revertedWithCustomError(rent2RepayAuthorizer, "AmountMustBeGreaterThanZero");
        });

        it("Should allow user to reconfigure with different amount", async function () {
            const firstAmount = ethers.parseEther("100");
            const secondAmount = ethers.parseEther("200");
            
            await rent2RepayAuthorizer.connect(user).configureRent2Repay(firstAmount);
            await rent2RepayAuthorizer.connect(user).configureRent2Repay(secondAmount);
            
            const [maxAmount] = await rent2RepayAuthorizer.getUserConfig(user.address);
            expect(maxAmount).to.equal(secondAmount);
        });

        it("Should allow user to revoke Rent2Repay authorization", async function () {
            const weeklyAmount = ethers.parseEther("100");
            await rent2RepayAuthorizer.connect(user).configureRent2Repay(weeklyAmount);
            
            await expect(rent2RepayAuthorizer.connect(user).revokeRent2Repay())
                .to.emit(rent2RepayAuthorizer, "Rent2RepayRevoked")
                .withArgs(user.address);

            expect(await rent2RepayAuthorizer.isAuthorized(user.address)).to.be.false;
        });

        it("Should not allow user to revoke Rent2Repay if not authorized", async function () {
            await expect(rent2RepayAuthorizer.connect(user).revokeRent2Repay())
                .to.be.revertedWithCustomError(rent2RepayAuthorizer, "UserNotAuthorized");
        });
    });

    describe("Weekly Limits", function () {
        beforeEach(async function () {
            const weeklyAmount = ethers.parseEther("100");
            await rent2RepayAuthorizer.connect(user).configureRent2Repay(weeklyAmount);
        });

        it("Should return full amount available for new user", async function () {
            const available = await rent2RepayAuthorizer.getAvailableAmountThisWeek(user.address);
            expect(available).to.equal(ethers.parseEther("100"));
        });

        it("Should validate and update repayment within limits", async function () {
            const repayAmount = ethers.parseEther("50");
            
            await expect(rent2RepayAuthorizer.validateAndUpdateRepayment(user.address, repayAmount))
                .to.emit(rent2RepayAuthorizer, "RepaymentExecuted")
                .withArgs(user.address, repayAmount, ethers.parseEther("50"));

            const available = await rent2RepayAuthorizer.getAvailableAmountThisWeek(user.address);
            expect(available).to.equal(ethers.parseEther("50"));
        });

        it("Should reject repayment exceeding weekly limit", async function () {
            const repayAmount = ethers.parseEther("150");
            
            await expect(rent2RepayAuthorizer.validateAndUpdateRepayment(user.address, repayAmount))
                .to.be.revertedWithCustomError(rent2RepayAuthorizer, "WeeklyLimitExceeded");
        });

        it("Should reject repayment for unauthorized user", async function () {
            const repayAmount = ethers.parseEther("50");
            
            await expect(rent2RepayAuthorizer.validateAndUpdateRepayment(owner.address, repayAmount))
                .to.be.revertedWithCustomError(rent2RepayAuthorizer, "UserNotAuthorized");
        });

        it("Should reject zero amount repayment", async function () {
            await expect(rent2RepayAuthorizer.validateAndUpdateRepayment(user.address, 0))
                .to.be.revertedWithCustomError(rent2RepayAuthorizer, "AmountMustBeGreaterThanZero");
        });
    });
}); 