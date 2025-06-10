#!/usr/bin/env node
// Script de vérification des balances et approbations
// Usage: node check-script.js <adresse>

const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

// Charger la config
function loadConfig() {
    // Essayer d'abord contract-addresses.json (plus simple et fiable)
    const jsonConfigPath = path.join(__dirname, 'contract-addresses.json');
    if (fs.existsSync(jsonConfigPath)) {
        const jsonContent = fs.readFileSync(jsonConfigPath, 'utf8');
        const config = JSON.parse(jsonContent);
        console.log('📋 Configuration chargée depuis contract-addresses.json');
        return config;
    }

    // Fallback: parser config.js (méthode ancienne)
    console.log('⚠️  contract-addresses.json introuvable, tentative avec config.js...');
    const configPath = path.join(__dirname, 'config.js');

    if (!fs.existsSync(configPath)) {
        console.log('❌ Aucun fichier de configuration trouvé');
        console.log('💡 Lancez d\'abord: node deploy-complete-auto.js');
        process.exit(1);
    }

    const configContent = fs.readFileSync(configPath, 'utf8');

    // Extraire les adresses des contrats
    const rentMatch = configContent.match(/RENT2REPAY: "([^"]+)"/);
    const wxdaiMatch = configContent.match(/WXDAI: "([^"]+)"/);
    const usdcMatch = configContent.match(/USDC: "([^"]+)"/);
    const debtWxdaiMatch = configContent.match(/DEBT_WXDAI: "([^"]+)"/);
    const debtUsdcMatch = configContent.match(/DEBT_USDC: "([^"]+)"/);

    return {
        RENT2REPAY: rentMatch ? rentMatch[1] : '',
        WXDAI: wxdaiMatch ? wxdaiMatch[1] : '',
        USDC: usdcMatch ? usdcMatch[1] : '',
        DEBT_WXDAI: debtWxdaiMatch ? debtWxdaiMatch[1] : '',
        DEBT_USDC: debtUsdcMatch ? debtUsdcMatch[1] : ''
    };
}

// Tokens à vérifier
const TOKENS = [
    { ticker: 'ETH', address: null },  // ETH natif
    { ticker: 'WXDAI', configKey: 'WXDAI' },
    { ticker: 'USDC', configKey: 'USDC' },
    { ticker: 'debtWXDAI', configKey: 'DEBT_WXDAI' },
    { ticker: 'debtUSDC', configKey: 'DEBT_USDC' }
];

// ABI minimal
const TOKEN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function symbol() view returns (string)"
];

function formatAmount(amount, decimals = 18) {
    const formatted = ethers.formatUnits(amount, decimals);
    return parseFloat(formatted).toFixed(2);
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length !== 1) {
        console.log("❌ Usage: node check-script.js <adresse>");
        console.log("   Exemple: node check-script.js 0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
        process.exit(1);
    }

    const walletAddress = args[0];

    if (!ethers.isAddress(walletAddress)) {
        console.log("❌ Adresse invalide");
        process.exit(1);
    }

    try {
        console.log("🔍 VÉRIFICATION WALLET");
        console.log("=".repeat(80));
        console.log(`Wallet: ${walletAddress}`);
        console.log("");

        // Se connecter au réseau
        const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        const config = loadConfig();

        // En-tête du tableau
        console.log("┌─────────────┬──────────────┬──────────────┬─────────────────────────────────────────────┐");
        console.log("│ Token       │ Balance      │ Approval     │ Adresse Locale                              │");
        console.log("├─────────────┼──────────────┼──────────────┼─────────────────────────────────────────────┤");

        for (const token of TOKENS) {
            try {
                let balance = "0.00";
                let approval = "N/A";
                let address = "N/A";

                if (token.ticker === 'ETH') {
                    // ETH natif
                    const ethBalance = await provider.getBalance(walletAddress);
                    balance = formatAmount(ethBalance);
                    address = "Natif";
                } else {
                    // Token ERC20
                    address = config[token.configKey];

                    if (address && address !== 'undefined' && address !== '') {
                        const tokenContract = new ethers.Contract(address, TOKEN_ABI, provider);

                        // Test de connexion au contrat
                        try {
                            // Balance
                            const bal = await tokenContract.balanceOf(walletAddress);
                            balance = formatAmount(bal);

                            // Approbation pour Rent2Repay
                            if (config.RENT2REPAY && config.RENT2REPAY !== 'undefined') {
                                const allowance = await tokenContract.allowance(walletAddress, config.RENT2REPAY);
                                approval = formatAmount(allowance);
                            }
                        } catch (contractError) {
                            throw contractError;
                        }
                    } else {
                        throw new Error("Adresse manquante");
                    }
                }

                // Formater les colonnes
                const tokenCol = token.ticker.padEnd(11);
                const balanceCol = balance.padStart(12);
                const approvalCol = approval.padStart(12);
                const addressCol = address.length > 43 ? address.substring(0, 40) + "..." : address.padEnd(43);

                console.log(`│ ${tokenCol} │ ${balanceCol} │ ${approvalCol} │ ${addressCol} │`);

            } catch (error) {
                // En cas d'erreur pour un token spécifique
                const tokenCol = token.ticker.padEnd(11);
                const errorCol = "ERROR".padStart(12);
                const naCol = "N/A".padStart(12);
                const addressCol = "Contrat introuvable".padEnd(43);

                console.log(`│ ${tokenCol} │ ${errorCol} │ ${naCol} │ ${addressCol} │`);
            }
        }

        console.log("└─────────────┴──────────────┴──────────────┴─────────────────────────────────────────────┘");
        console.log("");
        console.log("💡 Balance = montant possédé");
        console.log("💡 Approval = montant autorisé pour Rent2Repay");
        console.log("");

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