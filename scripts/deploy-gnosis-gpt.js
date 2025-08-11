// scripts/deploy-and-verify-gnosis.js
require("dotenv").config();
const { ethers, upgrades, run } = require("hardhat");



async function main() {
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

    // sanity checks
    const req = (name, v) => { if (!v) throw new Error(`Missing env: ${name}`); };
    [["PRIVATE_KEY", process.env.PRIVATE_KEY],
    ["GNOSISSCAN_API_KEY", process.env.GNOSISSCAN_API_KEY],
    ["RMM_ADDRESS", RMM_ADDRESS], ["WXDAI_TOKEN", WXDAI_TOKEN],
    ["WXDAI_SUPPLY_TOKEN", WXDAI_SUPPLY], ["USDC_TOKEN", USDC_TOKEN],
    ["USDC_SUPPLY_TOKEN", USDC_SUPPLY],
    ["ADMIN_ADDRESS", ADMIN_ADDRESS], ["EMERGENCY_ADDRESS", EMERGENCY_ADDRESS],
    ["OPERATOR_ADDRESS", OPERATOR_ADDRESS]].forEach(([k, v]) => req(k, v));

    const [deployer] = await ethers.getSigners();
    const net = await ethers.provider.getNetwork();
    if (net.chainId !== 100n) throw new Error(`Wrong chain id ${net.chainId}, need 100`);

    console.log("Deploying from:", deployer.address);

    const Rent2Repay = await ethers.getContractFactory("Rent2Repay");

    const initArgs = [
        ADMIN_ADDRESS,
        EMERGENCY_ADDRESS,
        OPERATOR_ADDRESS,
        RMM_ADDRESS,
        WXDAI_TOKEN,
        WXDAI_SUPPLY,
        USDC_TOKEN,
        USDC_SUPPLY
    ];

    // Déploiement proxy UUPS avec initialize()
    const proxy = await upgrades.deployProxy(Rent2Repay, initArgs, {
        kind: "uups",
        initializer: "initialize",
        // pas d'auto-verify ici
    });
    await proxy.waitForDeployment();

    const proxyAddress = await proxy.getAddress();
    const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

    console.log("Proxy:", proxyAddress);
    console.log("Implementation:", implAddress);

    // --- Vérification de l’implémentation ---
    try {
        await run("verify:verify", { address: implAddress, constructorArguments: [] });
        console.log("Implementation verified ✅");
    } catch (e) {
        console.log("Implementation verify skipped/failed:", (e && e.message) || e);
    }

    // --- Vérification du proxy (ERC1967Proxy) ---
    try {
        const initData = Rent2Repay.interface.encodeFunctionData("initialize", initArgs);
        // constructor(implementation,address) = (impl, initData)
        await run("verify:verify", {
            address: proxyAddress,
            constructorArguments: [implAddress, initData],
        });
        console.log("Proxy verified ✅");
    } catch (e) {
        console.log("Proxy verify skipped/failed:", (e && e.message) || e);
    }

    console.log("Done.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
