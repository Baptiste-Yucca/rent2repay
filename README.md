# Rent2Repay - Automated Debt Repayment System

🏠 **Rent2Repay** is a decentralized system that allows users to configure automated debt repayments using their ERC20 tokens, directly from their rental income or regular token holdings.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Git

### Installation

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

4. **Run tests**
   ```bash
   npm test
   ```

### Development Setup

1. **Start local blockchain**
   ```bash
   npx hardhat node
   ```

2. **Deploy contracts (new terminal)**
   ```bash
   npm run deploy:local
   ```

3. **Run coverage analysis**
   ```bash
   npm run coverage
   ```

## 📋 How It Works

### Overview
Rent2Repay is a smart contract system that enables automated debt repayments through a Risk Management Module (RMM). Users can configure weekly spending limits per token, allowing anyone to trigger repayments on their behalf.

### Key Features
- **Multi-token support**: Configure different limits for different ERC20 tokens
- **Weekly limits**: Set maximum amounts that can be spent per week per token
- **Automated repayments**: Anyone can trigger repayments for configured users
- **Fee system**: DAO fees and executor tips incentivize the system
- **Role-based access**: Admin, operator, and emergency roles for system management
- **Pausable**: Emergency pause functionality

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

## 🏗️ Architecture

### Smart Contracts

#### Core Contracts
- **`Rent2Repay.sol`** - Main contract managing user configurations and repayments
- **`IRMM.sol`** - Interface for Risk Management Module integration

#### Mock Contracts (for testing)
- **`MockRMM.sol`** - Mock Risk Management Module
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
- Integration with Risk Management Module

#### Role System
- **Admin**: Configure system parameters, authorize tokens
- **Operator**: Remove users, manage operations
- **Emergency**: Pause/unpause system in emergencies

## 📁 Project Structure

```
rent2repay/
├── contracts/                 # Smart contracts
│   ├── Rent2Repay.sol        # Main contract
│   ├── interfaces/           # Contract interfaces
│   │   └── IRMM.sol          # RMM interface
│   └── mocks/                # Mock contracts for testing
│       ├── MockRMM.sol       # Mock Risk Management Module
│       ├── MockERC20.sol     # Mock ERC20 token
│       └── MockDebtToken.sol # Mock debt token
├── test/                     # Test files
│   ├── Rent2Repay.test.js   # Main contract tests
│   ├── Rent2Repay.batch.js  # Batch operation tests
│   └── utils/               # Test utilities
├── scripts/                  # Deployment and utility scripts
│   ├── deploy-local.js      # Local deployment script
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

## 🧪 Testing

### Test Coverage
The project includes comprehensive tests covering:
- User configuration and authorization
- Repayment execution (single and batch)
- Fee calculation and distribution
- Role-based access control
- Error handling and edge cases

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/Rent2Repay.test.js

# Run with coverage
npm run coverage

# Run specific test pattern
npx hardhat test --grep "repayment"
```

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

- Multi-chain support
- Advanced fee structures
- Integration with additional DeFi protocols
- Mobile-friendly interface
- Automated monitoring and alerts
