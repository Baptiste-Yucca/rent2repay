// Script pour mettre à jour config.js avec les nouvelles adresses
const fs = require('fs');
const path = require('path');

function updateConfig(addresses) {
    const configPath = path.join(__dirname, 'config.js');
    let configContent = fs.readFileSync(configPath, 'utf8');

    // Remplacer les adresses dans le fichier
    configContent = configContent.replace(
        /RENT2REPAY: "[^"]*"/,
        `RENT2REPAY: "${addresses.rent2repay}"`
    );
    configContent = configContent.replace(
        /RMM: "[^"]*"/,
        `RMM: "${addresses.rmm}"`
    );
    configContent = configContent.replace(
        /WXDAI: "[^"]*"/,
        `WXDAI: "${addresses.wxdai}"`
    );
    configContent = configContent.replace(
        /USDC: "[^"]*"/,
        `USDC: "${addresses.usdc}"`
    );
    configContent = configContent.replace(
        /DEBT_WXDAI: "[^"]*"/,
        `DEBT_WXDAI: "${addresses.debtWxdai}"`
    );
    configContent = configContent.replace(
        /DEBT_USDC: "[^"]*"/,
        `DEBT_USDC: "${addresses.debtUsdc}"`
    );

    // Écrire le fichier mis à jour
    fs.writeFileSync(configPath, configContent);
    console.log('✅ config.js mis à jour avec les nouvelles adresses');
}

module.exports = { updateConfig }; 