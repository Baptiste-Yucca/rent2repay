// Script de déploiement avec adresses FIXES et correspondance Gnosis
const { ethers } = require("hardhat");

// Correspondance Gnosis ↔ Localhost
const ADDRESS_MAPPING = {
    // Tokens principaux
    WXDAI: {
        gnosis: "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d",
        localhost: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"  // nonce 2
    },
    USDC: {
        gnosis: "0xddafbb505ad214d7b80b1f830fccc89b60fb7a83",
        localhost: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"  // nonce 3
    },
    // Tokens de dette 
    DEBT_WXDAI: {
        gnosis: "0x9908801dF7902675C3FEDD6Fea0294D18D5d5d34",
        localhost: "0x09635F643e140090A9A8Dcd712eD6285858ceBef"  // nonce 5
    },
    DEBT_USDC: {
        gnosis: "0x69c731aE5f5356a779f44C355aBB685d84e5E9e6",
        localhost: "0xc5a5C42992dECbae36851359345FE25997F5C42d"  // nonce 6
    }
};

// Adresses fixes attendues pour localhost (basées sur les nonces prédictibles)
const EXPECTED_ADDRESSES = {
    RMM: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",         // nonce 1
    WXDAI: ADDRESS_MAPPING.WXDAI.localhost,                     // nonce 2  
    USDC: ADDRESS_MAPPING.USDC.localhost,                       // nonce 3
    RENT2REPAY: "0x0165878A594ca255338adfa4d48449f69242Eb8F",  // nonce 4
    DEBT_WXDAI: ADDRESS_MAPPING.DEBT_WXDAI.localhost,           // nonce 5
    DEBT_USDC: ADDRESS_MAPPING.DEBT_USDC.localhost              // nonce 6
};

