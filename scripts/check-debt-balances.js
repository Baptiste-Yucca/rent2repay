const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔍 Vérification des balances de dette...\n");

    // Charger la configuration déployée
    const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");
    if (!fs.existsSync(configPath)) {
        throw new Error("❌ Fichier de configuration non trouvé. Exécutez d'abord le script de déploiement.");
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Récupérer les signers pour avoir les adresses
    const signers = await ethers.getSigners();
    const userAddress = signers[1].address; // USER est à l'index 1

    // Charger les contrats de dette
    const mockDebtUSDC = await ethers.getContractAt("MockDebtToken", config.contracts.MockDebtUSDC);
    const mockDebtWXDAI = await ethers.getContractAt("MockDebtToken", config.contracts.MockDebtWXDAI);
    const mockUSDC = await ethers.getContractAt("MockERC20", config.contracts.MockUSDC);

    // Vérifier les adresses des contrats
    console.log("📋 Adresses des contrats:");
    console.log(`   MockDebtUSDC: ${await mockDebtUSDC.getAddress()}`);
    console.log(`   MockDebtWXDAI: ${await mockDebtWXDAI.getAddress()}`);
    console.log(`   MockUSDC: ${await mockUSDC.getAddress()}\n`);

    // Vérifier les tokens sous-jacents
    console.log("🔗 Tokens sous-jacents:");
    console.log(`   USDC: ${await mockDebtUSDC.getUnderlyingAsset()}`);
    console.log(`   WXDAI: ${await mockDebtWXDAI.getUnderlyingAsset()}\n`);

    // Vérifier les balances initiales
    console.log("💰 Balances de dette initiales pour", userAddress);
    const initialDebtUSDCBalance = await mockDebtUSDC.balanceOf(userAddress);
    const initialDebtWXDAIBalance = await mockDebtWXDAI.balanceOf(userAddress);

    console.log(`   Dette USDC: ${ethers.formatEther(initialDebtUSDCBalance)} armmv3USDC`);
    console.log(`   Dette WXDAI: ${ethers.formatEther(initialDebtWXDAIBalance)} armmv3WXDAI\n`);

    // Mint des tokens de dette
    console.log("🏦 Mint de 100 tokens de dette de chaque type...");
    const mintAmount = ethers.parseEther("100");

    await mockDebtUSDC.mint(userAddress, mintAmount);
    console.log("   ✅ Dette USDC mintée");

    await mockDebtWXDAI.mint(userAddress, mintAmount);
    console.log("   ✅ Dette WXDAI mintée\n");

    // Vérifier les nouvelles balances
    console.log("💰 Nouvelles balances de dette pour", userAddress);
    const newDebtUSDCBalance = await mockDebtUSDC.balanceOf(userAddress);
    const newDebtWXDAIBalance = await mockDebtWXDAI.balanceOf(userAddress);

    console.log(`   Dette USDC: ${ethers.formatEther(newDebtUSDCBalance)} armmv3USDC`);
    console.log(`   Dette WXDAI: ${ethers.formatEther(newDebtWXDAIBalance)} armmv3WXDAI\n`);

    // Mint des USDC à l'utilisateur pour le remboursement
    console.log("💰 Mint de USDC à l'utilisateur pour le remboursement...");
    await mockUSDC.mint(userAddress, 10000000); // 10 USDC (6 decimals)
    const usdcBalance = await mockUSDC.balanceOf(userAddress);
    console.log(`   ✅ Balance USDC de l'utilisateur: ${usdcBalance} (6 decimals)\n`);

    // Configurer Rent2Repay pour l'utilisateur
    console.log("🔧 Configuration de Rent2Repay pour l'utilisateur...");
    const rent2Repay = await ethers.getContractAt("Rent2Repay", config.contracts.Rent2Repay);

    // Configurer une limite hebdomadaire de 100 USDC
    const weeklyLimit = BigInt(10_000_000);
    const periodicity = 1; // 10 secondes pour le test
    console.log("   👉 Configuration de la limite hebdomadaire...");

    let [maxAmount, lastRepay] = await rent2Repay.getUserConfigForToken(signers[1], config.contracts.MockUSDC);
    console.log('Max set: ', maxAmount);

    await rent2Repay.revokeRent2RepayForToken(config.contracts.MockUSDC);

    try {
        await rent2Repay.connect(signers[1]).configureRent2Repay(
            [config.contracts.MockUSDC], // tokens
            [weeklyLimit],               // montants
            periodicity                  // périodicité en secondes
        );
        console.log("   ✅ Configuration Rent2Repay réussie!");
    } catch (error) {
        console.log("   ❌ Erreur lors de la configuration:", error.message);
        return;
    }

    [maxAmount, lastRepay] = await rent2Repay.getUserConfigForToken(signers[1], config.contracts.MockUSDC);
    console.log('Max set: ', maxAmount);

    // Approuver le contrat Rent2Repay pour 52 fois le montant configuré (USDC avec 6 décimales)
    console.log("   👉 Approbation du contrat Rent2Repay pour 52x le montant configuré...");
    const approveAmount = BigInt(weeklyLimit) * BigInt(52); // 52 fois le montant configuré
    await mockUSDC.connect(signers[1]).approve(await rent2Repay.getAddress(), approveAmount);
    console.log(`   ✅ Approbation de ${approveAmount} USDC  au contrat Rent2Repay`);

    await new Promise(resolve => setTimeout(resolve, periodicity * 1000));


    // Effectuer un remboursement via RUNNER_1
    console.log("\n🔄 Test de remboursement avec RUNNER_1...");
    const runner1 = signers[2]; // RUNNER_1 à l'index 2

    // Montant à rembourser
    const repayAmount = ethers.parseEther("10");

    // L'approbation a déjà été faite plus haut pour 52x le montant configuré
    console.log("   👉 Utilisation de l'approbation déjà accordée...");

    try {
        console.log("   👉 Tentative de remboursement de 10 USDC...");

        // Vérifications préalables
        console.log("   📋 Vérifications des conditions:");

        // 1. Vérifier si l'utilisateur est autorisé
        const isAuthorized = await rent2Repay.isAuthorizedForToken(userAddress, config.contracts.MockUSDC);
        console.log(`      - Autorisation pour le token: ${isAuthorized ? '✅' : '❌'}`);

        // 2. Vérifier la périodicité
        const lastRepayTimestamp = (await rent2Repay.lastRepayTimestamps(userAddress)).toString();
        console.log(`      - Dernier remboursement: ${lastRepayTimestamp === '0' ? 'Jamais' : new Date(lastRepayTimestamp * 1000).toLocaleString()}`);

        // 3. Vérifier la dette
        const debtToken = await rent2Repay.getDebtToken(config.contracts.MockUSDC);
        const debtBalance = await mockDebtUSDC.balanceOf(userAddress);
        console.log(`      - Dette actuelle: ${ethers.formatEther(debtBalance)} USDC`);

        // 4. Vérifier l'allowance
        const allowance = await mockUSDC.allowance(userAddress, await rent2Repay.getAddress());
        console.log(`      - Allowance USDC: ${ethers.formatEther(allowance)}`);

        // Tentative de remboursement
        const tx = await rent2Repay.connect(runner1).rent2repay(
            userAddress.toLowerCase(),           // adresse de l'utilisateur (index 1)
            "0x5FbDB2315678afecb367f032d93F642f64180aa3".toLowerCase(), //config.contracts.MockUSDC.toLowerCase(),  // adresse du token USDC
        );
        await tx.wait();
        console.log("   ✅ Remboursement effectué avec succès!");

        // Vérifier la nouvelle balance de dette après remboursement
        const finalDebtUSDCBalance = await mockDebtUSDC.balanceOf(userAddress);
        console.log(`   💰 Nouvelle dette USDC après remboursement: ${ethers.formatEther(finalDebtUSDCBalance)} armmv3USDC`);
    } catch (error) {
        console.log("   ❌ Erreur lors du remboursement:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }); 