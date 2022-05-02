import { ethers } from 'hardhat';
import { BigNumber, Contract, ContractFactory, Transaction, utils } from 'ethers';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { project_config } from './0_config';
import { TransactionResponse } from '@ethersproject/providers';
import { PQueue } from '../p-queue';

dotenvConfig({ path: resolve(__dirname, '../.env') });
const totalTokensToMint = 4444;
const maxTokensToMintPerBatch = 100;

async function printGas(utils: any, mintingTxn: TransactionResponse) {
    const tx = await mintingTxn.wait();
    console.log();
    console.log(`Gas limit: ${mintingTxn?.gasLimit.toString()}`);
    console.log(`Gas price: ${mintingTxn?.gasPrice?.toString()}`);
    console.log(`Gas Used: ${utils.formatEther(tx?.gasUsed.mul(mintingTxn?.gasPrice || BigNumber.from('0')))} ETH`);
    console.log("TxnHash:", mintingTxn.hash);
    console.log('=================================================');
    console.log();
    return tx?.gasUsed.mul(mintingTxn?.gasPrice || BigNumber.from('0'));
};

async function main(): Promise<void> {
    const { tokenName, tokenSymbol, baseURI, maxTokens, startSale } = project_config;
    const Factory: ContractFactory = await ethers.getContractFactory('SevenTwentyOne');

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

    console.log("waiting for 2 confirmations");
    await deployTransaction.wait(2);

    console.log();
    console.log('==================== MINTING ====================');

    const total = Math.min(totalTokensToMint, maxTokens);
    const batches = Math.ceil(Number(total / maxTokensToMintPerBatch));
    const tokenPlaces = Array(total).fill(0);
    let currentBatch = 0;

    const pqueue = new PQueue({ concurrency: 1 });

    while (tokenPlaces.length) {
        pqueue.add(async () => {
            // delete
            const slice = tokenPlaces.splice(0, maxTokensToMintPerBatch);
            console.log(`minting batch ${++currentBatch} out of ${batches} batches (${slice.length} tokens)`);
            // estimated Gas
            const estimatedGasLimit = await SevenTwentyOne.estimateGas.mintCommunityTokens(slice.length);
            const estimatedGasPrice = await ethers.getDefaultProvider().getGasPrice();
            console.log(`Estimated gas for ${slice.length} mints`);
            console.log(`Estimated Gas limit: ${estimatedGasLimit.toString()}`);
            console.log(`Estimated Gas price: ${estimatedGasPrice.toString()}`);
            console.log(`Estimated Gas: ${utils.formatEther(estimatedGasPrice.mul(estimatedGasLimit))} ETH`);
            console.log();
            // make transaction
            const mintingTxn = await SevenTwentyOne.mintCommunityTokens(slice.length);
            // print used gas
            printGas(utils, mintingTxn);
            // sleep
            await new Promise(r => setTimeout(r, 10000));
        });
    }
    await pqueue.onEmpty();

    const totalSupply = await SevenTwentyOne.totalSupply();
    console.log(`Count of minted tokens: ${totalSupply.toString()}\n`);

    console.log('==================== TRANSFER.1 ==================');
};

/* We recommend this pattern to be able to use async/await everywhere
  and properly handle errors. */
main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });