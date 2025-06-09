const { ethers, network } = require("hardhat");
require("dotenv").config();

// Configuration par réseau
const NETWORK_CONFIG = {
    localhost: {
        name: "Localhost (Hardhat)",
        rmmAddress: null, // Utilise MockRMM
        supportedAssets: {
            WXDAI: null, // Utilise MockERC20
            USDC: null   // Utilise MockERC20
        },
        defaultRepaymentAsset: "WXDAI", // Token par défaut pour les tests
        useMock: true
    },
    hardhat: {
        name: "Hardhat",
        rmmAddress: null, // Utilise MockRMM
        supportedAssets: {
            WXDAI: null, // Utilise MockERC20
            USDC: null   // Utilise MockERC20
        },
        defaultRepaymentAsset: "WXDAI", // Token par défaut pour les tests
        useMock: true
    },
    chiado: {
        name: "Chiado Testnet",
        rmmAddress: process.env.CHIADO_RMM_PROXY,
        supportedAssets: {
            WXDAI: process.env.CHIADO_WXDAI_ADDRESS,
            USDC: process.env.CHIADO_USDC_ADDRESS
        },
        defaultRepaymentAsset: process.env.CHIADO_DEFAULT_ASSET || "WXDAI",
        useMock: false
    }
    // GNOSIS MAINNET - DÉSACTIVÉ PAR DÉFAUT POUR ÉVITER LES DÉPLOIEMENTS ACCIDENTELS
    // Pour activer, décommentez la section ci-dessous et configurez vos variables d'environnement
    /*
    gnosis: {
        name: "Gnosis Mainnet",
        rmmAddress: process.env.GNOSIS_RMM_PROXY || "0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3",
        supportedAssets: {
            WXDAI: process.env.GNOSIS_WXDAI_ADDRESS || "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d",
            USDC: process.env.GNOSIS_USDC_ADDRESS || "0xddafbb505ad214d7b80b1f830fccc89b60fb7a83"
        },
        defaultRepaymentAsset: process.env.GNOSIS_DEFAULT_ASSET || "WXDAI",
        useMock: false
    }
    */
};

async function deployMockContracts() {
    console.log("📦 Déploiement des contrats Mock pour les tests...");

    // Déployer MockRMM
    const MockRMM = await ethers.getContractFactory("MockRMM");
    const mockRMM = await MockRMM.deploy();
    await mockRMM.waitForDeployment();
    console.log(`✅ MockRMM déployé à: ${await mockRMM.getAddress()}`);

    // Déployer Mock WXDAI
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockWXDAI = await MockERC20.deploy("Wrapped xDAI", "WXDAI");
    await mockWXDAI.waitForDeployment();
    console.log(`✅ Mock WXDAI déployé à: ${await mockWXDAI.getAddress()}`);

    // Déployer Mock USDC
    const mockUSDC = await MockERC20.deploy("USD Coin", "USDC");
    await mockUSDC.waitForDeployment();
    console.log(`✅ Mock USDC déployé à: ${await mockUSDC.getAddress()}`);

    return {
        rmmAddress: await mockRMM.getAddress(),
        supportedAssets: {
            WXDAI: await mockWXDAI.getAddress(),
            USDC: await mockUSDC.getAddress()
        }
    };
}

async function deployRent2Repay(rmmAddress, supportedAssets) {
    console.log("🚀 Déploiement du contrat Rent2Repay...");

    const [deployer] = await ethers.getSigners();
    console.log("👤 Déployeur:", deployer.address);

    // Adresses par défaut pour les rôles (vous pouvez les personnaliser)
    const admin = deployer.address;
    const emergency = deployer.address;
    const operator = deployer.address;

    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2repay = await Rent2Repay.deploy(
        admin,
        emergency,
        operator,
        rmmAddress,
        supportedAssets.WXDAI,
        supportedAssets.USDC
    );

    await rent2repay.waitForDeployment();

    const contractAddress = await rent2repay.getAddress();
    console.log(`✅ Rent2Repay déployé à: ${contractAddress}`);

    return rent2repay;
}

