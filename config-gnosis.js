/**
 * Configuration pour le déploiement sur Gnosis Chain
 * 
 * Instructions:
 * 1. Remplacer chaque "ADDRESS_TO_FILL" par la vraie adresse
 * 2. Vérifier que toutes les adresses sont correctes
 * 3. Sauvegarder le fichier
 * 4. Exécuter: npm run deploy:tenderly
 */

module.exports = {
    // ===== CONTRACTS RMM =====
    // Adresse du contrat RMM principal sur Gnosis
    RMM_ADDRESS: "0xFb9b496519fCa8473fba1af0850B6B8F476BFdB3", // Contrat RMM principal

    // ===== TOKENS STABLECOINS =====
    // WXDAI (Wrapped XDAI) - équivalent à WETH sur Ethereum
    WXDAI_TOKEN: "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d", // Token WXDAI
    // USDC sur Gnosis
    USDC_TOKEN: "0xddafbb505ad214d7b80b1f830fccc89b60fb7a83", // Token USDC


    // ===== TOKENS SUPPLY RMM =====
    // Tokens de supply correspondants dans RMM
    WXDAI_SUPPLY_TOKEN: "0x0cA4f5554Dd9Da6217d62D8df2816c82bba4157b", // Token de supply WXDAI dans RMM
    USDC_SUPPLY_TOKEN: "0xeD56F76E9cBC6A64b821e9c016eAFbd3db5436D1", // Token de supply USDC dans RMM

    // ===== ADRESSES ADMIN =====
    // Adresse qui aura le rôle ADMIN (peut être une multisig)
    ADMIN_ADDRESS: "0xD2f9d86f58E8871c6D97DCc2BF911efB98a4c97C", // Adresse admin

    // Adresse qui aura le rôle EMERGENCY (peut être une multisig)
    EMERGENCY_ADDRESS: "0x19c13C99C13e648Cc9cF32ab04455Ea66eB6b6f8", // Adresse emergency

    // Adresse qui aura le rôle OPERATOR
    OPERATOR_ADDRESS: "0x5B3B05566724fD1E6C2941bC1499E9e89ca4E7f2", // Adresse operator

    // ===== ADRESSES FEE =====
    // Adresse du trésor DAO qui recevra les fees
    DAO_TREASURY_ADDRESS: "0x87f416a96b2616ad8ecb2183989917d4d540d244", // Trésor DAO

    // Token pour la réduction de fees DAO (optionnel) -> ici powervoting
    DAO_FEE_REDUCTION_TOKEN: "0x6382856a731Af535CA6aea8D364FCE67457da438", // Token pour réduction fees (optionnel) 

    // ===== CONFIGURATION FEES =====
    // Fees en basis points (BPS) - 10000 = 100%
    DAO_FEES_BPS: 50, // 0.5% par défaut
    SENDER_TIPS_BPS: 25, // 0.25% par défaut
    DAO_FEE_REDUCTION_BPS: 5000, // 50% de réduction par défaut
    DAO_FEE_REDUCTION_MINIMUM_AMOUNT: "1000000000000000000", // 1 token minimum (en wei)

    // ===== RÉSEAUX =====
    // ID de la chaîne Gnosis
    CHAIN_ID: 100, // Gnosis Chain

    // URL RPC pour Gnosis (Tenderly)
    RPC_URL: "https://rpc.gnosischain.com", // RPC public Gnosis

    // URL RPC Tenderly (optionnel - pour les tests)
    TENDERLY_RPC_URL: "https://virtual.gnosis.eu.rpc.tenderly.co/949b74bb-02c1-4db4-8a25-8d3aaf24c8a3", // URL RPC Tenderly si disponible
};

/**
 * COMMENT TROUVER LES ADRESSES:
 * 
 * 1. RMM_ADDRESS: 
 *    - Vérifier la documentation RMM pour Gnosis
 *    - Ou contacter l'équipe RMM
 * 
 * 2. WXDAI_TOKEN:
 *    - Explorer Gnosis: https://gnosisscan.io
 *    - Rechercher "WXDAI" ou "Wrapped XDAI"
 * 
 * 3. USDC_TOKEN:
 *    - Explorer Gnosis: https://gnosisscan.io
 *    - Rechercher "USDC" sur Gnosis
 * 
 * 4. SUPPLY_TOKENS:
 *    - Vérifier dans le contrat RMM
 *    - Ou contacter l'équipe RMM
 * 
 * 5. ADMIN/EMERGENCY/OPERATOR:
 *    - Vos adresses de contrôle
 *    - Peut être une multisig pour admin/emergency
 * 
 * 6. DAO_TREASURY_ADDRESS:
 *    - Adresse du trésor de votre DAO
 * 
 * 7. DAO_FEE_REDUCTION_TOKEN:
 *    - Token de gouvernance (optionnel)
 *    - Peut être laissé à "0x0000000000000000000000000000000000000000"
 */ 