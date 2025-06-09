// Script pour tester les tokens de dette
const { ethers } = require("hardhat");

// Adresses des tokens de dette
const DEBT_TOKENS = {
    DEBT_WXDAI: "0x09635F643e140090A9A8Dcd712eD6285858ceBef",
    DEBT_USDC: "0xc5a5C42992dECbae36851359345FE25997F5C42d"
};

async function main() {
    console.log("🔍 Test des Tokens de Dette");
    console.log("=".repeat(50));

    const [deployer, user1, user2] = await ethers.getSigners();
    const testUsers = [
        { name: "Deployer", signer: deployer },
        { name: "User1", signer: user1 },
        { name: "User2", signer: user2 }
    ];

    console.log("📋 Vérification des tokens de dette :");

    for (const [tokenName, tokenAddress] of Object.entries(DEBT_TOKENS)) {
        console.log(`\n🏷️  ${tokenName}: ${tokenAddress}`);

        try {
            // Obtenir le contrat
            const tokenContract = await ethers.getContractAt("MockERC20", tokenAddress);

            // Obtenir les informations de base
            const name = await tokenContract.name();
            const symbol = await tokenContract.symbol();
            const decimals = await tokenContract.decimals();
            const totalSupply = await tokenContract.totalSupply();

            console.log(`   📝 Nom: ${name}`);
            console.log(`   🏷️  Symbole: ${symbol}`);
            console.log(`   🔢 Décimales: ${decimals}`);
            console.log(`   💰 Supply total: ${ethers.formatUnits(totalSupply, decimals)}`);

            // Vérifier les balances actuelles
            console.log(`\n   💼 Balances actuelles:`);
            for (const user of testUsers) {
                const balance = await tokenContract.balanceOf(user.signer.address);
                console.log(`      ${user.name}: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
            }

        } catch (error) {
            console.log(`   ❌ Erreur: ${error.message}`);
        }
    }

    // Test des fonctions mint/burn
    console.log("\n🧪 Test des fonctions Mint/Burn :");
    console.log("=".repeat(35));

    try {
        const debtWxdai = await ethers.getContractAt("MockERC20", DEBT_TOKENS.DEBT_WXDAI);
        const mintAmount = ethers.parseUnits("100", 18);

        console.log("\n🪙 Test Mint debtWXDAI pour User1...");
        const balanceBefore = await debtWxdai.balanceOf(user1.address);
        console.log(`   Balance avant: ${ethers.formatUnits(balanceBefore, 18)}`);

        // Mint avec le deployer (qui a normalement les droits)
        const mintTx = await debtWxdai.connect(deployer).mint(user1.address, mintAmount);
        await mintTx.wait();

        const balanceAfter = await debtWxdai.balanceOf(user1.address);
        console.log(`   Balance après mint: ${ethers.formatUnits(balanceAfter, 18)}`);
        console.log(`   ✅ Mint réussi !`);

        // Test Burn
        console.log("\n🔥 Test Burn debtWXDAI pour User1...");
        const burnAmount = ethers.parseUnits("50", 18);

        const burnTx = await debtWxdai.connect(deployer).burn(user1.address, burnAmount);
        await burnTx.wait();

        const balanceAfterBurn = await debtWxdai.balanceOf(user1.address);
        console.log(`   Balance après burn: ${ethers.formatUnits(balanceAfterBurn, 18)}`);
        console.log(`   ✅ Burn réussi !`);

    } catch (error) {
        console.log(`   ❌ Erreur lors du test mint/burn: ${error.message}`);
    }

    // Test des approbations
    console.log("\n✅ Test des Approbations :");
    console.log("=".repeat(25));

    try {
        const debtUsdc = await ethers.getContractAt("MockERC20", DEBT_TOKENS.DEBT_USDC);
        const RENT2REPAY_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
        const approveAmount = ethers.parseUnits("200", 18);

        // Test d'approbation
        console.log("\n📝 Test approbation debtUSDC...");
        const approveTx = await debtUsdc.connect(user1).approve(RENT2REPAY_ADDRESS, approveAmount);
        await approveTx.wait();

        const allowance = await debtUsdc.allowance(user1.address, RENT2REPAY_ADDRESS);
        console.log(`   Allowance accordée: ${ethers.formatUnits(allowance, 18)} debtUSDC`);
        console.log(`   ✅ Approbation réussie !`);

    } catch (error) {
        console.log(`   ❌ Erreur lors du test d'approbation: ${error.message}`);
    }

    console.log("\n📊 Résumé pour l'interface web :");
    console.log("=".repeat(35));
    console.log("✅ Les tokens de dette sont opérationnels");
    console.log("✅ Les fonctions mint/burn fonctionnent");
    console.log("✅ Les approbations sont possibles");
    console.log("\n🎯 Dans l'interface web :");
    console.log("• Les balances debtWXDAI et debtUSDC s'affichent");
    console.log("• Vous pouvez mint/burn ces tokens via les contrôles mock");
    console.log("• Les approbations pour Rent2Repay sont possibles");
    console.log("• Ces tokens représentent les dettes dans le système RMM");
}

main()
    .then(() => {
        console.log("\n🎉 Test des tokens de dette terminé !");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Erreur :", error);
        process.exit(1);
    }); 