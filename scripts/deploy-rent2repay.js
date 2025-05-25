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

  // Test de configuration avec l'utilisateur de test
  console.log("\nConfiguration Rent2Repay avec l'utilisateur de test...");
  const weeklyAmount = hre.ethers.parseEther("100"); // 100 ETH par semaine
  const configureTransaction = await rent2RepayAuthorizer.connect(testUser).configureRent2Repay(weeklyAmount);
  await configureTransaction.wait();
  
  // Vérification de l'autorisation
  const isAuthorized = await rent2RepayAuthorizer.isAuthorized(testUser.address);
  console.log("Utilisateur autorisé:", isAuthorized);
  
  // Récupération de la configuration
  const [maxAmount, lastTimestamp, currentSpent] = await rent2RepayAuthorizer.getUserConfig(testUser.address);
  console.log("Montant hebdomadaire max:", hre.ethers.formatEther(maxAmount), "ETH");
  console.log("Dernier remboursement:", lastTimestamp.toString());
  console.log("Dépensé cette semaine:", hre.ethers.formatEther(currentSpent), "ETH");
  
  // Test du montant disponible
  const available = await rent2RepayAuthorizer.getAvailableAmountThisWeek(testUser.address);
  console.log("Montant disponible cette semaine:", hre.ethers.formatEther(available), "ETH");

  console.log("\nDéploiement et tests terminés avec succès!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 