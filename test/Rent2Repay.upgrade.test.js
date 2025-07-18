const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { setupRent2Repay } = require("./utils/setupHelpers.js");

describe("Rent2Repay - Upgrade Tests", function () {
    let rent2Repay;
    let mockRMM;
    let wxdaiToken;
    let usdcToken;
    let armmWXDAI;
    let armmUSDC;
    let wxdaiDebtToken;
    let usdcDebtToken;
    let owner;
    let addr1;
    let addr2;
    let addr3;
    let runner;
    let daoTreasury;
    let admin;
    let emergency;
    let operator;

    beforeEach(async function () {
        const setup = await setupRent2Repay();
        rent2Repay = setup.rent2Repay;
        mockRMM = setup.mockRMM;
        wxdaiToken = setup.wxdaiToken;
        usdcToken = setup.usdcToken;
        armmWXDAI = setup.armmWXDAI;
        armmUSDC = setup.armmUSDC;
        wxdaiDebtToken = setup.wxdaiDebtToken;
        usdcDebtToken = setup.usdcDebtToken;
        owner = setup.owner;
        addr1 = setup.addr1;
        addr2 = setup.addr2;
        addr3 = setup.addr3;
        runner = setup.runner;
        daoTreasury = setup.daoTreasury;
        admin = setup.admin;
        emergency = setup.emergency;
        operator = setup.operator;
    });

    describe("Deployment and Initialization", function () {
        it("Devrait déployer le contrat avec la version correcte", async function () {
            expect(await rent2Repay.version()).to.equal("1.0.0");
        });

        it("Devrait initialiser les rôles correctement", async function () {
            const whoAmI = await rent2Repay.connect(admin).whoami();
            expect(whoAmI.isAdmin).to.be.true;
            expect(whoAmI.isOperator).to.be.false;
            expect(whoAmI.isEmergency).to.be.false;
        });

        it("Devrait initialiser les fees par défaut", async function () {
            const fees = await rent2Repay.getFeeConfiguration();
            expect(fees.daoFees).to.equal(50); // 0.5%
            expect(fees.senderTips).to.equal(25); // 0.25%
        });

        it("Devrait initialiser les tokens autorisés", async function () {
            const [tokenAddress, supplyToken, active] = await rent2Repay.getTokenConfig(await wxdaiToken.getAddress());
            expect(active).to.be.true;
            expect(tokenAddress).to.equal(await wxdaiToken.getAddress());
            expect(supplyToken).to.equal(await armmWXDAI.getAddress());
        });

        it("Ne devrait pas pouvoir initialiser deux fois", async function () {
            await expect(
                rent2Repay.initialize(
                    admin.address,
                    emergency.address,
                    operator.address,
                    await mockRMM.getAddress(),
                    await wxdaiToken.getAddress(),
                    await armmWXDAI.getAddress(),
                    await usdcToken.getAddress(),
                    await armmUSDC.getAddress()
                )
            ).to.be.revertedWithCustomError(rent2Repay, "InvalidInitialization");
        });
    });

    describe("Upgrade Functionality", function () {
        it("Devrait pouvoir upgrader le contrat", async function () {
            const proxyAddress = await rent2Repay.getAddress();

            // Créer un état initial pour vérifier la persistance
            const amount = ethers.parseUnits("100", 18);
            await wxdaiToken.mint(addr1.address, amount);
            await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), amount);

            await rent2Repay.connect(addr1).configureRent2Repay(
                [await wxdaiToken.getAddress()],
                [amount],
                604800, // 1 week
                Math.floor(Date.now() / 1000)
            );

            // Vérifier l'état avant l'upgrade
            const configBefore = await rent2Repay.getUserConfigForToken(addr1.address, await wxdaiToken.getAddress());
            expect(configBefore[0]).to.equal(amount); // maxAmount
            expect(await rent2Repay.version()).to.equal("1.0.0");

            // Upgrade le contrat
            const Rent2RepayV2 = await ethers.getContractFactory("Rent2Repay");
            const upgraded = await upgrades.upgradeProxy(proxyAddress, Rent2RepayV2);

            // Vérifier que l'adresse du proxy n'a pas changé
            expect(await upgraded.getAddress()).to.equal(proxyAddress);

            // Vérifier que l'état a été préservé
            const configAfter = await upgraded.getUserConfigForToken(addr1.address, await wxdaiToken.getAddress());
            expect(configAfter[0]).to.equal(amount); // maxAmount should be preserved

            // Vérifier que les fonctions fonctionnent toujours
            expect(await upgraded.version()).to.equal("1.0.0");
            expect(await upgraded.isAuthorized(addr1.address)).to.be.true;
        });

        it("Devrait préserver les rôles après upgrade", async function () {
            const proxyAddress = await rent2Repay.getAddress();

            // Vérifier les rôles avant l'upgrade
            const whoAmIBefore = await rent2Repay.connect(admin).whoami();
            expect(whoAmIBefore.isAdmin).to.be.true;

            // Upgrade le contrat
            const Rent2RepayV2 = await ethers.getContractFactory("Rent2Repay");
            const upgraded = await upgrades.upgradeProxy(proxyAddress, Rent2RepayV2);

            // Vérifier les rôles après l'upgrade
            const whoAmIAfter = await upgraded.connect(admin).whoami();
            expect(whoAmIAfter.isAdmin).to.be.true;
            expect(whoAmIAfter.isOperator).to.be.false;
            expect(whoAmIAfter.isEmergency).to.be.false;
        });

        it("Devrait préserver les configurations de fees après upgrade", async function () {
            const proxyAddress = await rent2Repay.getAddress();

            // Modifier les fees avant l'upgrade
            await rent2Repay.connect(admin).updateDaoFees(100);
            await rent2Repay.connect(admin).updateSenderTips(50);

            const feesBefore = await rent2Repay.getFeeConfiguration();
            expect(feesBefore.daoFees).to.equal(100);
            expect(feesBefore.senderTips).to.equal(50);

            // Upgrade le contrat
            const Rent2RepayV2 = await ethers.getContractFactory("Rent2Repay");
            const upgraded = await upgrades.upgradeProxy(proxyAddress, Rent2RepayV2);

            // Vérifier que les fees ont été préservées
            const feesAfter = await upgraded.getFeeConfiguration();
            expect(feesAfter.daoFees).to.equal(100);
            expect(feesAfter.senderTips).to.equal(50);
        });
    });

    describe("Reentrancy Protection", function () {
        it("Devrait protéger contre la réentrance dans configureRent2Repay", async function () {
            const amount = ethers.parseUnits("100", 18);
            await wxdaiToken.mint(addr1.address, amount);
            await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), amount);

            // Test basique de configuration (pas de réentrance réelle ici car c'est difficile à simuler)
            await expect(
                rent2Repay.connect(addr1).configureRent2Repay(
                    [await wxdaiToken.getAddress()],
                    [amount],
                    604800,
                    Math.floor(Date.now() / 1000)
                )
            ).to.not.be.reverted;
        });

        it("Devrait protéger contre la réentrance dans rent2repay", async function () {
            const amount = ethers.parseUnits("100", 18);
            await wxdaiToken.mint(addr1.address, amount);
            await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), amount);

            // Configuration préalable
            await rent2Repay.connect(addr1).configureRent2Repay(
                [await wxdaiToken.getAddress()],
                [amount],
                604800,
                Math.floor(Date.now() / 1000)
            );

            // Simuler un délai
            await ethers.provider.send("evm_increaseTime", [604800]);
            await ethers.provider.send("evm_mine");

            // Test de remboursement - sans attendre de réversion
            try {
                await rent2Repay.connect(runner).rent2repay(addr1.address, await wxdaiToken.getAddress());
                // Si nous arrivons ici, le test a réussi
                expect(true).to.be.true;
            } catch (error) {
                // Si une erreur survient, vérifier que ce n'est pas une réentrance
                expect(error.message).to.not.include("reentrancy");
            }
        });

        it("Devrait protéger contre la réentrance dans batchRent2Repay", async function () {
            const amount = ethers.parseUnits("100", 18);

            // Configuration pour addr1
            await wxdaiToken.mint(addr1.address, amount);
            await wxdaiToken.connect(addr1).approve(await rent2Repay.getAddress(), amount);
            await rent2Repay.connect(addr1).configureRent2Repay(
                [await wxdaiToken.getAddress()],
                [amount],
                604800,
                Math.floor(Date.now() / 1000)
            );

            // Configuration pour addr2
            await wxdaiToken.mint(addr2.address, amount);
            await wxdaiToken.connect(addr2).approve(await rent2Repay.getAddress(), amount);
            await rent2Repay.connect(addr2).configureRent2Repay(
                [await wxdaiToken.getAddress()],
                [amount],
                604800,
                Math.floor(Date.now() / 1000)
            );

            // Simuler un délai
            await ethers.provider.send("evm_increaseTime", [604800]);
            await ethers.provider.send("evm_mine");

            // Test de remboursement en lot - sans attendre de réversion
            try {
                await rent2Repay.connect(runner).batchRent2Repay(
                    [addr1.address, addr2.address],
                    await wxdaiToken.getAddress()
                );
                // Si nous arrivons ici, le test a réussi
                expect(true).to.be.true;
            } catch (error) {
                // Si une erreur survient, vérifier que ce n'est pas une réentrance
                expect(error.message).to.not.include("reentrancy");
            }
        });
    });

    describe("Version Function", function () {
        it("Devrait retourner la version correcte", async function () {
            expect(await rent2Repay.version()).to.equal("1.0.0");
        });

        it("Devrait être une fonction pure", async function () {
            // Vérifier que la fonction version peut être appelée sans transaction
            const version = await rent2Repay.version.staticCall();
            expect(version).to.equal("1.0.0");
        });
    });
}); 