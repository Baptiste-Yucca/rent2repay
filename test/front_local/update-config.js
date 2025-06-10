// Script pour mettre à jour config.js avec les nouvelles adresses
const fs = require('fs');
const path = require('path');

function updateConfig(addresses) {
    const configPath = path.join(__dirname, 'config.js');
    let configContent = fs.readFileSync(configPath, 'utf8');

    console.log('🔄 Mise à jour des adresses dans config.js...');
    console.log('Adresses reçues:', addresses);

    // Remplacer les adresses dans le fichier - corriger les noms des propriétés
    if (addresses.RENT2REPAY) {
        configContent = configContent.replace(
            /RENT2REPAY: "[^"]*"/,
            `RENT2REPAY: "${addresses.RENT2REPAY}"`
        );
        console.log(`✅ RENT2REPAY: ${addresses.RENT2REPAY}`);
    }

    if (addresses.RMM) {
        configContent = configContent.replace(
            /RMM: "[^"]*"/,
            `RMM: "${addresses.RMM}"`
        );
        console.log(`✅ RMM: ${addresses.RMM}`);
    }

    if (addresses.WXDAI) {
        configContent = configContent.replace(
            /WXDAI: "[^"]*"/,
            `WXDAI: "${addresses.WXDAI}"`
        );
        console.log(`✅ WXDAI: ${addresses.WXDAI}`);
    }

    if (addresses.USDC) {
        configContent = configContent.replace(
            /USDC: "[^"]*"/,
            `USDC: "${addresses.USDC}"`
        );
        console.log(`✅ USDC: ${addresses.USDC}`);
    }

    if (addresses.DEBT_WXDAI) {
        configContent = configContent.replace(
            /DEBT_WXDAI: "[^"]*"/,
            `DEBT_WXDAI: "${addresses.DEBT_WXDAI}"`
        );
        console.log(`✅ DEBT_WXDAI: ${addresses.DEBT_WXDAI}`);
    }

    if (addresses.DEBT_USDC) {
        configContent = configContent.replace(
            /DEBT_USDC: "[^"]*"/,
            `DEBT_USDC: "${addresses.DEBT_USDC}"`
        );
        console.log(`✅ DEBT_USDC: ${addresses.DEBT_USDC}`);
    }

    // Écrire le fichier mis à jour
    fs.writeFileSync(configPath, configContent);
    console.log('✅ config.js mis à jour avec les nouvelles adresses');

    // Créer aussi un fichier contract-addresses.json pour les scripts Node.js
    const addressesForNode = {
        RENT2REPAY: addresses.RENT2REPAY,
        RMM: addresses.RMM,
        WXDAI: addresses.WXDAI,
        USDC: addresses.USDC,
        DEBT_WXDAI: addresses.DEBT_WXDAI,
        DEBT_USDC: addresses.DEBT_USDC
    };

    const nodeConfigPath = path.join(__dirname, 'contract-addresses.json');
    fs.writeFileSync(nodeConfigPath, JSON.stringify(addressesForNode, null, 2));
    console.log('✅ contract-addresses.json créé pour les scripts Node.js');
}

module.exports = { updateConfig }; 