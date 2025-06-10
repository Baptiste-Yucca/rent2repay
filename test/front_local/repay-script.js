#!/usr/bin/env node
// Script de remboursement via rent2repay()
// Usage: node repay-script.js <montant> <sender_address> <target_address>

const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

// Charger la config
function loadConfig() {
    const configPath = path.join(__dirname, 'config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');

    // Extraire les adresses des contrats
    const rentMatch = configContent.match(/RENT2REPAY: "([^"]+)"/);
    const wxdaiMatch = configContent.match(/WXDAI: "([^"]+)"/);
    const usdcMatch = configContent.match(/USDC: "([^"]+)"/);

    return {
        RENT2REPAY: rentMatch ? rentMatch[1] : '',
        WXDAI: wxdaiMatch ? wxdaiMatch[1] : '',
        USDC: usdcMatch ? usdcMatch[1] : ''
    };
}

// Mapping des adresses vers les clés privées connues
const KNOWN_WALLETS = {
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Deployer
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // User1
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // User2
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906": "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // User3
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65": "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"  // User4
};

// ABI des contrats
const RENT2REPAY_ABI = [
    "function rent2repay(address user, address token, uint256 amount) returns (bool)",
    "function getAvailableAmountThisWeek(address user, address token) view returns (uint256)"
];

const TOKEN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function symbol() view returns (string)"
];

function formatAmount(amount, decimals = 18) {
    const formatted = ethers.formatUnits(amount, decimals);
    return parseFloat(formatted).toFixed(2);
}

async function checkAndApprove(tokenContract, senderAddress, spenderAddress, amount, tokenSymbol) {
    console.log(`🔍 Vérification approbation ${tokenSymbol}...`);

    const allowance = await tokenContract.allowance(senderAddress, spenderAddress);
    console.log(`   Allowance actuelle: ${formatAmount(allowance)} ${tokenSymbol}`);

    if (allowance < amount) {
        console.log(`⚠️  Allowance insuffisante, approbation de ${formatAmount(amount)} ${tokenSymbol}...`);
        const approveTx = await tokenContract.approve(spenderAddress, amount);
        console.log(`📤 Approbation envoyée: ${approveTx.hash}`);
        await approveTx.wait();
        console.log(`✅ Approbation confirmée`);
    } else {
        console.log(`✅ Allowance suffisante`);
    }
}