async function main() {
    console.log("🚀 DÉPLOIEMENT AVEC ADRESSES FIXES");
    console.log("=".repeat(50));

    const [deployer, user1, user2, user3] = await ethers.getSigners();
    console.log(`👤 Déployeur: ${deployer.address}`);
    console.log(`👤 User1 (sera configuré): ${user1.address}`);

    // Vérifier le nonce initial - DOIT être 0 pour des adresses fixes
    const initialNonce = await deployer.getNonce();
    if (initialNonce !== 0) {
        console.log(`⚠️  ATTENTION: Nonce deployer = ${initialNonce} (devrait être 0)`);
        console.log(`💡 Pour des adresses fixes, redémarrez: npx hardhat node --reset`);
        console.log(`   Puis relancez ce script`);
        return;
    }

    console.log(`✅ Nonce initial correct: ${initialNonce}`);

    // 1. Déployer MockRMM (nonce 1)
    console.log("\n📦 1. Déploiement MockRMM...");
    const MockRMM = await ethers.getContractFactory("MockRMM");
    const rmm = await MockRMM.deploy();
    await rmm.waitForDeployment();
    const rmmAddress = await rmm.getAddress();

    console.log(`✅ MockRMM: ${rmmAddress}`);
    console.log(`   Attendu: ${EXPECTED_ADDRESSES.RMM}`);
    console.log(`   Match: ${rmmAddress === EXPECTED_ADDRESSES.RMM ? "✅" : "❌"}`);

    // 2. Déployer WXDAI (nonce 2)
    console.log("\n📦 2. Déploiement WXDAI...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const wxdai = await MockERC20.deploy("Wrapped xDAI", "WXDAI");
    await wxdai.waitForDeployment();
    const wxdaiAddress = await wxdai.getAddress();

    console.log(`✅ WXDAI: ${wxdaiAddress}`);
    console.log(`   Attendu: ${EXPECTED_ADDRESSES.WXDAI}`);
    console.log(`   Match: ${wxdaiAddress === EXPECTED_ADDRESSES.WXDAI ? "✅" : "❌"}`);

    // 3. Déployer USDC (nonce 3)
    console.log("\n📦 3. Déploiement USDC...");
    const usdc = await MockERC20.deploy("USD Coin", "USDC");
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();

    console.log(`✅ USDC: ${usdcAddress}`);
    console.log(`   Attendu: ${EXPECTED_ADDRESSES.USDC}`);
    console.log(`   Match: ${usdcAddress === EXPECTED_ADDRESSES.USDC ? "✅" : "❌"}`);

    // 4. Déployer Rent2Repay (nonce 4)
    console.log("\n📦 4. Déploiement Rent2Repay...");
    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");
    const rent2repay = await Rent2Repay.deploy(
        deployer.address, // admin
        deployer.address, // emergency
        deployer.address, // operator
        rmmAddress,       // rmm
        wxdaiAddress,     // wxdai
        usdcAddress       // usdc
    );
    await rent2repay.waitForDeployment();
    const rent2repayAddress = await rent2repay.getAddress();

    console.log(`✅ Rent2Repay: ${rent2repayAddress}`);
    console.log(`   Attendu: ${EXPECTED_ADDRESSES.RENT2REPAY}`);
    console.log(`   Match: ${rent2repayAddress === EXPECTED_ADDRESSES.RENT2REPAY ? "✅" : "❌"}`);

    // 5. Déployer debtWXDAI (nonce 5)
    console.log("\n📦 5. Déploiement debtWXDAI...");
    const debtWxdai = await MockERC20.deploy("Debt Token WXDAI", "debtWXDAI");
    await debtWxdai.waitForDeployment();
    const debtWxdaiAddress = await debtWxdai.getAddress();

    console.log(`✅ debtWXDAI: ${debtWxdaiAddress}`);
    console.log(`   Attendu: ${EXPECTED_ADDRESSES.DEBT_WXDAI}`);
    console.log(`   Match: ${debtWxdaiAddress === EXPECTED_ADDRESSES.DEBT_WXDAI ? "✅" : "❌"}`);

    // 6. Déployer debtUSDC (nonce 6)
    console.log("\n📦 6. Déploiement debtUSDC...");
    const debtUsdc = await MockERC20.deploy("Debt Token USDC", "debtUSDC");
    await debtUsdc.waitForDeployment();
    const debtUsdcAddress = await debtUsdc.getAddress();

    console.log(`✅ debtUSDC: ${debtUsdcAddress}`);
    console.log(`   Attendu: ${EXPECTED_ADDRESSES.DEBT_USDC}`);
    console.log(`   Match: ${debtUsdcAddress === EXPECTED_ADDRESSES.DEBT_USDC ? "✅" : "❌"}`);

    // 7. Configuration et mint
    console.log("\n⚙️  7. Configuration des tokens...");

    // Mint des tokens pour les utilisateurs de test
    const mintAmount = ethers.parseUnits("10000", 18);
    const testUsers = [deployer, user1, user2, user3];

    for (const user of testUsers) {
        await wxdai.mint(user.address, mintAmount);
        await usdc.mint(user.address, mintAmount);

        if (user !== user1) {
            await debtWxdai.mint(user.address, ethers.parseUnits("1000", 18));
            await debtUsdc.mint(user.address, ethers.parseUnits("1000", 18));
        }
    }
    console.log("✅ Tokens mintés pour tous les utilisateurs");

    // 8. Configuration spéciale User1
    console.log("\n🎯 8. Configuration User1...");

    // Mint des tokens de dette spécifiques pour User1
    await debtWxdai.mint(user1.address, ethers.parseUnits("150", 18));
    await debtUsdc.mint(user1.address, ethers.parseUnits("20", 18));
    console.log("✅ Tokens de dette mintés pour User1 (150 debtWXDAI + 20 debtUSDC)");

    // Configurer Rent2Repay pour User1
    const wxdaiLimit = ethers.parseUnits("100", 18);
    const usdcLimit = ethers.parseUnits("50", 18);

    const user1Connected = rent2repay.connect(user1);
    await user1Connected.configureRent2Repay(
        [wxdaiAddress, usdcAddress],
        [wxdaiLimit, usdcLimit]
    );
    console.log("✅ User1 configuré dans Rent2Repay (100 WXDAI + 50 USDC/semaine)");

    // 9. Vérification finale
    console.log("\n📊 VÉRIFICATION FINALE");
    console.log("=".repeat(25));

    const allMatch =
        rmmAddress === EXPECTED_ADDRESSES.RMM &&
        wxdaiAddress === EXPECTED_ADDRESSES.WXDAI &&
        usdcAddress === EXPECTED_ADDRESSES.USDC &&
        rent2repayAddress === EXPECTED_ADDRESSES.RENT2REPAY &&
        debtWxdaiAddress === EXPECTED_ADDRESSES.DEBT_WXDAI &&
        debtUsdcAddress === EXPECTED_ADDRESSES.DEBT_USDC;

    if (allMatch) {
        console.log("🎉 PARFAIT ! Toutes les adresses correspondent à config.js");
        console.log("✅ L'interface web fonctionnera immédiatement");
        console.log("🚀 Vous pouvez ouvrir test/front_local/index.html");

        // Afficher la correspondance Gnosis
        console.log("\n🌐 CORRESPONDANCE GNOSIS ↔ LOCALHOST");
        console.log("=".repeat(45));
        console.log("Token        | Gnosis                                      | Localhost");
        console.log("-".repeat(75));
        console.log(`WXDAI        | ${ADDRESS_MAPPING.WXDAI.gnosis}   | ${wxdaiAddress}`);
        console.log(`USDC         | ${ADDRESS_MAPPING.USDC.gnosis}   | ${usdcAddress}`);
        console.log(`debtWXDAI    | ${ADDRESS_MAPPING.DEBT_WXDAI.gnosis}   | ${debtWxdaiAddress}`);
        console.log(`debtUSDC     | ${ADDRESS_MAPPING.DEBT_USDC.gnosis}   | ${debtUsdcAddress}`);
        console.log("\n💡 Utilisez les adresses Localhost pour les tests locaux");
        console.log("💡 Utilisez les adresses Gnosis pour la production");

    } else {
        console.log("❌ ATTENTION: Certaines adresses ne correspondent pas");
        console.log("💡 Redémarrez avec: npx hardhat node --reset");
        console.log("   Puis relancez ce script");
    }

    return {
        allMatch,
        addresses: {
            RMM: rmmAddress,
            WXDAI: wxdaiAddress,
            USDC: usdcAddress,
            RENT2REPAY: rent2repayAddress,
            DEBT_WXDAI: debtWxdaiAddress,
            DEBT_USDC: debtUsdcAddress
        }
    };
}

main()
    .then((result) => {
        if (result.allMatch) {
            console.log("\n🎉 Déploiement avec adresses fixes réussi !");
            console.log("L'interface web est prête à être utilisée");
        } else {
            console.log("\n⚠️  Redémarrage nécessaire pour des adresses fixes");
        }
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Erreur :", error);
        process.exit(1);
    }); 