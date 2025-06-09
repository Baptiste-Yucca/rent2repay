// Application principale pour l'interface de test Rent2Repay
class Rent2RepayApp {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contracts = {};
        this.userAddress = null;
        this.isConnected = false;

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.log('Interface Rent2Repay initialisée');

        // Tenter une connexion automatique si MetaMask/Rabby est déjà connecté
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    await this.connectWallet();
                }
            } catch (error) {
                this.log('Aucune connexion automatique possible', 'warning');
            }
        }
    }

    setupEventListeners() {
        // Connexion wallet
        document.getElementById('connect-wallet').addEventListener('click', () => this.connectWallet());

        // Actualisation des infos contrat
        document.getElementById('refresh-contract-info').addEventListener('click', () => this.loadContractInfo());

        // Configuration utilisateur
        document.getElementById('configure-form').addEventListener('submit', (e) => this.handleConfigure(e));
        document.getElementById('add-token-config').addEventListener('click', () => this.addTokenConfigInput());
        document.getElementById('configure-multi').addEventListener('click', () => this.handleMultiConfigure());

        // Révocation
        document.getElementById('revoke-token').addEventListener('click', () => this.handleRevokeToken());
        document.getElementById('revoke-all').addEventListener('click', () => this.handleRevokeAll());

        // Remboursement
        document.getElementById('repayment-form').addEventListener('submit', (e) => this.handleRepayment(e));
        document.getElementById('check-user').addEventListener('click', () => this.checkTargetUser());

        // Gestion des tokens (Admin)
        document.getElementById('authorize-token').addEventListener('click', () => this.handleAuthorizeToken());
        document.getElementById('unauthorize-token').addEventListener('click', () => this.handleUnauthorizeToken());
        document.getElementById('pause-contract').addEventListener('click', () => this.handlePauseContract());
        document.getElementById('unpause-contract').addEventListener('click', () => this.handleUnpauseContract());

        // Mock tokens
        document.getElementById('mint-tokens').addEventListener('click', () => this.handleMintTokens());
        document.getElementById('burn-tokens').addEventListener('click', () => this.handleBurnTokens());
        document.getElementById('approve-tokens').addEventListener('click', () => this.handleApproveTokens());

        // Logs
        document.getElementById('clear-logs').addEventListener('click', () => this.clearLogs());
    }

    async connectWallet() {
        try {
            if (!window.ethereum) {
                alert('Veuillez installer MetaMask ou Rabby Wallet');
                return;
            }

            this.showLoading();

            // Demander la connexion
            await window.ethereum.request({ method: 'eth_requestAccounts' });

            // Configurer le provider et signer
            this.provider = new ethers.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();
            this.userAddress = await this.signer.getAddress();

            // Vérifier/ajouter le réseau
            await this.ensureCorrectNetwork();

            this.isConnected = true;

            // Mettre à jour l'interface
            await this.updateAccountInfo();
            await this.loadContractInfo();

            // Afficher les sections pour utilisateurs connectés
            document.getElementById('account-section').style.display = 'block';
            document.getElementById('user-config-section').style.display = 'block';
            document.getElementById('repayment-section').style.display = 'block';

            // Mettre à jour le status réseau
            document.getElementById('network-status').textContent = `Connecté - ${CONFIG.NETWORK.name}`;
            document.getElementById('network-status').className = 'network-status network-connected';
            document.getElementById('connect-wallet').textContent = 'Connecté';
            document.getElementById('connect-wallet').disabled = true;

            this.log(`Connecté avec succès: ${formatAddress(this.userAddress)}`, 'success');

        } catch (error) {
            this.log(`Erreur de connexion: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async ensureCorrectNetwork() {
        const network = await this.provider.getNetwork();

        if (Number(network.chainId) !== CONFIG.NETWORK.chainId) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${CONFIG.NETWORK.chainId.toString(16)}` }],
                });
            } catch (switchError) {
                // Si le réseau n'existe pas, l'ajouter
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${CONFIG.NETWORK.chainId.toString(16)}`,
                            chainName: CONFIG.NETWORK.name,
                            rpcUrls: [CONFIG.NETWORK.rpcUrl],
                            nativeCurrency: {
                                name: 'Ether',
                                symbol: CONFIG.NETWORK.symbol,
                                decimals: 18
                            }
                        }]
                    });
                } else {
                    throw switchError;
                }
            }
        }
    }

    async updateAccountInfo() {
        try {
            // Balance ETH
            const balance = await this.provider.getBalance(this.userAddress);
            document.getElementById('account-address').textContent = this.userAddress;
            document.getElementById('eth-balance').textContent = formatAmount(balance);

            // Balances des tokens si les contrats sont chargés
            if (this.contracts.wxdai) {
                const wxdaiBalance = await this.contracts.wxdai.balanceOf(this.userAddress);
                document.getElementById('wxdai-balance').textContent = formatAmount(wxdaiBalance);
            }

            if (this.contracts.usdc) {
                const usdcBalance = await this.contracts.usdc.balanceOf(this.userAddress);
                document.getElementById('usdc-balance').textContent = formatAmount(usdcBalance);
            }

            // Balances des tokens de dette
            if (this.contracts.debtWxdai) {
                const debtWxdaiBalance = await this.contracts.debtWxdai.balanceOf(this.userAddress);
                document.getElementById('debt-wxdai-balance').textContent = formatAmount(debtWxdaiBalance);
            }

            if (this.contracts.debtUsdc) {
                const debtUsdcBalance = await this.contracts.debtUsdc.balanceOf(this.userAddress);
                document.getElementById('debt-usdc-balance').textContent = formatAmount(debtUsdcBalance);
            }

            // Détecter et afficher les rôles
            await this.updateUserRoles();

        } catch (error) {
            this.log(`Erreur mise à jour compte: ${error.message}`, 'error');
        }
    }

    async updateUserRoles() {
        if (!this.contracts.rent2repay) return;

        try {
            // Obtenir les hashes des rôles
            const defaultAdminRole = await this.contracts.rent2repay.DEFAULT_ADMIN_ROLE();
            const adminRole = await this.contracts.rent2repay.ADMIN_ROLE();
            const emergencyRole = await this.contracts.rent2repay.EMERGENCY_ROLE();
            const operatorRole = await this.contracts.rent2repay.OPERATOR_ROLE();

            // Vérifier les rôles
            const roles = [];

            if (await this.contracts.rent2repay.hasRole(defaultAdminRole, this.userAddress)) {
                roles.push({ name: "DEFAULT_ADMIN", description: CONFIG.ROLES.DESCRIPTIONS.DEFAULT_ADMIN });
            }

            if (await this.contracts.rent2repay.hasRole(adminRole, this.userAddress)) {
                roles.push({ name: "ADMIN", description: CONFIG.ROLES.DESCRIPTIONS.ADMIN });
            }

            if (await this.contracts.rent2repay.hasRole(emergencyRole, this.userAddress)) {
                roles.push({ name: "EMERGENCY", description: CONFIG.ROLES.DESCRIPTIONS.EMERGENCY });
            }

            if (await this.contracts.rent2repay.hasRole(operatorRole, this.userAddress)) {
                roles.push({ name: "OPERATOR", description: CONFIG.ROLES.DESCRIPTIONS.OPERATOR });
            }

            // Afficher les rôles dans l'interface
            this.displayUserRoles(roles);

        } catch (error) {
            this.log(`Erreur détection rôles: ${error.message}`, 'error');
        }
    }

    displayUserRoles(roles) {
        // Créer ou mettre à jour l'élément d'affichage des rôles
        let rolesElement = document.getElementById('user-roles');
        if (!rolesElement) {
            // Créer l'élément s'il n'existe pas
            rolesElement = document.createElement('div');
            rolesElement.id = 'user-roles';
            rolesElement.className = 'user-roles';

            // L'insérer après les balances de tokens
            const tokenBalances = document.querySelector('.token-balances');
            if (tokenBalances) {
                tokenBalances.parentNode.insertBefore(rolesElement, tokenBalances.nextSibling);
            }
        }

        if (roles.length === 0) {
            rolesElement.innerHTML = '<p><strong>🔸 Rôles:</strong> Utilisateur standard</p>';
            rolesElement.className = 'user-roles standard-user';
        } else {
            let html = '<p><strong>👑 Rôles administratifs:</strong></p><div class="roles-list">';

            roles.forEach(role => {
                const icon = this.getRoleIcon(role.name);
                html += `
                    <div class="role-item">
                        <span class="role-badge role-${role.name.toLowerCase()}">${icon} ${role.name}</span>
                        <span class="role-description">${role.description}</span>
                    </div>
                `;
            });

            html += '</div>';
            rolesElement.innerHTML = html;
            rolesElement.className = 'user-roles admin-user';
        }
    }

    getRoleIcon(roleName) {
        const icons = {
            'DEFAULT_ADMIN': '👑',
            'ADMIN': '🔧',
            'EMERGENCY': '🚨',
            'OPERATOR': '⚙️'
        };
        return icons[roleName] || '🔸';
    }

    async loadContractInfo() {
        if (!this.isConnected) {
            this.log('Connectez-vous d\'abord pour charger les informations du contrat', 'warning');
            return;
        }

        try {
            this.showLoading();

            // Détecter automatiquement les adresses des contrats déployés
            await this.detectContractAddresses();

            // Initialiser les contrats
            await this.initializeContracts();

            // Charger les informations
            if (this.contracts.rent2repay) {
                const rmmAddress = await this.contracts.rent2repay.rmm();
                const isPaused = await this.contracts.rent2repay.paused();
                const authorizedTokens = await this.contracts.rent2repay.getAuthorizedTokens();

                document.getElementById('contract-address').textContent = await this.contracts.rent2repay.getAddress();
                document.getElementById('rmm-address').textContent = rmmAddress;
                document.getElementById('contract-status').innerHTML = isPaused
                    ? '<span class="status-indicator status-paused"></span>En pause'
                    : '<span class="status-indicator status-active"></span>Actif';

                // Afficher tokens autorisés
                const tokenNames = [];
                for (const tokenAddr of authorizedTokens) {
                    try {
                        const tokenContract = new ethers.Contract(tokenAddr, CONFIG.ABI.ERC20, this.signer);
                        const symbol = await tokenContract.symbol();
                        tokenNames.push(`${symbol} (${formatAddress(tokenAddr)})`);
                    } catch (error) {
                        tokenNames.push(formatAddress(tokenAddr));
                    }
                }
                document.getElementById('authorized-tokens').textContent = tokenNames.join(', ');

                // Mettre à jour les dropdowns
                await this.updateTokenDropdowns(authorizedTokens);

                // Charger la configuration utilisateur
                await this.loadUserConfiguration();

                // Afficher la section admin si applicable
                this.checkAdminRights();
            }

            this.log('Informations du contrat chargées', 'success');

        } catch (error) {
            this.log(`Erreur chargement contrat: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async detectContractAddresses() {
        // Version simple : utiliser les adresses de config.js directement
        // Pas de popup, pas de détection complexe, juste utiliser ce qui est configuré

        if (!CONFIG.CONTRACTS.RENT2REPAY) {
            this.log('⚠️ Adresses des contrats non définies dans config.js', 'warning');
            this.log('💡 Déployez d\'abord avec: npx hardhat run test/front_local/deploy-fixed-addresses.js --network localhost', 'info');
            throw new Error('Contrats non déployés - Veuillez déployer d\'abord');
        }

        this.log('✅ Configuration chargée depuis config.js', 'success');
    }

    async initializeContracts() {
        if (!CONFIG.CONTRACTS.RENT2REPAY) {
            throw new Error('Adresse du contrat Rent2Repay non définie');
        }

        // Contrat principal
        this.contracts.rent2repay = new ethers.Contract(
            CONFIG.CONTRACTS.RENT2REPAY,
            CONFIG.ABI.RENT2REPAY,
            this.signer
        );

        // Initialiser tous les contrats de tokens avec les adresses fixes
        this.contracts.wxdai = new ethers.Contract(
            CONFIG.CONTRACTS.WXDAI,
            CONFIG.ABI.ERC20,
            this.signer
        );

        this.contracts.usdc = new ethers.Contract(
            CONFIG.CONTRACTS.USDC,
            CONFIG.ABI.ERC20,
            this.signer
        );

        // Initialiser les contrats de tokens de dette
        this.contracts.debtWxdai = new ethers.Contract(
            CONFIG.CONTRACTS.DEBT_WXDAI,
            CONFIG.ABI.ERC20,
            this.signer
        );

        this.contracts.debtUsdc = new ethers.Contract(
            CONFIG.CONTRACTS.DEBT_USDC,
            CONFIG.ABI.ERC20,
            this.signer
        );

        this.log('✅ Tous les contrats initialisés avec adresses fixes', 'success');
    }

    async updateTokenDropdowns(authorizedTokens) {
        const selects = [
            'token-select',
            'revoke-token-select',
            'repay-token',
            'unauthorize-token-select'
        ];

        // Tokens connus (WXDAI et USDC sont toujours autorisés après déploiement)
        const knownTokens = [
            { address: CONFIG.CONTRACTS.WXDAI, symbol: 'WXDAI' },
            { address: CONFIG.CONTRACTS.USDC, symbol: 'USDC' }
        ];

        for (const selectId of selects) {
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Sélectionner un token</option>';

            // Ajouter les tokens connus
            for (const token of knownTokens) {
                const option = document.createElement('option');
                option.value = token.address;
                option.textContent = `${token.symbol} (${formatAddress(token.address)})`;
                select.appendChild(option);
            }
        }

        // Aussi remplir le select pour les tokens mock
        const mockSelect = document.getElementById('mint-token-select');
        if (mockSelect) {
            mockSelect.innerHTML = '<option value="">Sélectionner un token</option>';
            for (const token of knownTokens) {
                const option = document.createElement('option');
                option.value = token.address;
                option.textContent = `${token.symbol} (${formatAddress(token.address)})`;
                mockSelect.appendChild(option);
            }
        }
    }

    async loadUserConfiguration() {
        try {
            const configs = await this.contracts.rent2repay.getUserConfigs(this.userAddress);
            const configDiv = document.getElementById('current-user-config');

            if (configs[0].length === 0) {
                configDiv.innerHTML = '<p>Aucune configuration trouvée</p>';
                return;
            }

            let html = '<div class="user-configs">';
            for (let i = 0; i < configs[0].length; i++) {
                const tokenAddr = configs[0][i];
                const maxAmount = configs[1][i];
                const spentAmount = configs[2][i];

                try {
                    const tokenContract = new ethers.Contract(tokenAddr, CONFIG.ABI.ERC20, this.signer);
                    const symbol = await tokenContract.symbol();
                    const available = await this.contracts.rent2repay.getAvailableAmountThisWeek(this.userAddress, tokenAddr);

                    html += `
                        <div class="token-config">
                            <h4>${symbol}</h4>
                            <p>Limite hebdomadaire: ${formatAmount(maxAmount)}</p>
                            <p>Dépensé cette semaine: ${formatAmount(spentAmount)}</p>
                            <p>Disponible: ${formatAmount(available)}</p>
                        </div>
                    `;
                } catch (error) {
                    html += `
                        <div class="token-config">
                            <h4>${formatAddress(tokenAddr)}</h4>
                            <p>Limite hebdomadaire: ${formatAmount(maxAmount)}</p>
                            <p>Dépensé cette semaine: ${formatAmount(spentAmount)}</p>
                        </div>
                    `;
                }
            }
            html += '</div>';
            configDiv.innerHTML = html;

        } catch (error) {
            this.log(`Erreur chargement configuration: ${error.message}`, 'error');
        }
    }

    async handleConfigure(event) {
        event.preventDefault();

        try {
            this.showLoading();

            const tokenAddress = document.getElementById('token-select').value;
            const weeklyLimit = document.getElementById('weekly-limit').value;

            if (!tokenAddress || !weeklyLimit) {
                throw new Error('Veuillez remplir tous les champs');
            }

            const amount = parseAmount(weeklyLimit);

            const tx = await this.contracts.rent2repay.configureRent2Repay([tokenAddress], [amount]);
            this.log(`Transaction envoyée: ${tx.hash}`, 'success');

            await tx.wait();
            this.log('Configuration mise à jour avec succès', 'success');

            // Actualiser l'affichage
            await this.loadUserConfiguration();
            await this.updateAccountInfo();

            // Reset form
            document.getElementById('configure-form').reset();

        } catch (error) {
            this.log(`Erreur configuration: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    addTokenConfigInput() {
        const container = document.getElementById('multi-token-inputs');
        const inputDiv = document.createElement('div');
        inputDiv.className = 'token-config-input';

        inputDiv.innerHTML = `
            <select class="multi-token-select" required>
                <option value="">Token</option>
            </select>
            <input type="number" class="multi-amount-input" placeholder="Limite" step="0.01" min="0" required>
            <button type="button" class="btn btn-danger btn-remove-config">✕</button>
        `;

        // Remplir le select avec les tokens autorisés
        const select = inputDiv.querySelector('.multi-token-select');
        const tokenSelect = document.getElementById('token-select');
        for (const option of tokenSelect.options) {
            if (option.value) {
                const newOption = option.cloneNode(true);
                select.appendChild(newOption);
            }
        }

        // Ajouter l'événement de suppression
        inputDiv.querySelector('.btn-remove-config').addEventListener('click', () => {
            container.removeChild(inputDiv);
        });

        container.appendChild(inputDiv);
    }

    async handleMultiConfigure() {
        try {
            this.showLoading();

            const inputs = document.querySelectorAll('.token-config-input');
            const tokens = [];
            const amounts = [];

            for (const input of inputs) {
                const tokenAddr = input.querySelector('.multi-token-select').value;
                const amount = input.querySelector('.multi-amount-input').value;

                if (tokenAddr && amount) {
                    tokens.push(tokenAddr);
                    amounts.push(parseAmount(amount));
                }
            }

            if (tokens.length === 0) {
                throw new Error('Aucune configuration valide trouvée');
            }

            const tx = await this.contracts.rent2repay.configureRent2Repay(tokens, amounts);
            this.log(`Transaction multi-configuration envoyée: ${tx.hash}`, 'success');

            await tx.wait();
            this.log('Configuration multi-tokens mise à jour avec succès', 'success');

            // Actualiser l'affichage
            await this.loadUserConfiguration();

            // Nettoyer les inputs
            document.getElementById('multi-token-inputs').innerHTML = '';

        } catch (error) {
            this.log(`Erreur configuration multi-tokens: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleRevokeToken() {
        try {
            const tokenAddress = document.getElementById('revoke-token-select').value;
            if (!tokenAddress) {
                throw new Error('Veuillez sélectionner un token');
            }

            this.showLoading();

            const tx = await this.contracts.rent2repay.revokeRent2RepayForToken(tokenAddress);
            this.log(`Transaction révocation envoyée: ${tx.hash}`, 'success');

            await tx.wait();
            this.log('Token révoqué avec succès', 'success');

            await this.loadUserConfiguration();

        } catch (error) {
            this.log(`Erreur révocation token: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleRevokeAll() {
        try {
            if (!confirm('Êtes-vous sûr de vouloir révoquer TOUS vos tokens configurés ?')) {
                return;
            }

            this.showLoading();

            const tx = await this.contracts.rent2repay.revokeRent2RepayAll();
            this.log(`Transaction révocation totale envoyée: ${tx.hash}`, 'success');

            await tx.wait();
            this.log('Tous les tokens révoqués avec succès', 'success');

            await this.loadUserConfiguration();

        } catch (error) {
            this.log(`Erreur révocation totale: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async checkTargetUser() {
        try {
            const userAddress = document.getElementById('target-user').value;
            if (!userAddress || !ethers.isAddress(userAddress)) {
                throw new Error('Adresse utilisateur invalide');
            }

            this.showLoading();

            const isAuthorized = await this.contracts.rent2repay.isAuthorized(userAddress);
            if (!isAuthorized) {
                document.getElementById('user-info').innerHTML = `
                    <p><strong>❌ Utilisateur non autorisé</strong></p>
                    <p>Cet utilisateur n'a configuré aucun token pour Rent2Repay</p>
                `;
                document.getElementById('user-info').style.display = 'block';
                return;
            }

            const configs = await this.contracts.rent2repay.getUserConfigs(userAddress);

            let html = '<p><strong>✅ Utilisateur autorisé</strong></p><div class="user-token-configs">';

            for (let i = 0; i < configs[0].length; i++) {
                const tokenAddr = configs[0][i];
                const maxAmount = configs[1][i];
                const spentAmount = configs[2][i];

                try {
                    const tokenContract = new ethers.Contract(tokenAddr, CONFIG.ABI.ERC20, this.signer);
                    const symbol = await tokenContract.symbol();
                    const available = await this.contracts.rent2repay.getAvailableAmountThisWeek(userAddress, tokenAddr);

                    html += `
                        <div class="user-token-config">
                            <h5>${symbol}</h5>
                            <p>Limite: ${formatAmount(maxAmount)} | Dépensé: ${formatAmount(spentAmount)} | Disponible: ${formatAmount(available)}</p>
                        </div>
                    `;
                } catch (error) {
                    html += `
                        <div class="user-token-config">
                            <h5>${formatAddress(tokenAddr)}</h5>
                            <p>Limite: ${formatAmount(maxAmount)} | Dépensé: ${formatAmount(spentAmount)}</p>
                        </div>
                    `;
                }
            }

            html += '</div>';
            document.getElementById('user-info').innerHTML = html;
            document.getElementById('user-info').style.display = 'block';

        } catch (error) {
            this.log(`Erreur vérification utilisateur: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleRepayment(event) {
        event.preventDefault();

        try {
            this.showLoading();

            const userAddress = document.getElementById('target-user').value;
            const tokenAddress = document.getElementById('repay-token').value;
            const amount = document.getElementById('repay-amount').value;

            if (!userAddress || !tokenAddress || !amount) {
                throw new Error('Veuillez remplir tous les champs');
            }

            if (!ethers.isAddress(userAddress)) {
                throw new Error('Adresse utilisateur invalide');
            }

            const amountWei = parseAmount(amount);

            // Vérifier que l'utilisateur a suffisamment de tokens
            const tokenContract = new ethers.Contract(tokenAddress, CONFIG.ABI.ERC20, this.signer);
            const balance = await tokenContract.balanceOf(this.userAddress);

            if (balance < amountWei) {
                throw new Error('Solde insuffisant');
            }

            // Vérifier l'allowance
            const allowance = await tokenContract.allowance(this.userAddress, await this.contracts.rent2repay.getAddress());
            if (allowance < amountWei) {
                this.log('Approbation nécessaire...', 'warning');
                const approveTx = await tokenContract.approve(await this.contracts.rent2repay.getAddress(), amountWei);
                await approveTx.wait();
                this.log('Approbation confirmée', 'success');
            }

            // Exécuter le remboursement
            const tx = await this.contracts.rent2repay.rent2repay(userAddress, tokenAddress, amountWei);
            this.log(`Transaction remboursement envoyée: ${tx.hash}`, 'success');

            await tx.wait();
            this.log('Remboursement exécuté avec succès', 'success');

            // Actualiser les informations
            await this.updateAccountInfo();
            await this.checkTargetUser();

            // Reset form
            document.getElementById('repayment-form').reset();
            document.getElementById('user-info').style.display = 'none';

        } catch (error) {
            this.log(`Erreur remboursement: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleMintTokens() {
        try {
            const tokenType = document.getElementById('mock-token-select').value;
            const amount = document.getElementById('mock-amount').value || CONFIG.DEFAULTS.MINT_AMOUNT;

            if (!tokenType) {
                throw new Error('Veuillez sélectionner un token');
            }

            this.showLoading();

            let tokenContract;
            switch (tokenType) {
                case 'WXDAI':
                    tokenContract = this.contracts.wxdai;
                    break;
                case 'USDC':
                    tokenContract = this.contracts.usdc;
                    break;
                case 'DEBT_WXDAI':
                    tokenContract = this.contracts.debtWxdai;
                    break;
                case 'DEBT_USDC':
                    tokenContract = this.contracts.debtUsdc;
                    break;
                default:
                    throw new Error('Type de token non supporté');
            }

            if (!tokenContract) {
                throw new Error('Contrat de token non initialisé');
            }

            const amountWei = parseAmount(amount);
            const tx = await tokenContract.mint(this.userAddress, amountWei);
            this.log(`Transaction mint ${tokenType} envoyée: ${tx.hash}`, 'success');

            await tx.wait();
            this.log(`${amount} ${tokenType} mintés avec succès`, 'success');

            await this.updateAccountInfo();

        } catch (error) {
            this.log(`Erreur mint: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleBurnTokens() {
        try {
            const tokenType = document.getElementById('mock-token-select').value;
            const amount = document.getElementById('mock-amount').value || CONFIG.DEFAULTS.MINT_AMOUNT;

            if (!tokenType) {
                throw new Error('Veuillez sélectionner un token');
            }

            this.showLoading();

            let tokenContract;
            switch (tokenType) {
                case 'WXDAI':
                    tokenContract = this.contracts.wxdai;
                    break;
                case 'USDC':
                    tokenContract = this.contracts.usdc;
                    break;
                case 'DEBT_WXDAI':
                    tokenContract = this.contracts.debtWxdai;
                    break;
                case 'DEBT_USDC':
                    tokenContract = this.contracts.debtUsdc;
                    break;
                default:
                    throw new Error('Type de token non supporté');
            }

            if (!tokenContract) {
                throw new Error('Contrat de token non initialisé');
            }

            // Vérifier la balance avant de burn
            const balance = await tokenContract.balanceOf(this.userAddress);
            const amountWei = parseAmount(amount);

            if (balance < amountWei) {
                throw new Error(`Balance insuffisante. Vous avez ${formatAmount(balance)} ${tokenType}`);
            }

            // Simuler le burn en transférant vers l'adresse 0x0 (burn address)
            // Car MockERC20 n'a pas de fonction burn native
            const burnAddress = "0x0000000000000000000000000000000000000000";
            const tx = await tokenContract.transfer(burnAddress, amountWei);
            this.log(`Transaction burn simulé ${tokenType} envoyée: ${tx.hash}`, 'success');
            this.log(`Note: Burn simulé par transfer vers 0x0`, 'warning');

            await tx.wait();
            this.log(`${amount} ${tokenType} brûlés avec succès (simulé)`, 'success');

            await this.updateAccountInfo();

        } catch (error) {
            this.log(`Erreur burn: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleApproveTokens() {
        try {
            const tokenType = document.getElementById('mock-token-select').value;
            const amount = document.getElementById('approve-amount').value || CONFIG.DEFAULTS.APPROVE_AMOUNT;

            if (!tokenType) {
                throw new Error('Veuillez sélectionner un token');
            }

            this.showLoading();

            let tokenContract;
            switch (tokenType) {
                case 'WXDAI':
                    tokenContract = this.contracts.wxdai;
                    break;
                case 'USDC':
                    tokenContract = this.contracts.usdc;
                    break;
                case 'DEBT_WXDAI':
                    tokenContract = this.contracts.debtWxdai;
                    break;
                case 'DEBT_USDC':
                    tokenContract = this.contracts.debtUsdc;
                    break;
                default:
                    throw new Error('Type de token non supporté');
            }

            if (!tokenContract) {
                throw new Error('Contrat de token non initialisé');
            }

            const amountWei = parseAmount(amount);
            const tx = await tokenContract.approve(await this.contracts.rent2repay.getAddress(), amountWei);
            this.log(`Transaction approbation ${tokenType} envoyée: ${tx.hash}`, 'success');

            await tx.wait();
            this.log(`Approbation de ${amount} ${tokenType} confirmée`, 'success');

        } catch (error) {
            this.log(`Erreur approbation: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleAuthorizeToken() {
        try {
            const tokenAddress = document.getElementById('new-token-address').value;

            if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
                throw new Error('Adresse de token invalide');
            }

            this.showLoading();

            const tx = await this.contracts.rent2repay.authorizeToken(tokenAddress);
            this.log(`Transaction autorisation token envoyée: ${tx.hash}`, 'success');

            await tx.wait();
            this.log('Token autorisé avec succès', 'success');

            await this.loadContractInfo();
            document.getElementById('new-token-address').value = '';

        } catch (error) {
            this.log(`Erreur autorisation token: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleUnauthorizeToken() {
        try {
            const tokenAddress = document.getElementById('unauthorize-token-select').value;

            if (!tokenAddress) {
                throw new Error('Veuillez sélectionner un token');
            }

            if (!confirm('Êtes-vous sûr de vouloir désautoriser ce token ?')) {
                return;
            }

            this.showLoading();

            const tx = await this.contracts.rent2repay.unauthorizeToken(tokenAddress);
            this.log(`Transaction désautorisation token envoyée: ${tx.hash}`, 'success');

            await tx.wait();
            this.log('Token désautorisé avec succès', 'success');

            await this.loadContractInfo();

        } catch (error) {
            this.log(`Erreur désautorisation token: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handlePauseContract() {
        try {
            if (!confirm('Êtes-vous sûr de vouloir mettre en pause le contrat ?')) {
                return;
            }

            this.showLoading();

            const tx = await this.contracts.rent2repay.pause();
            this.log(`Transaction pause envoyée: ${tx.hash}`, 'success');

            await tx.wait();
            this.log('Contrat mis en pause', 'success');

            await this.loadContractInfo();

        } catch (error) {
            this.log(`Erreur pause: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleUnpauseContract() {
        try {
            this.showLoading();

            const tx = await this.contracts.rent2repay.unpause();
            this.log(`Transaction déblocage envoyée: ${tx.hash}`, 'success');

            await tx.wait();
            this.log('Contrat débloqué', 'success');

            await this.loadContractInfo();

        } catch (error) {
            this.log(`Erreur déblocage: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    checkAdminRights() {
        if (!this.isConnected || !this.contracts.rent2repay) return;

        // Vérifier les rôles et afficher les sections appropriées
        this.updateUserRoles().then(() => {
            const rolesElement = document.getElementById('user-roles');
            if (rolesElement && rolesElement.classList.contains('admin-user')) {
                // L'utilisateur a des rôles admin, afficher la section de gestion
                document.getElementById('token-management-section').style.display = 'block';
                this.log('Sections administratives activées', 'success');
            } else {
                // Utilisateur standard, masquer les sections admin
                document.getElementById('token-management-section').style.display = 'none';
                this.log('Utilisateur standard détecté', 'info');
            }
        });
    }

    showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    log(message, type = 'info') {
        const logsContainer = document.getElementById('logs');
        const logEntry = document.createElement('p');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;

        logsContainer.insertBefore(logEntry, logsContainer.firstChild);

        // Limiter à 50 entrées
        while (logsContainer.children.length > 50) {
            logsContainer.removeChild(logsContainer.lastChild);
        }
    }

    clearLogs() {
        document.getElementById('logs').innerHTML = '<p class="log-entry">Logs effacés</p>';
    }
}

// Initialiser l'application quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
    window.app = new Rent2RepayApp();
}); 