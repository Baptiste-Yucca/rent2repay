const { ethers, upgrades } = require("hardhat");
const config = require("../config-gnosis.js");
const fs = require("fs");
const axios = require("axios"); // Ajout de axios pour l'upload de l'ABI

async function main() {
    // 🔍 VÉRIFICATION PRÉVENTIVE DES VARIABLES TENDERLY
    // Supprimer toute la logique d'upload ABI
    // Supprimer les variables Tenderly inutiles
    // Garder seulement le déploiement et les logs de base

    // SUPPRIMER :
    // - La fonction uploadABIToTenderly()
    // - La vérification des variables Tenderly
    // - L'upload automatique de l'ABI
    // - Les logs de debug Tenderly API
    // - Les liens "Contract" et "Transactions" inexploitables

    // GARDER :
    // - Le déploiement UUPS
    // - Les vérifications de rôles
    // - Les liens Dashboard et Explorer
    // - La sauvegarde des infos de déploiement

    console.log("🚀 Déploiement Rent2Repay sur fork Tenderly de Gnosis");
    console.log("=".repeat(60));

    // 1. Vérification de la config
    const required = [
        'RMM_ADDRESS', 'WXDAI_TOKEN', 'USDC_TOKEN',
        'WXDAI_SUPPLY_TOKEN', 'USDC_SUPPLY_TOKEN',
        'ADMIN_ADDRESS', 'EMERGENCY_ADDRESS', 'OPERATOR_ADDRESS', 'DAO_TREASURY_ADDRESS'
    ];

    let missing = false;
    for (const key of required) {
        if (!config[key] || config[key].includes('ADDRESS_TO_FILL')) {
            console.error(`❌ ${key} non configuré`);
            missing = true;
        } else {
            console.log(`✅ ${key}: ${config[key]} `);
        }
    }
    if (missing) process.exit(1);

    // 2. Signer & réseau
    const [deployer] = await ethers.getSigners();
    console.log(`👤 Déployeur: ${deployer.address} `);
    const bal = await deployer.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(bal)} XDAI`);

    const net = await deployer.provider.getNetwork();
    console.log("🔍 Configuration réseau:");
    console.log(`   🌐 Réseau: ${net.name}`);
    console.log(`   🌐 RPC URL: ${net.url}`);
    console.log(`   🆔 Chain ID: ${net.chainId}`);
    console.log("   💡 Note: TENDERLY_RPC_URL est pour la connexion, TENDERLY_PROJECT_ID pour l'API");
    // Autoriser également les forks locaux (hardhat)
    if (net.chainId !== config.CHAIN_ID && net.name !== 'hardhat') {
        console.warn("⚠️  ChainId mismatch: attention au réseau utilisé !");
    }

    // 3. Déployer via proxy UUPS (initializer appelé automatiquement)
    console.log("\n🏗️ Déploiement proxy UUPS avec initialize automatique");
    const Factory = await ethers.getContractFactory("Rent2Repay");
    const rent2Repay = await upgrades.deployProxy(
        Factory,
        [
            config.ADMIN_ADDRESS,
            config.EMERGENCY_ADDRESS,
            config.OPERATOR_ADDRESS,
            config.RMM_ADDRESS,
            config.WXDAI_TOKEN,
            config.WXDAI_SUPPLY_TOKEN,
            config.USDC_TOKEN,
            config.USDC_SUPPLY_TOKEN
        ],
        { initializer: 'initialize', kind: 'uups' }
    );
    // Pas besoin de .deployed() avec @openzeppelin/hardhat-upgrades
    const address = await rent2Repay.getAddress();
    console.log(`✅ Proxy déployé à: ${address} `);

    // 4. Configurer les setters
    console.log("\n⚙️ Configuration des paramètres post-initialization");
    const tx1 = await rent2Repay.updateDaoTreasuryAddress(config.DAO_TREASURY_ADDRESS);
    await tx1.wait();
    console.log("✔ Treasury address mise à jour");

    if (config.DAO_FEE_REDUCTION_TOKEN && !config.DAO_FEE_REDUCTION_TOKEN.includes('0000')) {
        const tx2 = await rent2Repay.updateDaoFeeReductionToken(config.DAO_FEE_REDUCTION_TOKEN);
        await tx2.wait();
        console.log("✔ Fee reduction token configuré");
    }

    // 5. Vérifications
    console.log("\n🔍 Vérification des rôles et adresses");
    console.log(`RMM: ${await rent2Repay.rmm()} `);
    console.log(`Admin role: ${await rent2Repay.hasRole(await rent2Repay.ADMIN_ROLE(), config.ADMIN_ADDRESS)} `);
    console.log(`Emergency role: ${await rent2Repay.hasRole(await rent2Repay.EMERGENCY_ROLE(), config.EMERGENCY_ADDRESS)} `);
    console.log(`Operator role: ${await rent2Repay.hasRole(await rent2Repay.OPERATOR_ROLE(), config.OPERATOR_ADDRESS)} `);

    // 6. Sauvegarde des infos
    const info = {
        network: net.name,
        chainId: net.chainId.toString(), // ← Convertir BigInt
        deployer: deployer.address,
        rent2Repay: address,
        // Filtrer les valeurs BigInt
        ...Object.fromEntries(
            Object.entries(config).map(([key, value]) => [
                key,
                typeof value === 'bigint' ? value.toString() : value
            ])
        ),
        deployedAt: new Date().toISOString()
    };
    fs.mkdirSync("scripts/tmp", { recursive: true });
    // Nom de fichier dynamique selon le réseau
    const fileName = net.name === 'tenderly' ? 'deployed-tenderly.json' : 'deployed-gnosis.json';
    fs.writeFileSync(`scripts/tmp/${fileName}`, JSON.stringify(info, null, 2));

    console.log(`📄 Infos déploiement sauvegardées dans scripts/tmp/${fileName}`);
    // 7. Résumé final avec liens contextuels
    console.log("\n" + "=".repeat(60));
    console.log("�� DÉPLOIEMENT TERMINÉ!");
    console.log("=".repeat(60));
    console.log(`🏗️ Contrat: ${address}`);
    console.log(` Réseau: ${net.name} (Chain ID: ${net.chainId})`);
    console.log(`👤 Déployeur: ${deployer.address}`);

    // Liens simplifiés
    if (net.name === 'tenderly') {
        console.log("\n🔗 Liens Tenderly:");
        console.log(`   🧪 Dashboard: https://dashboard.tenderly.co/battistu/rent2repay/infrastructure`);
    } else if (net.name === 'gnosis') {
        console.log("\n�� Liens Gnosis Chain:");
        console.log(`   �� Explorer: https://gnosisscan.io/address/${address}`);
        console.log(`   �� Tenderly: https://dashboard.tenderly.co/battistu/rent2repay/infrastructure`);
    }

    console.log("=".repeat(60));
}

main().catch(e => { console.error(e); process.exit(1); });