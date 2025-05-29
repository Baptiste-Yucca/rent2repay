const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("DebtTokensModule", (m) => {
    // Déployer d'abord les tokens sous-jacents (WXDAI et USDC)
    const wxdai = m.contract("MockERC20", ["Wrapped XDAI", "WXDAI"]);
    const usdc = m.contract("MockERC20", ["USD Coin", "USDC"]);

    // Déployer les tokens de dette
    const armmv3WXDAI = m.contract("MockDebtToken", [
        "Aave Variable Debt WXDAI",
        "armmv3WXDAI",
        wxdai
    ]);

    const armmv3USDC = m.contract("MockDebtToken", [
        "Aave Variable Debt USDC",
        "armmv3USDC",
        usdc
    ]);

    return {
        wxdai,
        usdc,
        armmv3WXDAI,
        armmv3USDC
    };
}); 