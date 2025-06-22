const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Rent2Repay", function () {
    let Rent2Repay, MockToken, MockDebt, MockRMM;
    let rent2Repay, mockToken, mockDebt, mockRMM;
    let deployer, admin, emergency, operator, user, runner;
    let daoFeesBPS, senderTipsBPS;

    // Configuration de test
    const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
    const MAX_AMOUNT = ethers.parseEther("1000");
    const REPAY_AMOUNT = ethers.parseEther("100");
    const DEBT_AMOUNT = ethers.parseEther("500");

    /**
     * Configure un utilisateur pour un token spécifique
     * @param {string} userAddress - Adresse de l'utilisateur
     * @param {string} tokenAddress - Adresse du token
     * @param {bigint} maxAmount - Montant maximum autorisé
     * @param {number} periodicity - Périodicité en secondes (optionnel, défaut: semaine)
     */
    async function configureUserForToken(userAddress, tokenAddress, maxAmount, periodicity = WEEK_IN_SECONDS) {
        await rent2Repay.connect(ethers.provider.getSigner(userAddress)).configureRent2Repay(
            [tokenAddress],
            [maxAmount],
            periodicity
        );
    }

    beforeEach(async function () {
        // Récupération des signers
        [deployer, admin, emergency, operator, user, runner] = await ethers.getSigners();

        // Déploiement des contrats mock
        MockToken = await ethers.getContractFactory("MockToken");
        MockDebt = await ethers.getContractFactory("MockDebt");
        MockRMM = await ethers.getContractFactory("MockRMM");
        Rent2Repay = await ethers.getContractFactory("Rent2Repay");

        mockToken = await MockToken.deploy("Mock Token", "MTK");
        mockDebt = await MockDebt.deploy("Mock Debt", "MDBT");
        mockRMM = await MockRMM.deploy();

        // Déploiement du contrat Rent2Repay
        rent2Repay = await Rent2Repay.deploy(
            admin.address,
            emergency.address,
            operator.address,
            mockRMM.address,
            mockToken.address,
            mockDebt.address,
            mockToken.address, // USDC mock (même token pour simplifier)
            mockDebt.address   // USDC debt mock
        );

        // Mint des tokens pour l'utilisateur
        await mockToken.mint(user.address, ethers.parseEther("10000"));
        await mockDebt.mint(user.address, DEBT_AMOUNT);

        // Configuration de la dette dans le mock RMM
        await mockRMM.setDebt(user.address, mockToken.address, DEBT_AMOUNT);

        // Récupération des frais par défaut
        const feeConfig = await rent2Repay.getFeeConfiguration();
        daoFeesBPS = feeConfig[0];
        senderTipsBPS = feeConfig[1];
    });

    describe("Configuration de base", function () {
        it("Devrait déployer avec les bonnes adresses", async function () {
            expect(await rent2Repay.rmm()).to.equal(mockRMM.address);

            const tokenPairs = await rent2Repay.getAuthorizedTokenPairs();
            expect(tokenPairs.length).to.equal(2);
            expect(tokenPairs[0].token).to.equal(mockToken.address);
            expect(tokenPairs[0].debtToken).to.equal(mockDebt.address);
        });

        it("Devrait avoir les rôles corrects", async function () {
            const adminRole = await rent2Repay.ADMIN_ROLE();
            const emergencyRole = await rent2Repay.EMERGENCY_ROLE();
            const operatorRole = await rent2Repay.OPERATOR_ROLE();

            expect(await rent2Repay.hasRole(adminRole, admin.address)).to.be.true;
            expect(await rent2Repay.hasRole(emergencyRole, emergency.address)).to.be.true;
            expect(await rent2Repay.hasRole(operatorRole, operator.address)).to.be.true;
        });
    });

    describe("Configuration utilisateur", function () {
        it("Devrait permettre à un utilisateur de configurer Rent2Repay", async function () {
            await expect(
                configureUserForToken(user.address, mockToken.address, MAX_AMOUNT)
            ).to.emit(rent2Repay, "Rent2RepayConfigured")
                .withArgs(user.address, [mockToken.address], [MAX_AMOUNT], WEEK_IN_SECONDS);

            expect(await rent2Repay.allowedMaxAmounts(user.address, mockToken.address)).to.equal(MAX_AMOUNT);
            expect(await rent2Repay.isAuthorizedForToken(user.address, mockToken.address)).to.be.true;
        });
    });

    describe("Remboursement automatique", function () {
        beforeEach(async function () {
            // Configuration de l'utilisateur
            await configureUserForToken(user.address, mockToken.address, MAX_AMOUNT);

            // Approbation des tokens pour le contrat
            await mockToken.connect(user).approve(rent2Repay.address, REPAY_AMOUNT);
        });

        it("Devrait exécuter un remboursement et émettre les événements corrects", async function () {
            // Calcul des frais attendus
            const daoFees = (REPAY_AMOUNT * daoFeesBPS) / 10000n;
            const senderTips = (REPAY_AMOUNT * senderTipsBPS) / 10000n;
            const amountForRepayment = REPAY_AMOUNT - daoFees - senderTips;

            // Exécution du remboursement
            await expect(
                rent2Repay.connect(runner).rent2repay(user.address, mockToken.address, REPAY_AMOUNT)
            ).to.emit(rent2Repay, "RepaymentExecuted")
                .withArgs(user.address, mockToken.address, amountForRepayment, MAX_AMOUNT, runner.address)
                .and.to.emit(rent2Repay, "FeesCollected")
                .withArgs(user.address, mockToken.address, daoFees, senderTips, runner.address);
        });

        it("Devrait mettre à jour le timestamp de dernier remboursement", async function () {
            const beforeTimestamp = await rent2Repay.lastRepayTimestamps(user.address);

            await rent2Repay.connect(runner).rent2repay(user.address, mockToken.address, REPAY_AMOUNT);

            const afterTimestamp = await rent2Repay.lastRepayTimestamps(user.address);
            expect(afterTimestamp).to.be.gt(beforeTimestamp);
        });

        it("Ne devrait pas permettre un remboursement dans la même période", async function () {
            await rent2Repay.connect(runner).rent2repay(user.address, mockToken.address, REPAY_AMOUNT);

            await expect(
                rent2Repay.connect(runner).rent2repay(user.address, mockToken.address, REPAY_AMOUNT)
            ).to.be.revertedWith("wait next period");
        });
    });

    describe("Gestion des erreurs", function () {
        it("Ne devrait pas permettre un remboursement sans configuration", async function () {
            await mockToken.connect(user).approve(rent2Repay.address, REPAY_AMOUNT);

            await expect(
                rent2Repay.connect(runner).rent2repay(user.address, mockToken.address, REPAY_AMOUNT)
            ).to.be.revertedWith("User not configured for token");
        });

        it("Ne devrait pas permettre un remboursement pour soi-même", async function () {
            await configureUserForToken(user.address, mockToken.address, MAX_AMOUNT);
            await mockToken.connect(user).approve(rent2Repay.address, REPAY_AMOUNT);

            await expect(
                rent2Repay.connect(user).rent2repay(user.address, mockToken.address, REPAY_AMOUNT)
            ).to.be.revertedWithCustomError(rent2Repay, "CannotRepayForSelf");
        });

        it("Ne devrait pas permettre un remboursement avec un token non autorisé", async function () {
            const unauthorizedToken = await MockToken.deploy("Unauthorized", "UNAUTH");
            await configureUserForToken(user.address, mockToken.address, MAX_AMOUNT);
            await mockToken.connect(user).approve(rent2Repay.address, REPAY_AMOUNT);

            await expect(
                rent2Repay.connect(runner).rent2repay(user.address, unauthorizedToken.address, REPAY_AMOUNT)
            ).to.be.revertedWithCustomError(rent2Repay, "TokenNotAuthorized");
        });
    });
}); 