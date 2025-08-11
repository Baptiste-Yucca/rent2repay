const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Déploiement Rent2Repay sur Gnosis Mainnet");
    console.log("============================================================");

    // Vérification des variables d'environnement
    if (!process.env.PRIVATE_KEY) {
        throw new Error("❌ PRIVATE_KEY non définie dans .env");
    }

    // Configuration pour Gnosis Mainnet
    const config = {
        RMM_ADDRESS: "0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3",
        WXDAI_TOKEN: "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d",
        USDC_TOKEN: "0xddafbb505ad214d7b80b1f830fccc89b60fb7a83",
        WXDAI_SUPPLY_TOKEN: "0x0cA4f5554Dd9Da6217d62D8df2816c82bba4157b",
        USDC_SUPPLY_TOKEN: "0xeD56F76E9cBC6A64b821e9c016eAFbd3db5436D1",
        ADMIN_ADDRESS: "0xD2f9d86f58E8871c6D97DCc2BF911efB98a4c97C",
        EMERGENCY_ADDRESS: "0x19c13C99C13e648Cc9cF32ab04455Ea66eB6b6f8",
        OPERATOR_ADDRESS: "0x5B3B05566724fD1E6C2941bC1499E9e89ca4E7f2",
        DAO_TREASURY_ADDRESS: "0x87f416a96b2616ad8ecb2183989917d4d540d244"
    };

    // Affichage de la configuration
    console.log("✅ Configuration mainnet:");
    Object.entries(config).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
    });

    // Vérification du déployeur
    const [deployer] = await ethers.getSigners();
    console.log(`\n👤 Déployeur: ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} XDAI`);

    // Vérification du réseau
    const network = await ethers.provider.getNetwork();
    console.log(`🔍 Réseau: Gnosis Mainnet (Chain ID: ${network.chainId})`);

    if (network.chainId !== 100n) {
        throw new Error(`❌ Mauvais réseau! Attendu: 100, Reçu: ${network.chainId}`);
    }

    console.log("\n��️ Déploiement proxy UUPS avec initialize automatique");
    console.log("   ⏳ Déploiement en cours...");

    try {
        // Déploiement du contrat
        const Rent2Repay = await ethers.getContractFactory("Rent2Repay");

        const rent2Repay = await upgrades.deployProxy(Rent2Repay, [
            config.ADMIN_ADDRESS,
            config.EMERGENCY_ADDRESS,
            config.OPERATOR_ADDRESS,
            config.RMM_ADDRESS,
            config.WXDAI_TOKEN,
            config.WXDAI_SUPPLY_TOKEN,
            config.USDC_TOKEN,
            config.USDC_SUPPLY_TOKEN
        ], {
            kind: 'uups',
            initializer: 'initialize',
            verify: false  // Désactiver la vérification automatique
        });

        await rent2Repay.waitForDeployment();

        // Récupération des adresses
        const proxyAddress = await rent2Repay.getAddress();
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

        console.log("\n�� Déploiement réussi!");
        console.log("============================================================");
        console.log(`📋 Proxy: ${proxyAddress}`);
        console.log(`�� Implementation: ${implementationAddress}`);
        console.log(`🔗 GnosisScan: https://gnosisscan.io/address/${proxyAddress}`);

        // Sauvegarde des informations de déploiement
        const deploymentInfo = {
            network: "gnosis-mainnet",
            chainId: 100,
            timestamp: new Date().toISOString(),
            deployer: deployer.address,
            proxyAddress: proxyAddress,
            implementationAddress: implementationAddress,
            config: config
        };

        const outputPath = path.join(__dirname, "tmp", "deployed-gnosis-mainnet.json");
        fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));

        console.log(`\n📄 Infos déploiement sauvegardées dans ${outputPath}`);

        // Vérification des rôles
        console.log("\n�� Vérification des rôles...");

        const adminRole = await rent2Repay.DEFAULT_ADMIN_ROLE();
        const emergencyRole = await rent2Repay.EMERGENCY_ROLE();
        const operatorRole = await rent2Repay.OPERATOR_ROLE();

        console.log(`   ✅ ADMIN_ROLE: ${await rent2Repay.hasRole(adminRole, config.ADMIN_ADDRESS)}`);
        console.log(`   ✅ EMERGENCY_ROLE: ${await rent2Repay.hasRole(emergencyRole, config.EMERGENCY_ADDRESS)}`);
        console.log(`   ✅ OPERATOR_ROLE: ${await rent2Repay.hasRole(operatorRole, config.OPERATOR_ADDRESS)}`);

        // Vérification de la configuration RMM
        console.log("\n�� Vérification de la configuration RMM...");
        const rmmAddress = await rent2Repay.rmm();
        console.log(`   ✅ RMM Address: ${rmmAddress}`);

        // Vérification des tokens configurés
        console.log("\n🔍 Vérification des tokens configurés...");
        const activeTokens = await rent2Repay.getActiveTokens();
        console.log(`   ✅ Tokens actifs: ${activeTokens.length}`);
        activeTokens.forEach((token, index) => {
            console.log(`      ${index + 1}. ${token}`);
        });

        // Vérification des frais
        console.log("\n🔍 Vérification des frais...");
        const [daoFees, senderTips] = await rent2Repay.getFeeConfiguration();
        console.log(`   ✅ DAO Fees: ${daoFees} BPS (${Number(daoFees) / 100}%)`);
        console.log(`   ✅ Sender Tips: ${senderTips} BPS (${Number(senderTips) / 100}%)`);

        console.log("\n�� Déploiement terminé avec succès!");
        console.log(`🔗 Vérifiez votre contrat sur GnosisScan: https://gnosisscan.io/address/${proxyAddress}`);

    } catch (error) {
        console.error("\n❌ Erreur lors du déploiement:");
        console.error(error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
