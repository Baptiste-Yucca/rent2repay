const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Déploiement du contrat Rent2Repay...\n");

    // Récupération des signers
    const [deployer, admin, emergency, operator] = await ethers.getSigners();

    console.log("👤 Adresses utilisées :");
    console.log("Deployer:", deployer.address);
    console.log("Admin:", admin.address);
    console.log("Emergency:", emergency.address);
    console.log("Operator:", operator.address);
    console.log();

    // Déploiement du contrat
    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2Repay = await Rent2Repay.deploy(
        admin.address,
        emergency.address,
        operator.address
    );

    await rent2Repay.waitForDeployment();

    const contractAddress = await rent2Repay.getAddress();
    console.log("✅ Contrat déployé à l'adresse:", contractAddress);
    console.log();

    // Vérification des rôles
    console.log("🔐 Vérification des rôles :");
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const ADMIN_ROLE = await rent2Repay.ADMIN_ROLE();
    const EMERGENCY_ROLE = await rent2Repay.EMERGENCY_ROLE();
    const OPERATOR_ROLE = await rent2Repay.OPERATOR_ROLE();

    console.log("Admin role (DEFAULT_ADMIN):", await rent2Repay.hasRole(DEFAULT_ADMIN_ROLE, admin.address));
    console.log("Admin role (ADMIN):", await rent2Repay.hasRole(ADMIN_ROLE, admin.address));
    console.log("Emergency role:", await rent2Repay.hasRole(EMERGENCY_ROLE, emergency.address));
    console.log("Operator role:", await rent2Repay.hasRole(OPERATOR_ROLE, operator.address));
    console.log();

    // État initial
    console.log("📊 État initial du contrat :");
    console.log("Contrat en pause:", await rent2Repay.paused());
    console.log();

    // Sauvegarde des informations de déploiement
    const deploymentInfo = {
        contractAddress: contractAddress,
        deployer: deployer.address,
        admin: admin.address,
        emergency: emergency.address,
        operator: operator.address,
        network: await ethers.provider.getNetwork(),
        timestamp: new Date().toISOString()
    };

    console.log("📝 Informations de déploiement :");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    return deploymentInfo;
}

// Gestion des erreurs
main()
    .then((deploymentInfo) => {
        console.log("\n🎉 Déploiement terminé avec succès !");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Erreur lors du déploiement :", error);
        process.exit(1);
    }); 