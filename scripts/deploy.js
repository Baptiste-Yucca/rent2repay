const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const AutoRepayUpgradeable = await ethers.getContractFactory("AutoRepayUpgradeable");
  
  // Initial parameters
  const admin = deployer.address;
  const botFeeBps = 50; // 0.5%
  const daoFeeBps = 20; // 0.2%
  const daoFeeRecipient = deployer.address; // Change this to your DAO address

  console.log("Deploying AutoRepayUpgradeable...");
  const autoRepay = await upgrades.deployProxy(AutoRepayUpgradeable, [
    admin,
    botFeeBps,
    daoFeeBps,
    daoFeeRecipient
  ], {
    initializer: 'initialize',
    kind: 'uups'
  });

  await autoRepay.waitForDeployment();
  console.log("AutoRepayUpgradeable deployed to:", await autoRepay.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 