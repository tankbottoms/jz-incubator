import { ethers } from 'hardhat';
import { BigNumber, Contract, ContractFactory } from 'ethers';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { project_config } from './0_config';

/*
npx hardhat run scripts/1_deploy.ts --network rinkeby 
npx hardhat verify --contract  contracts/WAGMISevenTwentyOne.sol:WAGMISevenTwentyOne --network rinkeby 0x3c16452F0175C03cad9c317618b85f1AC0A4DcF4 "Juicebox Staked Governance Tokens" "veBANA" "ipfs://Qmf92Xgzi8bsKARRrG6ACBxNYk6NJSRkEc2aewKdW2CKtJ/" "60" "1"

npx hardhat run scripts/1_deploy.ts --network rinkeby 
npx hardhat verify --contract  contracts/WAGMISevenTwentyOne.sol:WAGMISevenTwentyOne --network rinkeby 0x3c16452F0175C03cad9c317618b85f1AC0A4DcF4 "Juicebox Staked Governance Tokens" "veBANA" "ipfs://Qmf92Xgzi8bsKARRrG6ACBxNYk6NJSRkEc2aewKdW2CKtJ/" "60" "1"
*/


dotenvConfig({ path: resolve(__dirname, '../.env') });

async function main(): Promise<void> {
    const { tokenName, tokenSymbol, baseURI, maxTokens, startSale } = project_config;
    const Factory: ContractFactory = await ethers.getContractFactory('WAGMISevenTwentyOne');

    console.log(`Token name:${tokenName} (${tokenSymbol})`);
    console.log(`Max tokens:${maxTokens}, startSale:${startSale}`);

    const SevenTwentyOne: Contract = await Factory.deploy(
        tokenName,
        tokenSymbol,
        baseURI,
        maxTokens,
        startSale,
    );

    const deployed = await SevenTwentyOne.deployed();
    console.log(`Contract deployed to:`, SevenTwentyOne.address);

    const { deployTransaction } = deployed;
    const { hash, from, to, gasPrice, gasLimit, data, chainId, confirmations } = deployTransaction;

    console.log(`transaction id:${hash}`);
    console.log(`from:${from}, to:${to} - (${confirmations} confirmations)`);
    console.log(gasPrice, gasLimit);
    console.log(`Verify using:` + `\n` +
        `npx hardhat verify --network rinkeby ` + `${SevenTwentyOne.address} ` +
        `"${tokenName}" "${tokenSymbol}" "${baseURI}" "${maxTokens}" "${startSale}"`
    );
};

/* We recommend this pattern to be able to use async/await everywhere
  and properly handle errors. */
main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
