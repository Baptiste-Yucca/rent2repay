# Rent2Repay - Automated Debt Repayment System

🏠 **Rent2Repay** is a decentralized system that allows users to configure automated debt repayments using their ERC20 tokens, directly from their rental income or regular token holdings.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Git

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rent2repay
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Compile contracts**
   ```bash
   npm run compile
   ```

4. **Deploy and test (recommended)**
   ```bash
   npm run setup:local
   ```

### Alternative Setup

If you prefer manual deployment:

1. **Start local blockchain**
   ```bash
   npx hardhat node
   ```

2. **Deploy contracts (new terminal)**
   ```bash
   npm run deploy:local
   ```

3. **Test user configuration**
   ```bash
   npm run test:users
   ```

4. **Run all tests**
   ```bash
   npm test
   ```

### Development Setup

1. **Start local blockchain**
   ```bash
   npx hardhat node
   ```

2. **Deploy contracts and test (new terminal)**
   ```bash
   npm run setup:local
   ```

3. **Or deploy manually**
   ```bash
   npm run deploy:local
   npm run test:users
   ```

4. **Run coverage analysis**
   ```bash
   npm run coverage
   ```

## 📋 How It Works

### Overview
Rent2Repay is a smart contract system that enables automated debt repayments through a RealT Money Maker (RMM). Users can configure weekly spending limits per token, allowing anyone to trigger repayments on their behalf.

### Key Features
- **Multi-token support**: Configure different limits for different ERC20 tokens
- **Weekly limits**: Set maximum amounts that can be spent per week per token
- **Automated repayments**: Anyone can trigger repayments for configured users
- **Fee system**: DAO fees and executor tips incentivize the system
- **Role-based access**: Admin, operator, and emergency roles for system management
- **Pausable**: Emergency pause functionality
- **Upgradeable**: Proxy-based upgradeable contract architecture with OpenZeppelin
- **Reentrancy protection**: Built-in protection against reentrancy attacks

### Workflow
1. **User Configuration**: Users set weekly spending limits for specific tokens
2. **Token Approval**: Users approve the Rent2Repay contract to spend their tokens
3. **Repayment Execution**: Anyone can trigger repayments within the configured limits
4. **Debt Settlement**: The system automatically repays user debts through the RMM
5. **Fee Distribution**: DAO fees and executor tips are distributed accordingly

## 🛠️ Available Scripts

### Core Scripts
- `npm run compile` - Compile smart contracts
- `npm test` - Run all tests
- `npm run coverage` - Generate test coverage report
- `npm run deploy:local` - Deploy contracts to local network

### Production Scripts
- `npm run deploy:tenderly` - Deploy to Tenderly fork (Gnosis)
- `npm run deploy:gnosis` - Deploy to Gnosis Chain mainnet
- `npm run check:tenderly` - Verify deployment on Tenderly

### Upgradeable Contract Scripts
- `npm run deploy:upgradable` - Deploy upgradeable contracts with proxy
- `npm run upgrade:contract` - Upgrade existing contract to new implementation
- `npm run test:upgrade` - Run upgrade-specific tests

### Development Tools
- `npm run lint` - Lint Solidity code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format Solidity code
- `npm run docs` - Generate documentation

### Testing & Debugging
- `npm run test:users` - Show user configurations
- `npm run test:config` - Quick configuration test
- `npm run test:repay` - Quick repayment test
- `npm run demo` - Run complete demo

### CLI Tools
- `npm run setup:local` - Deploy and test in one command
- `npm run test:users` - Display all test users
- `npm run test:config` - Quick user configuration
- `npm run test:repay` - Quick repayment test
- `npm run test:concurrency` - Test concurrent executions
- `npm run test:status` - Show user status

## 🏗️ Architecture

### Smart Contracts

#### Core Contracts
- **`Rent2Repay.sol`** - Main contract managing user configurations and repayments
- **`IRMM.sol`** - Interface for RealT Money Maker integration

#### Mock Contracts (for testing)
- **`MockRMM.sol`** - Mock RealT Money Maker
- **`MockERC20.sol`** - Mock ERC20 token for testing
- **`MockDebtToken.sol`** - Mock debt token for testing

