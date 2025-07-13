const { ethers, upgrades } = require("hardhat");
const config = require("../config.js");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Upgrading contracts with the account:", deployer.address);

    // Get the proxy address from config
    const proxyAddress = config.CONTRACTS.RENT2REPAY;
    console.log("Proxy address:", proxyAddress);

    // Deploy the new implementation
    const Rent2RepayV2 = await ethers.getContractFactory("Rent2Repay");
    const upgraded = await upgrades.upgradeProxy(proxyAddress, Rent2RepayV2);

    console.log("Contract upgraded successfully!");
    console.log("Proxy address:", await upgraded.getAddress());
    console.log("New implementation version:", await upgraded.version());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 