async function performRepayment(rent2repayContract, tokenContract, senderAddress, targetAddress, amount, tokenSymbol) {
    console.log(`\n💰 Remboursement ${formatAmount(amount)} ${tokenSymbol}`);
    console.log(`   De: ${senderAddress}`);
    console.log(`   Pour: ${targetAddress}`);

    try {
        // Vérifier la disponibilité
        const available = await rent2repayContract.getAvailableAmountThisWeek(targetAddress, await tokenContract.getAddress());
        console.log(`   Disponible cette semaine: ${formatAmount(available)} ${tokenSymbol}`);

        if (available < amount) {
            console.log(`❌ Montant demandé (${formatAmount(amount)}) > disponible (${formatAmount(available)})`);
            return false;
        }

        // Effectuer le remboursement
        const tx = await rent2repayContract.rent2repay(targetAddress, await tokenContract.getAddress(), amount);
        console.log(`📤 Transaction envoyée: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Remboursement réussi !`);
        return true;

    } catch (error) {
        console.log(`❌ Erreur remboursement ${tokenSymbol}: ${error.message}`);
        return false;
    }
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length !== 3) {
        console.log("❌ Usage: node repay-script.js <montant> <sender_address> <target_address>");
        console.log("   Exemple: node repay-script.js 50 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
        console.log("");
        console.log("🔑 Wallets disponibles:");
        Object.keys(KNOWN_WALLETS).forEach((addr, i) => {
            const labels = ["Deployer/Admin", "User1", "User2", "User3", "User4"];
            console.log(`   ${addr} (${labels[i]})`);
        });
        process.exit(1);
    }

    const [montantStr, senderAddress, targetAddress] = args;
    const montant = parseFloat(montantStr);

    // Validation
    if (isNaN(montant) || montant <= 0) {
        console.log("❌ Montant invalide");
        process.exit(1);
    }

    if (!ethers.isAddress(senderAddress) || !ethers.isAddress(targetAddress)) {
        console.log("❌ Adresse invalide");
        process.exit(1);
    }

    if (!KNOWN_WALLETS[senderAddress]) {
        console.log("❌ Clé privée non disponible pour le sender");
        console.log("Wallets supportés:", Object.keys(KNOWN_WALLETS).join(", "));
        process.exit(1);
    }

    try {
        console.log("💸 SCRIPT DE REMBOURSEMENT");
        console.log("=".repeat(50));
        console.log(`Montant: ${montant} (WXDAI et USDC)`);
        console.log(`Sender: ${senderAddress}`);
        console.log(`Target: ${targetAddress}`);
        console.log("");

        // Se connecter au réseau
        const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        const senderWallet = new ethers.Wallet(KNOWN_WALLETS[senderAddress], provider);
        const config = loadConfig();

        // Créer les contrats
        const rent2repayContract = new ethers.Contract(config.RENT2REPAY, RENT2REPAY_ABI, senderWallet);
        const wxdaiContract = new ethers.Contract(config.WXDAI, TOKEN_ABI, senderWallet);
        const usdcContract = new ethers.Contract(config.USDC, TOKEN_ABI, senderWallet);

        const amountWei = ethers.parseUnits(montant.toString(), 18);

        // Vérifier les balances du sender
        console.log("🔍 Vérification des balances du sender...");
        const wxdaiBalance = await wxdaiContract.balanceOf(senderAddress);
        const usdcBalance = await usdcContract.balanceOf(senderAddress);
        console.log(`   WXDAI: ${formatAmount(wxdaiBalance)}`);
        console.log(`   USDC: ${formatAmount(usdcBalance)}`);

        if (wxdaiBalance < amountWei) {
            console.log(`❌ Balance WXDAI insuffisante (requis: ${montant}, disponible: ${formatAmount(wxdaiBalance)})`);
        }
        if (usdcBalance < amountWei) {
            console.log(`❌ Balance USDC insuffisante (requis: ${montant}, disponible: ${formatAmount(usdcBalance)})`);
        }

        let successCount = 0;

        // Remboursement WXDAI
        if (wxdaiBalance >= amountWei) {
            console.log("\n" + "=".repeat(30));
            console.log("🟡 REMBOURSEMENT WXDAI");
            console.log("=".repeat(30));

            await checkAndApprove(wxdaiContract, senderAddress, config.RENT2REPAY, amountWei, "WXDAI");
            const success = await performRepayment(rent2repayContract, wxdaiContract, senderAddress, targetAddress, amountWei, "WXDAI");
            if (success) successCount++;
        }

        // Remboursement USDC
        if (usdcBalance >= amountWei) {
            console.log("\n" + "=".repeat(30));
            console.log("🔵 REMBOURSEMENT USDC");
            console.log("=".repeat(30));

            await checkAndApprove(usdcContract, senderAddress, config.RENT2REPAY, amountWei, "USDC");
            const success = await performRepayment(rent2repayContract, usdcContract, senderAddress, targetAddress, amountWei, "USDC");
            if (success) successCount++;
        }

        // Résumé final
        console.log("\n" + "=".repeat(50));
        console.log("📊 RÉSUMÉ FINAL");
        console.log("=".repeat(50));
        console.log(`✅ Remboursements réussis: ${successCount}/2`);
        console.log(`💰 Montant total remboursé: ${successCount * montant} tokens`);

        if (successCount === 2) {
            console.log("🎉 Tous les remboursements ont réussi !");
        } else {
            console.log("⚠️  Certains remboursements ont échoué (voir détails ci-dessus)");
        }

    } catch (error) {
        console.error(`❌ Erreur: ${error.message}`);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Erreur fatale:", error);
        process.exit(1);
    }); 