### Key Components

#### User Configuration
```solidity
struct TokenConfig {
    address token;        // ERC20 token address
    address debtToken;    // Associated debt token
    address supplyToken;  // Associated supply token
    bool active;          // Whether token is authorized
}
```

#### Repayment System
- Weekly spending limits per token
- Timestamp tracking for period resets
- Fee calculation and distribution
- Integration with RealT Money Maker

#### Role System
- **Admin**: Configure system parameters, authorize tokens
- **Operator**: Remove users, manage operations
- **Emergency**: Pause/unpause system in emergencies

### Upgradeable Architecture

#### Proxy Pattern
The Rent2Repay contract uses OpenZeppelin's upgradeable proxy pattern:
- **Proxy Contract**: Holds the state and delegates calls to implementation
- **Implementation Contract**: Contains the logic and can be upgraded
- **ProxyAdmin**: Manages upgrades (controlled by admin role)

#### Initialization
```solidity
function initialize(
    address admin,
    address emergency, 
    address operator,
    address _rmm,
    // ... token addresses
) external initializer
```

#### Security Features
- **ReentrancyGuard**: Protection against reentrancy attacks on all state-changing functions
- **Initializer**: Prevents multiple initialization of the proxy
- **Access Control**: Role-based permissions preserved across upgrades
- **Pausable**: Emergency pause functionality maintained

#### Upgrade Process
1. Deploy new implementation contract
2. Call `upgradeProxy()` with new implementation address
3. State is preserved, only logic is updated
4. Version tracking through `version()` function

## 🧪 Déploiement Tenderly

Pour tester sur Gnosis Chain via Tenderly :

1. **Configuration** : Remplir `config-gnosis.js`
2. **Variables d'environnement** : Voir `ENV_SETUP.md`
3. **Déploiement** : `npm run deploy:tenderly`
4. **Vérification** : `npm run check:tenderly`

Voir `TENDERLY_GUIDE.md` pour le guide complet.

## 📁 Project Structure

```
rent2repay/
├── contracts/                 # Smart contracts
│   ├── Rent2Repay.sol        # Main contract
│   ├── interfaces/           # Contract interfaces
│   │   └── IRMM.sol          # RMM interface
│   └── mocks/                # Mock contracts for testing
│       ├── MockRMM.sol       # Mock RealT Money Maker
│       ├── MockERC20.sol     # Mock ERC20 token
│       └── MockDebtToken.sol # Mock debt token
├── test/                     # Test files
│   ├── Rent2Repay.test.js   # Main contract tests
│   ├── Rent2Repay.batch.js  # Batch operation tests
│   ├── Rent2Repay.upgrade.test.js # Upgrade functionality tests
│   └── utils/               # Test utilities
├── scripts/                  # Deployment and utility scripts
│   ├── deploy-local.js      # Local deployment script
│   ├── deploy-upgradable.js # Upgradeable deployment script
│   ├── upgrade-contract.js  # Contract upgrade script
│   └── cli/                 # CLI utilities
│       ├── demo-complete.js # Complete demo script
│       ├── show-status.js   # Status display
│       └── show-users.js    # User configuration display
├── ignition/                # Hardhat Ignition modules
├── docs/                    # Documentation
├── hardhat.config.js        # Hardhat configuration
├── package.json             # Dependencies and scripts
└── README.md                # This file
```

## 🔧 Configuration

### Environment Setup
The project uses Hardhat for development and testing. Configuration is handled through:
- `hardhat.config.js` - Main Hardhat configuration
- `config.js` - Contract addresses and settings

### Test Network
For local development, the system uses Hardhat's built-in network with predefined accounts:
- Account 0: Admin/Deployer
- Account 1: Test User 1
- Account 2: Test User 2
- Additional accounts available for testing

### Contract Deployment
Contracts are deployed with initial token configurations:
- WXDAI token and debt token pair
- USDC token and debt token pair
- Configurable fee structure

### Upgradeable Deployment
For upgradeable contracts, use the dedicated deployment script:

