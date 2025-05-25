const hre = require("hardhat");

async function main() {
  console.log("Déploiement de Rent2RepayAuthorizer...");

  // Récupération des comptes
  const [deployer, testUser] = await hre.ethers.getSigners();
  console.log("Déploiement avec l'adresse:", deployer.address);
  console.log("Adresse de test:", testUser.address);

  // Déploiement du contrat
  const Rent2RepayAuthorizer = await hre.ethers.getContractFactory("Rent2RepayAuthorizer");
  const rent2RepayAuthorizer = await Rent2RepayAuthorizer.deploy();
  await rent2RepayAuthorizer.waitForDeployment();

  console.log("Rent2RepayAuthorizer déployé à:", await rent2RepayAuthorizer.getAddress());

  // Test d'autorisation avec l'utilisateur de test
  console.log("\nTest d'autorisation avec l'utilisateur de test...");
  const authorizeTransaction = await rent2RepayAuthorizer.connect(testUser).authorizeRent2Repay();
  await authorizeTransaction.wait();
  
  // Vérification de l'autorisation
  const isAuthorized = await rent2RepayAuthorizer.isAuthorized(testUser.address);
  console.log("Utilisateur autorisé:", isAuthorized);

  console.log("\nDéploiement et tests terminés avec succès!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 