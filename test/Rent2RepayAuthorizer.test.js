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

    describe("Authorization", function () {
        it("Should allow user to authorize Rent2Repay", async function () {
            await expect(rent2RepayAuthorizer.connect(user).authorizeRent2Repay())
                .to.emit(rent2RepayAuthorizer, "Rent2RepayAuthorized")
                .withArgs(user.address);

            expect(await rent2RepayAuthorizer.isAuthorized(user.address)).to.be.true;
        });

        it("Should not allow user to authorize Rent2Repay twice", async function () {
            await rent2RepayAuthorizer.connect(user).authorizeRent2Repay();
            
            await expect(rent2RepayAuthorizer.connect(user).authorizeRent2Repay())
                .to.be.revertedWith("Already authorized");
        });

        it("Should allow user to revoke Rent2Repay authorization", async function () {
            await rent2RepayAuthorizer.connect(user).authorizeRent2Repay();
            
            await expect(rent2RepayAuthorizer.connect(user).revokeRent2Repay())
                .to.emit(rent2RepayAuthorizer, "Rent2RepayRevoked")
                .withArgs(user.address);

            expect(await rent2RepayAuthorizer.isAuthorized(user.address)).to.be.false;
        });

        it("Should not allow user to revoke Rent2Repay if not authorized", async function () {
            await expect(rent2RepayAuthorizer.connect(user).revokeRent2Repay())
                .to.be.revertedWith("Not authorized");
        });
    });
}); 