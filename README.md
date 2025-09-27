## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Deploy

```shell
$ forge script script/DeployGnosis.s.sol --rpc-url https://rpc.gnosischain.com --broadcast --verify
```

### Verify
```shell
# implementation
$ forge verify-contract --etherscan-api-key $GNOSISSCAN_API_KEY --chain-id 100 $R2R_IMPLEMENATION_ADDR src/Rent2Repay.sol:Rent2Repay
# proxy
$ forge verify-contract --etherscan-api-key $GNOSISSCAN_API_KEY --chain-id 100 $R2R_PROXY_ADDR lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy --constructor-args $(cast abi-encode "constructor(address,bytes)" $R2R_IMPLEMENATION_ADDR 0x)
```
### After deploy
```shell
#give approval to RMM (supply/repay)
$ forge script test/gnosis/CallAllApproval.s.sol --rpc-url https://rpc.gnosischain.com --broadcast --verify --verifier-url https://api.gnosisscan.com/api --etherscan-api-key $GNOSISSCAN_API_KEY  

$ forge script test/gnosis/ConfigRent2repay.s.sol --rpc-url https://rpc.gnosischain.com --broadcast --verify --verifier-url https://api.gnosisscan.com/api --etherscan-api-key $GNOSISSCAN_API_KEY

$ forge script test/gnosis/CallRent2repay.s.sol --rpc-url https://rpc.gnosischain.com --broadcast --verify --verifier-url https://api.gnosisscan.com/api --etherscan-api-key $GNOSISSCAN_API_KEY

etc
```

### Testbook
```
https://docs.google.com/spreadsheets/d/1azRgjzlTM9ObizbTXG3P1kgnuy-l-H5QYLK2vVERcGU/
```

### Cast

```shell
$ cast <subcommand>
# example cast call 0xContractAddress "daoFeesBps()(uint256)" --rpc-url https://rpc.gnosischain.com
```

### Help

```shell
$ forge --help
$ cast --help
```
