import { ethers } from 'hardhat';
import { BigNumber, Contract, ContractFactory, Transaction, utils } from 'ethers';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { ambassadors_hex, ambassadors_ens, whitelist, reserved_address_tokens } from './addresses';
import { project_config } from '../test/config';

dotenvConfig({ path: resolve(__dirname, '../.env') });

async function printGas(utils: any, mintingTxn: Transaction) {
    console.log();
    console.log(`Gas limit: ${mintingTxn?.gasLimit.toString()}`);
    console.log(`Gas price: ${mintingTxn?.gasPrice?.toString()}`);
    console.log(`Gas Used: ${utils.formatEther(mintingTxn?.gasLimit.mul(mintingTxn?.gasPrice || BigNumber.from('0')))} ETH`);
    console.log("TxnHash:", mintingTxn.hash);
    console.log('=================================================');
    console.log();
}

async function main(): Promise<void> {

    const { tokenName, tokenSymbol, baseURI, maxTokens, startSale } = project_config;            
    const blockHeight = await ethers.provider.getBlockNumber();
    console.log(`Block height is ${blockHeight}`);

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

    const totalTokensToMint = 1_450;
    const maxTokensToMint = 100;

    const estimatedGasLimit = /* BigNumber.from('21000') || */ await SevenTwentyOne.estimateGas.mintCommunityTokens(maxTokensToMint);
    const estimatedGasPrice = await ethers.getDefaultProvider().getGasPrice();
    console.log(`Estimated gas for ${maxTokensToMint} mints`);
    console.log(`Estimated Gas limit: ${estimatedGasLimit.toString()}`);
    console.log(`Estimated Gas price: ${estimatedGasPrice.toString()}`);
    console.log(`Estimated Gas: ${utils.formatEther(estimatedGasPrice.mul(estimatedGasLimit))} ETH`);
    console.log();

    const mintBatch = Math.trunc(Number(totalTokensToMint / maxTokensToMint));
    const remainder = totalTokensToMint % maxTokensToMint;

    console.log(`Number of batches to mint ${mintBatch}, with remainder of ${remainder}`);
    
    let mintingTxn: Transaction;
            
    for (let i = 0; i <= mintBatch; i++){
        if (i == mintBatch){
            console.log(`minting the remainder of ${remainder}`);
            mintingTxn = await SevenTwentyOne.mintCommunityTokens(remainder, { gasLimit: BigNumber.from('8400000') });                            
            printGas(utils, mintingTxn)
        } else {
            console.log(`minting batch ${i} out of ${mintBatch} batches`);
            mintingTxn = await SevenTwentyOne.mintCommunityTokens(mintBatch, { gasLimit: BigNumber.from('8400000') });                        
            const receipt = await mintingTxn.wait()
            for (const event of receipt.events) {
                if (event.event !== 'Transfer') {
                console.log('ignoring unknown event type ', event.event)
                continue            
            };
                console.log(event.args.tokenId.toString());
            };
            printGas(utils, mintingTxn)
        }
    };

    console.log('==================== TRANSFER ==================');
        
    console.log(`Total number of addresses to recieve ambassador NFT, ${ambassadors.length}`);
    console.log(`Total number of ens addresses to convert, ${ensAddresses.length}`);

    for (let i = 0; i < ensAddresses.length; i++){
        const resolver = await ethers.provider.getResolver(ensAddresses[i]);
        (resolver.address !== null) ? console.log(resolver.address) : null;
    };
    
    /*
        some number of NFT may be minted to the multisig, and some to the owner address
    */
    const multisig = [
        '0xE9eB95334afe17D9155D2FcE0B7B4f3506A48333',        
    ];

    let tokenCount = 1;
    let gas = BigNumber.from(0);
    
    const totalTokensMinted = await SevenTwentyOne.estimateGas.totalSupply();

    console.log(`transferring ${ambassadors_hex.length} tokens`);
    ambassadors_hex.forEach(a => {        
        console.log(`transferring token ${tokenCount} to ${a}`);
        // tokenCount++;
    });
    
    tokenCount = 0;
    for (let  i = 0; i < ambassadors.length; i++){
        const to = ambassadors[i];
        const from = ethers.provider.getSigner(0);
        const txn: Transaction = await SevenTwentyOne.safeTransferFrom(from, to, tokenCount);
        console.log(`Transfer to ${to}`);
        const gasUsed = txn?.gasLimit.mul(txn?.gasPrice || BigNumber.from('0'));
        console.log(`Gas Used:`, `${utils.formatEther(gasUsed).toString()} ETH`);
        console.log("TxnHash:", txn.hash);
        gas.add(gasUsed);
        (i == ambassadors.length - 1) 
            ? console.log(`Total Gas used (transfers):`, utils.formatEther(gas), 'ETH') 
            : null;
    };       
};

/* We recommend this pattern to be able to use async/await everywhere
  and properly handle errors. */
main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
