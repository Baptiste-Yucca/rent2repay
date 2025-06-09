// Configuration pour l'interface de test Rent2Repay
window.CONFIG = {
    // Réseau local Hardhat
    NETWORK: {
        name: 'Hardhat Local',
        chainId: 31337,
        rpcUrl: 'http://127.0.0.1:8545',
        symbol: 'ETH'
    },

    // Adresses des contrats (mises à jour avec le déploiement récent)
    CONTRACTS: {
        RENT2REPAY: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
        RMM: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
        WXDAI: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
        USDC: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        // Tokens de dette (localhost)
        DEBT_WXDAI: "0x95401dc811bb5740090279Ba06cfA8fcF6113778",
        DEBT_USDC: "0x998abeb3E57409262aE5b751f60747921B33613E"
    },

    // ABI des contrats (versions simplifiées pour les fonctions utilisées)
    ABI: {
        RENT2REPAY: [
            // Configuration
            "function configureRent2Repay(address[] tokens, uint256[] amounts)",
            "function revokeRent2RepayForToken(address token)",
            "function revokeRent2RepayAll()",

            // Remboursement
            "function rent2repay(address user, address token, uint256 amount) returns (bool)",

            // Vues
            "function isAuthorized(address user) view returns (bool)",
            "function isAuthorizedForToken(address user, address token) view returns (bool)",
            "function getAvailableAmountThisWeek(address user, address token) view returns (uint256)",
            "function getUserConfigForToken(address user, address token) view returns (uint256, uint256, uint256)",
            "function getUserConfigs(address user) view returns (address[], uint256[], uint256[])",
            "function getAuthorizedTokens() view returns (address[])",

            // Admin
            "function authorizeToken(address token)",
            "function unauthorizeToken(address token)",
            "function pause()",
            "function unpause()",
            "function paused() view returns (bool)",

            // RMM
            "function rmm() view returns (address)",

            // Rôles (AccessControl)
            "function hasRole(bytes32 role, address account) view returns (bool)",
            "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
            "function ADMIN_ROLE() view returns (bytes32)",
            "function EMERGENCY_ROLE() view returns (bytes32)",
            "function OPERATOR_ROLE() view returns (bytes32)",

            // Events
            "event Rent2RepayConfigured(address indexed user, address indexed token, uint256 weeklyMaxAmount)",
            "event Rent2RepayRevoked(address indexed user, address indexed token)",
            "event RepaymentExecuted(address indexed user, address indexed token, uint256 amount, uint256 remainingThisWeek, address indexed executor)"
        ],

        ERC20: [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
            "function totalSupply() view returns (uint256)",
            "function balanceOf(address owner) view returns (uint256)",
            "function allowance(address owner, address spender) view returns (uint256)",
            "function transfer(address to, uint256 amount) returns (bool)",
            "function approve(address spender, uint256 amount) returns (bool)",
            "function transferFrom(address from, address to, uint256 amount) returns (bool)",

            // Mock functions
            "function mint(address to, uint256 amount)"
        ],

        RMM: [
            "function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) returns (uint256)"
        ]
    },

    // Adresses des tokens connus (mise à jour avec le déploiement récent)
    TOKENS: {
        WXDAI: {
            address: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
            symbol: 'WXDAI',
            name: 'Wrapped xDAI',
            decimals: 18
        },
        USDC: {
            address: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 18 // Mock USDC utilise 18 décimales pour simplifier
        },
        // Tokens de dette correspondants
        DEBT_WXDAI: {
            address: "0x95401dc811bb5740090279Ba06cfA8fcF6113778", // localhost
            // Gnosis address: "0x9908801dF7902675C3FEDD6Fea0294D18D5d5d34"
            symbol: 'debtWXDAI',
            name: 'Debt Token WXDAI',
            decimals: 18,
            parentToken: 'WXDAI'
        },
        DEBT_USDC: {
            address: "0x998abeb3E57409262aE5b751f60747921B33613E", // localhost
            // Gnosis address: "0x69c731aE5f5356a779f44C355aBB685d84e5E9e6"
            symbol: 'debtUSDC',
            name: 'Debt Token USDC',
            decimals: 18,
            parentToken: 'USDC'
        }
    },

    // Rôles et permissions (définis au déploiement)
    ROLES: {
        // Au déploiement, tous les rôles sont assignés au deployer
        DEFAULT_ADMIN: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        ADMIN: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        EMERGENCY: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        OPERATOR: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",

        // Descriptions des rôles
        DESCRIPTIONS: {
            DEFAULT_ADMIN: "Super Admin - Peut gérer tous les autres rôles",
            ADMIN: "Admin - Peut gérer les tokens autorisés",
            EMERGENCY: "Urgence - Peut pause/unpause le contrat et récupération d'urgence",
            OPERATOR: "Opérateur - Peut supprimer des utilisateurs"
        }
    },

    // Configuration par défaut
    DEFAULTS: {
        GAS_LIMIT: 500000,
        WEEKLY_LIMIT: 100,
        MINT_AMOUNT: 1000,
        APPROVE_AMOUNT: 1000
    },

    // Comptes de test Hardhat (clés privées des 10 premiers comptes)
    TEST_ACCOUNTS: [
        {
            address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
            label: "Admin/Deployer (TOUS RÔLES)"
        },
        {
            address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
            label: "User1 (Configuré)"
        },
        {
            address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
            label: "User2 (Test)"
        },
        {
            address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
            label: "User3 (Test)"
        },
        {
            address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
            privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
            label: "User4 (Test)"
        }
    ]
};

// Fonction utilitaire pour formater les adresses
window.formatAddress = function (address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Fonction utilitaire pour formater les montants
window.formatAmount = function (amount, decimals = 18) {
    if (!amount) return '0';
    return ethers.formatUnits(amount, decimals);
};

// Fonction utilitaire pour parser les montants
window.parseAmount = function (amount, decimals = 18) {
    return ethers.parseUnits(amount.toString(), decimals);
}; 