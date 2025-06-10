// Test rapide pour vérifier que l'interface peut se connecter aux contrats
const { ethers } = require("hardhat");
const fs = require('fs');

// Charger la config (similaire à l'interface web)
function loadWebConfig() {
    const configContent = fs.readFileSync('config.js', 'utf8');

    // Extraire les adresses des contrats (parse basique)
    const rentMatch = configContent.match(/RENT2REPAY: "([^"]+)"/);
    const wxdaiMatch = configContent.match(/WXDAI: "([^"]+)"/);
    const usdcMatch = configContent.match(/USDC: "([^"]+)"/);
    const debtWxdaiMatch = configContent.match(/DEBT_WXDAI: "([^"]+)"/);
    const debtUsdcMatch = configContent.match(/DEBT_USDC: "([^"]+)"/);

    return {
        RENT2REPAY: rentMatch ? rentMatch[1] : null,
        WXDAI: wxdaiMatch ? wxdaiMatch[1] : null,
        USDC: usdcMatch ? usdcMatch[1] : null,
        DEBT_WXDAI: debtWxdaiMatch ? debtWxdaiMatch[1] : null,
        DEBT_USDC: debtUsdcMatch ? debtUsdcMatch[1] : null
    };
}

async function main() {
    console.log("🔍 TEST INTERFACE WEB - CONNECTIVITÉ AUX CONTRATS");
    console.log("=".repeat(55));

    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const config = loadWebConfig();

    console.log("📋 Configuration chargée depuis config.js:");
    console.log(`   RENT2REPAY: ${config.RENT2REPAY}`);
    console.log(`   WXDAI: ${config.WXDAI}`);
    console.log(`   USDC: ${config.USDC}`);

    // ABI minimal pour les tests
    const erc20ABI = [
        "function symbol() view returns (string)",
        "function name() view returns (string)",
        "function balanceOf(address owner) view returns (uint256)"
    ];

    const rent2repayABI = [
        "function getAuthorizedTokens() view returns (address[])"
    ];

    try {
        // Test WXDAI
        console.log("\n🧪 Test connexion WXDAI...");
        const wxdai = new ethers.Contract(config.WXDAI, erc20ABI, provider);
        const wxdaiSymbol = await wxdai.symbol();
        const wxdaiName = await wxdai.name();
        console.log(`✅ WXDAI: ${wxdaiName} (${wxdaiSymbol})`);

        // Test USDC
        console.log("\n🧪 Test connexion USDC...");
        const usdc = new ethers.Contract(config.USDC, erc20ABI, provider);
        const usdcSymbol = await usdc.symbol();
        const usdcName = await usdc.name();
        console.log(`✅ USDC: ${usdcName} (${usdcSymbol})`);

        // Test Rent2Repay
        console.log("\n🧪 Test connexion Rent2Repay...");
        const rent2repay = new ethers.Contract(config.RENT2REPAY, rent2repayABI, provider);
        const authorizedTokens = await rent2repay.getAuthorizedTokens();
        console.log(`✅ Rent2Repay: ${authorizedTokens.length} tokens autorisés`);

        // Vérifier que les tokens sont bien autorisés
        const expectedTokens = [config.WXDAI, config.USDC];
        const allAuthorized = expectedTokens.every(token =>
            authorizedTokens.map(addr => addr.toLowerCase()).includes(token.toLowerCase())
        );

        if (allAuthorized) {
            console.log(`✅ Tous les tokens sont correctement autorisés dans Rent2Repay`);
        } else {
            console.log(`⚠️  Certains tokens ne sont pas autorisés`);
        }

        // Test User1
        console.log("\n🧪 Test User1 balance...");
        const user1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
        const wxdaiBalance = await wxdai.balanceOf(user1);
        const usdcBalance = await usdc.balanceOf(user1);
        console.log(`✅ User1 WXDAI: ${ethers.formatUnits(wxdaiBalance, 18)}`);
        console.log(`✅ User1 USDC: ${ethers.formatUnits(usdcBalance, 18)}`);

        console.log("\n🎉 TOUS LES TESTS RÉUSSIS!");
        console.log("L'interface web peut se connecter à tous les contrats");

    } catch (error) {
        console.log(`❌ Erreur: ${error.message}`);
        process.exit(1);
    }
}

main()
    .then(() => {
        console.log("\n✅ Interface web prête à être utilisée!");
        process.exit(0);
    })
    .catch(error => {
        console.error("❌ Erreur:", error);
        process.exit(1);
    }); 