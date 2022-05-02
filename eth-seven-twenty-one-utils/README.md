# Ethereum 721/20 Token Utilities 

## Build

### Deploy to Rinkeby

If the `config.ts` settings are set, then the following script uses the `address.ts` to mint in batches and transfer to the addresses provided.

```bash
npx hardhat run scripts/4_deploy_mint_transfer.ts --network rinkeby
```

### Verify Contract on Etherscan

After the above deployment, a helper command is presented to verify the contract on Etherscan.

For example:
```bash
npx hardhat verify --network rinkeby 0xCONTRACT-ADDRESS "TOKEN-NAME" "TOKEN-SYMBOL" "ipfs://IPFS-CID/" "TOKEN-COUNT" "1"   
```
