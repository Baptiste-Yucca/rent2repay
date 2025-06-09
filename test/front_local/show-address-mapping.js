// Script pour afficher la correspondance des adresses Gnosis ↔ Localhost
const CONFIG = require('./config.js');

console.log("🌐 CORRESPONDANCE ADRESSES GNOSIS ↔ LOCALHOST");
console.log("=".repeat(60));

console.log("\n📋 TOKENS PRINCIPAUX");
console.log("-".repeat(30));
console.log(`WXDAI:`);
console.log(`  Gnosis:    0xe91d153e0b41518a2ce8dd3d7944fa863463a97d`);
console.log(`  Localhost: ${CONFIG.window.CONFIG.CONTRACTS.WXDAI}`);

console.log(`\nUSDC:`);
console.log(`  Gnosis:    0xddafbb505ad214d7b80b1f830fccc89b60fb7a83`);
console.log(`  Localhost: ${CONFIG.window.CONFIG.CONTRACTS.USDC}`);

console.log("\n💰 TOKENS DE DETTE");
console.log("-".repeat(25));
console.log(`debtWXDAI:`);
console.log(`  Gnosis:    0x9908801dF7902675C3FEDD6Fea0294D18D5d5d34`);
console.log(`  Localhost: ${CONFIG.window.CONFIG.CONTRACTS.DEBT_WXDAI}`);

console.log(`\ndebtUSDC:`);
console.log(`  Gnosis:    0x69c731aE5f5356a779f44C355aBB685d84e5E9e6`);
console.log(`  Localhost: ${CONFIG.window.CONFIG.CONTRACTS.DEBT_USDC}`);

console.log("\n🔧 CONTRATS RENT2REPAY");
console.log("-".repeat(30));
console.log(`Rent2Repay:`);
console.log(`  Localhost: ${CONFIG.window.CONFIG.CONTRACTS.RENT2REPAY}`);
console.log(`  (Pas encore déployé sur Gnosis)`);

console.log(`\nMockRMM:`);
console.log(`  Localhost: ${CONFIG.window.CONFIG.CONTRACTS.RMM}`);
console.log(`  (RMM réel sur Gnosis: adresse différente)`);

console.log("\n💡 UTILISATION");
console.log("-".repeat(15));
console.log("• Tests locaux → Utilisez les adresses Localhost");
console.log("• Production Gnosis → Utilisez les adresses Gnosis");
console.log("• Interface web → Configurée pour Localhost automatiquement");

console.log("\n🚀 COMMANDES");
console.log("-".repeat(15));
console.log("Déployer sur localhost:");
console.log("  npx hardhat node --reset");
console.log("  npx hardhat run test/front_local/deploy-fixed-addresses.js --network localhost");

console.log("\nOuvrir interface:");
console.log("  open test/front_local/index.html"); 