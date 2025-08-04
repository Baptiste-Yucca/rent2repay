const { ethers } = require("hardhat");
const config = require("../config-gnosis.js");

async function main() {
    console.log("🚀 Déploiement Rent2Repay sur Gnosis Chain via Tenderly");
    console.log("=".repeat(60));

    // Vérification de la configuration
    console.log("📋 Vérification de la configuration...");

    const requiredAddresses = [
        { name: "RMM_ADDRESS", value: config.RMM_ADDRESS },
        { name: "WXDAI_TOKEN", value: config.WXDAI_TOKEN },
        { name: "USDC_TOKEN", value: config.USDC_TOKEN },
        { name: "WXDAI_SUPPLY_TOKEN", value: config.WXDAI_SUPPLY_TOKEN },
        { name: "USDC_SUPPLY_TOKEN", value: config.USDC_SUPPLY_TOKEN },
        { name: "ADMIN_ADDRESS", value: config.ADMIN_ADDRESS },
        { name: "EMERGENCY_ADDRESS", value: config.EMERGENCY_ADDRESS },
        { name: "OPERATOR_ADDRESS", value: config.OPERATOR_ADDRESS },
        { name: "DAO_TREASURY_ADDRESS", value: config.DAO_TREASURY_ADDRESS }
    ];

    let hasError = false;
    for (const addr of requiredAddresses) {
        if (addr.value === "ADDRESS_TO_FILL" || addr.value === "") {
            console.log(`❌ ${addr.name}: Non configuré`);
            hasError = true;
        } else {
            console.log(`✅ ${addr.name}: ${addr.value}`);
        }
    }

    if (hasError) {
        console.log("\n❌ Configuration incomplète!");
        console.log("Veuillez remplir toutes les adresses dans config-gnosis.js");
        process.exit(1);
    }

    console.log("\n✅ Configuration validée!");

    // Récupération des signeurs
    const [deployer] = await ethers.getSigners();
    console.log(`\n👤 Déployeur: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} XDAI`);

    // Vérification du réseau
    const network = await deployer.provider.getNetwork();
    console.log(`\n🌐 Réseau: ${network.name} (Chain ID: ${network.chainId})`);

    if (network.chainId !== config.CHAIN_ID) {
        console.log(`⚠️  Attention: Vous êtes sur le réseau ${network.name} au lieu de Gnosis Chain`);
        console.log("Assurez-vous d'être connecté au bon réseau dans Tenderly");
    }

    // Déploiement du contrat
    console.log("\n🏗️  Déploiement du contrat Rent2Repay...");

    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2Repay = await Rent2Repay.deploy();

    console.log(`📦 Transaction de déploiement: ${rent2Repay.deploymentTransaction().hash}`);

    await rent2Repay.waitForDeployment();
    const rent2RepayAddress = await rent2Repay.getAddress();

    console.log(`✅ Contrat déployé: ${rent2RepayAddress}`);

    // Initialisation du contrat
    console.log("\n⚙️  Initialisation du contrat...");

    const initTx = await rent2Repay.initialize(
        config.ADMIN_ADDRESS,
        config.EMERGENCY_ADDRESS,
        config.OPERATOR_ADDRESS,
        config.RMM_ADDRESS,
        config.WXDAI_TOKEN,
        config.WXDAI_SUPPLY_TOKEN,
        config.USDC_TOKEN,
        config.USDC_SUPPLY_TOKEN
    );

    console.log(`📦 Transaction d'initialisation: ${initTx.hash}`);
    await initTx.wait();

    console.log("✅ Contrat initialisé!");

    // Configuration des fees
    console.log("\n💰 Configuration des fees...");

    const feeTx = await rent2Repay.updateDaoTreasuryAddress(config.DAO_TREASURY_ADDRESS);
    console.log(`📦 Transaction fees: ${feeTx.hash}`);
    await feeTx.wait();

    console.log("✅ Fees configurées!");

    // Configuration du token de réduction (si fourni)
    if (config.DAO_FEE_REDUCTION_TOKEN !== "ADDRESS_TO_FILL" &&
        config.DAO_FEE_REDUCTION_TOKEN !== "0x0000000000000000000000000000000000000000") {
        console.log("\n🎫 Configuration du token de réduction...");

        const reductionTx = await rent2Repay.updateDaoFeeReductionToken(config.DAO_FEE_REDUCTION_TOKEN);
        console.log(`📦 Transaction réduction: ${reductionTx.hash}`);
        await reductionTx.wait();

        console.log("✅ Token de réduction configuré!");
    }

    // Vérifications post-déploiement
    console.log("\n🔍 Vérifications post-déploiement...");

    const rmm = await rent2Repay.rmm();
    const adminRole = await rent2Repay.hasRole(await rent2Repay.ADMIN_ROLE(), config.ADMIN_ADDRESS);
    const emergencyRole = await rent2Repay.hasRole(await rent2Repay.EMERGENCY_ROLE(), config.EMERGENCY_ADDRESS);
    const operatorRole = await rent2Repay.hasRole(await rent2Repay.OPERATOR_ROLE(), config.OPERATOR_ADDRESS);

    console.log(`✅ RMM: ${rmm}`);
    console.log(`✅ Admin role: ${adminRole}`);
    console.log(`✅ Emergency role: ${emergencyRole}`);
    console.log(`✅ Operator role: ${operatorRole}`);

    // Sauvegarde des informations de déploiement
    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId,
        deployer: deployer.address,
        rent2RepayAddress: rent2RepayAddress,
        rmmAddress: config.RMM_ADDRESS,
        adminAddress: config.ADMIN_ADDRESS,
        emergencyAddress: config.EMERGENCY_ADDRESS,
        operatorAddress: config.OPERATOR_ADDRESS,
        daoTreasuryAddress: config.DAO_TREASURY_ADDRESS,
        wxdaiToken: config.WXDAI_TOKEN,
        usdcToken: config.USDC_TOKEN,
        wxdaiSupplyToken: config.WXDAI_SUPPLY_TOKEN,
        usdcSupplyToken: config.USDC_SUPPLY_TOKEN,
        deploymentTime: new Date().toISOString()
    };

    const fs = require("fs");
    fs.writeFileSync(
        "scripts/tmp/deployed-gnosis.json",
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n📄 Informations sauvegardées dans scripts/tmp/deployed-gnosis.json");

    // Résumé final
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DÉPLOIEMENT TERMINÉ!");
    console.log("=".repeat(60));
    console.log(`📍 Contrat: ${rent2RepayAddress}`);
    console.log(`🌐 Réseau: ${network.name} (${network.chainId})`);
    console.log(`👤 Déployeur: ${deployer.address}`);
    console.log(`💰 RMM: ${config.RMM_ADDRESS}`);
    console.log(`🏛️  Admin: ${config.ADMIN_ADDRESS}`);
    console.log(`🚨 Emergency: ${config.EMERGENCY_ADDRESS}`);
    console.log(`⚙️  Operator: ${config.OPERATOR_ADDRESS}`);
    console.log(`💼 Treasury: ${config.DAO_TREASURY_ADDRESS}`);
    console.log("\n🔗 Liens utiles:");
    console.log(`   📊 Explorer: https://gnosisscan.io/address/${rent2RepayAddress}`);
    console.log(`   🧪 Tenderly: https://dashboard.tenderly.co/battistu/rent2repay/infrastructure`);
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Erreur lors du déploiement:", error);
        process.exit(1);
    }); 