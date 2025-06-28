const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // Forcer la connexion au réseau localhost
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    
    // Récupérer l'argument de ligne de commande
    let signerIndex = 0; // par défaut
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        signerIndex = parseInt(args[0]);
        if (isNaN(signerIndex) || signerIndex < 0) {
            console.log("❌ L'index du signer doit être un nombre positif");
            console.log("   Usage: node scripts/whois-localhost.js [signer_index]");
            console.log("   Exemple: node scripts/whois-localhost.js 0");
            process.exit(1);
        }
    }

    console.log(`🔍 Analyse du signer ${signerIndex}...\n`);

    // Charger la configuration déployée
    const configPath = path.join(__dirname, "tmp/", "deployed-contracts.json");
    if (!fs.existsSync(configPath)) {
        throw new Error("❌ Fichier de configuration non trouvé. Exécutez d'abord le script de déploiement.");
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Créer les signers avec le provider localhost
    const signers = await provider.listAccounts();
    if (signerIndex >= signers.length) {
        console.log(`❌ Index ${signerIndex} trop élevé. Il y a ${signers.length} signers disponibles (0-${signers.length - 1})`);
        process.exit(1);
    }

    const targetAddress = signers[signerIndex];
    const targetSigner = new ethers.Wallet("0x" + "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80".slice(2 * signerIndex), provider);

    // Debug: vérifier la connexion
    console.log("🔧 DEBUG:");
    console.log(`Provider URL: ${provider._getConnection().url}`);
    console.log(`Adresse Rent2Repay: ${config.contracts.Rent2Repay}`);

    // Charger les contrats avec le provider localhost
    const rent2Repay = new ethers.Contract(config.contracts.Rent2Repay, 
        JSON.parse(fs.readFileSync("artifacts/contracts/Rent2Repay.sol/Rent2Repay.json")).abi, 
        provider);
    const mockUSDC = new ethers.Contract(config.contracts.MockUSDC,
        JSON.parse(fs.readFileSync("artifacts/contracts/mocks/MockERC20.sol/MockERC20.json")).abi,
        provider);

    // Informations de base
    console.log("👤 INFORMATIONS UTILISATEUR");
    console.log("=".repeat(50));
    console.log(`Index Signer: ${signerIndex}`);
    console.log(`Adresse: ${targetAddress}`);

    // Déterminer le rôle de l'utilisateur
    let userRole = "Utilisateur standard";
    if (signerIndex === 0) {
        userRole = "Déployeur/Admin";
    } else if (signerIndex === 1) {
        userRole = "Utilisateur de test";
    } else if (signerIndex >= 2) {
        userRole = `Runner ${signerIndex - 1}`;
    }
    console.log(`Rôle présumé: ${userRole}`);

    console.log("\n🔐 RÔLES DANS RENT2REPAY");
    console.log("=".repeat(50));

    try {
        const [isAdmin, isOperator, isEmergency] = await rent2Repay.connect(targetSigner).whoami();

        if (isAdmin) console.log("✅ DEFAULT_ADMIN_ROLE");
        if (isOperator) console.log("✅ OPERATOR_ROLE");
        if (isEmergency) console.log("✅ EMERGENCY_ROLE");

        if (!isAdmin && !isOperator && !isEmergency) {
            console.log("❌ Aucun rôle spécial");
        }
    } catch (error) {
        console.log("❌ Erreur lors de la vérification des rôles via whoami():", error.message);
    }

    console.log("\n✅ Test de connexion réussi !");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("❌ Erreur:", error);
        process.exit(1);
    });