async function verifyContract(contractAddress, constructorArguments) {
    console.log("🔍 Vérification du contrat...");
    try {
        await hre.run("verify:verify", {
            address: contractAddress,
            constructorArguments: constructorArguments,
        });
        console.log("✅ Contrat vérifié avec succès");
    } catch (error) {
        console.log("❌ Erreur lors de la vérification:", error.message);
    }
}

async function main() {
    const networkName = network.name;
    const config = NETWORK_CONFIG[networkName];

    if (!config) {
        throw new Error(`Configuration non trouvée pour le réseau: ${networkName}`);
    }

    console.log(`🌐 Déploiement sur: ${config.name}`);
    console.log(`📋 Réseau: ${networkName}`);

    let rmmAddress = config.rmmAddress;
    let supportedAssets = config.supportedAssets;
    let repaymentAsset;

    // Déployer les mocks si nécessaire
    if (config.useMock) {
        const mockContracts = await deployMockContracts();
        rmmAddress = mockContracts.rmmAddress;
        supportedAssets = mockContracts.supportedAssets;
    } else {
        // Vérifier que les adresses sont configurées
        if (!rmmAddress || !supportedAssets.WXDAI || !supportedAssets.USDC) {
            throw new Error(
                `❌ Adresses manquantes pour ${networkName}. ` +
                `Vérifiez votre fichier .env:\n` +
                `- RMM Address: ${rmmAddress}\n` +
                `- WXDAI Address: ${supportedAssets.WXDAI}\n` +
                `- USDC Address: ${supportedAssets.USDC}`
            );
        }
    }

    // Sélectionner l'asset de remboursement par défaut
    repaymentAsset = supportedAssets[config.defaultRepaymentAsset];
    if (!repaymentAsset) {
        throw new Error(`Asset de remboursement non trouvé: ${config.defaultRepaymentAsset}`);
    }

    console.log(`💰 Asset de remboursement sélectionné: ${config.defaultRepaymentAsset} (${repaymentAsset})`);

    // Déployer Rent2Repay
    const rent2repay = await deployRent2Repay(rmmAddress, supportedAssets);
    const contractAddress = await rent2repay.getAddress();
    const [deployer] = await ethers.getSigners();

    // Résumé du déploiement
    console.log("\n📊 RÉSUMÉ DU DÉPLOIEMENT");
    console.log("========================");
    console.log(`🌐 Réseau: ${config.name}`);
    console.log(`📍 Rent2Repay: ${contractAddress}`);
    console.log(`🏦 RMM: ${rmmAddress}`);
    console.log(`💰 Asset de remboursement: ${config.defaultRepaymentAsset} (${repaymentAsset})`);
    console.log(`\nAssets supportés:`);
    console.log(`   • WXDAI: ${supportedAssets.WXDAI}`);
    console.log(`   • USDC: ${supportedAssets.USDC}`);

    // Vérification sur les réseaux publics
    if (networkName !== "localhost" && networkName !== "hardhat") {
        await verifyContract(contractAddress, [
            // Arguments du constructeur
            deployer.address, // admin
            deployer.address, // emergency
            deployer.address, // operator
            rmmAddress,
            supportedAssets.WXDAI,
            supportedAssets.USDC
        ]);
    }

    return {
        rent2repay: contractAddress,
        rmm: rmmAddress,
        repaymentAsset: repaymentAsset,
        supportedAssets: supportedAssets
    };
}

// Exécution du script
if (require.main === module) {
    main()
        .then((result) => {
            console.log("\n🎉 Déploiement terminé avec succès!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("❌ Erreur lors du déploiement:", error);
            process.exit(1);
        });
}

module.exports = { main, deployRent2Repay, deployMockContracts }; 