```bash
# Deploy upgradeable contracts with proxy
npm run deploy:upgradable

# Deploy to specific network
npx hardhat run scripts/deploy-upgradable.js --network [network-name]
```

**Upgrade Process:**
```bash
# Upgrade existing proxy to new implementation
npm run upgrade:contract

# Upgrade on specific network
npx hardhat run scripts/upgrade-contract.js --network [network-name]
```

**Key Benefits:**
- State preservation during upgrades
- No need to migrate user configurations
- Seamless upgrade process for bug fixes and feature additions
- Version tracking and upgrade history

## 🧪 Testing

### Test Coverage
The project includes comprehensive tests covering:
- User configuration and authorization
- Repayment execution (single and batch)
- Fee calculation and distribution
- Role-based access control
- Error handling and edge cases
- Upgradeable contract functionality
- Reentrancy protection
- State preservation across upgrades

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/Rent2Repay.test.js

# Run upgrade tests only
npm run test:upgrade

# Run with coverage
npm run coverage

# Run specific test pattern
npx hardhat test --grep "repayment"
```

### Upgrade Testing
The upgrade functionality is thoroughly tested with dedicated test cases:

```bash
# Run upgrade-specific tests
npm run test:upgrade
```

**Upgrade Test Coverage:**
- Contract initialization and version tracking
- State preservation during upgrades
- Role preservation across upgrades
- Reentrancy protection verification
- Proxy functionality validation

### Test Structure
- **Unit Tests**: Individual function testing
- **Integration Tests**: End-to-end workflow testing
- **Edge Cases**: Boundary conditions and error scenarios
- **Gas Optimization**: Gas usage analysis

## 🔐 Security Considerations

### Access Control
- Role-based permissions using OpenZeppelin AccessControl
- Multi-signature requirements for critical operations
- Emergency pause functionality

### Token Security
- ERC20 token validation
- Allowance management
- Reentrancy protection

### Economic Security
- Fee caps to prevent exploitation
- Weekly limits to control exposure
- Debt validation through RMM integration

### Upgrade Security
- **Proxy Pattern**: Uses OpenZeppelin's battle-tested proxy implementation
- **Access Control**: Only admin role can perform upgrades
- **Initialization Protection**: Prevents multiple initialization attempts
- **State Safety**: Storage layout compatibility enforced
- **Reentrancy Guard**: Protection maintained across all upgrades
- **Version Tracking**: Contract version monitoring for audit trails

## 📚 Documentation

### API Documentation
Generate detailed API documentation:
```bash
npm run docs
```

### Function Documentation
All public functions are documented with:
- Purpose and behavior
- Parameter descriptions
- Return value details
- Usage examples

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Standards
- Follow Solidity style guide
- Write comprehensive tests
- Document all public functions
- Use meaningful variable names

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**"Token not authorized"**
- Ensure tokens are properly configured in the contract
- Check token addresses in configuration

**"Insufficient allowance"**
- Users must approve the Rent2Repay contract to spend their tokens
- Check allowance using `token.allowance(user, rent2repay)`

**"Weekly limit exceeded"**
- Repayments are limited by user-configured weekly maximums
- Wait for the weekly period to reset or increase limits

**"User not authorized"**
- Users must configure their repayment settings before repayments can be executed
- Use `configureRent2Repay()` to set up the system

### Getting Help
- Check the test files for usage examples
- Review the contract documentation
- Run the demo script for a complete walkthrough

## 🔮 Future Enhancements

The upgradeable architecture enables seamless implementation of future features:

- **Multi-chain support**: Deploy to additional networks without state migration
- **Advanced fee structures**: Implement new fee models through contract upgrades
- **Integration with additional DeFi protocols**: Add new protocol integrations
- **Enhanced security features**: Upgrade security mechanisms as best practices evolve
- **Performance optimizations**: Implement gas optimizations in future versions
- **Mobile-friendly interface**: Develop frontend with maintained backend compatibility
- **Automated monitoring and alerts**: Add monitoring without disrupting existing functionality

*All future enhancements can be deployed without affecting existing user configurations or requiring data migration.*
