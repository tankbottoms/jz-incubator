import { ethers } from 'hardhat';
import { BigNumber, Contract, ContractFactory, utils } from 'ethers';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { ambassadors_ens, ambassadors_hex, reserved_address_tokens } from './addresses';
import { project_config } from './0_config';
import Web3 from 'web3';
import { TransactionResponse } from '@ethersproject/providers';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { PQueue } from '../p-queue';
import fetch from 'cross-fetch';

dotenvConfig({ path: resolve(__dirname, '../.env') });

const multisig = ['0x2187e6a7c765777d50213346F0Fe519fCA706fbD']; 
const totalTokensToMint = 4444;

const web3 = new Web3(process.env.PROVIDER_ENDPOINT as string);

const ALREADY_DEPLOYED_CONTRACT = '0x29D0Dd7817AA0edf252cB49EfD1262b9F8C79Bb8';

async function printGas(utils: any, mintingTxn: TransactionResponse) {
    const tx = await mintingTxn.wait();
    console.log();
    console.log(`Gas limit: ${mintingTxn?.gasLimit.toString()}`);
    console.log(`Gas price: ${mintingTxn?.gasPrice?.toString()}`);
    console.log(`Gas Used: ${utils.formatEther(tx?.gasUsed.mul(mintingTxn?.gasPrice || BigNumber.from('0')))} ETH`);
    console.log('TxnHash:', mintingTxn.hash);
    console.log('=================================================');
    console.log();
    return tx?.gasUsed.mul(mintingTxn?.gasPrice || BigNumber.from('0'));
}

const resolvedENS = {} as Record<string, string>;
async function resolveENS(ens: string) {
    !resolvedENS[ens] && console.log(`Resolving ENS ${ens}...`);
    const address = resolvedENS[ens] || (await web3.eth.ens.getAddress(ens));
    if (address) resolvedENS[ens] = address;
    return address;
}

async function main(): Promise<void> {
    console.log();
    console.log(`Using Wallet: ${await ethers.provider.getSigner().getAddress()}`);
    console.log();
    const { tokenName, tokenSymbol, baseURI, maxTokens, startSale } = project_config;
    const Factory: ContractFactory = await ethers.getContractFactory('SevenTwentyOne');
    console.log(`Token name:${tokenName} (${tokenSymbol})`);
    console.log(`Max tokens:${maxTokens}, startSale:${startSale}`);
    let SevenTwentyOne: Contract;
    if (ALREADY_DEPLOYED_CONTRACT) {
        SevenTwentyOne = new ethers.Contract(
            ALREADY_DEPLOYED_CONTRACT,
            require('../artifacts/contracts/SevenTwentyOne.sol/SevenTwentyOne.json').abi,
            ethers.provider
        );
    } else {
        SevenTwentyOne = await Factory.deploy(tokenName, tokenSymbol, baseURI, maxTokens, startSale);
        const deployed = await SevenTwentyOne.deployed();
        console.log(`Contract deployed to:`, SevenTwentyOne.address);

        const blockHeight = await ethers.provider.getBlockNumber();
        console.log(`Block height is ${blockHeight}`);

        const { deployTransaction } = deployed;
        const { hash, from, to, gasPrice, gasLimit, confirmations } = deployTransaction;

        console.log(`transaction id:${hash}`);
        console.log(`from:${from}, to:${to} - (${confirmations} confirmations)`);
        console.log(gasPrice, gasLimit);
        console.log(
            `Verify using:` +
                `\n` +
                `npx hardhat verify --network rinkeby ` +
                `${SevenTwentyOne.address} ` +
                `"${tokenName}" "${tokenSymbol}" "${baseURI}" "${maxTokens}" "${startSale}"`
        );

        console.log('waiting for 2 confirmations');
        await deployTransaction.wait();

        console.log();
    }

    console.log('==================== MINTING ====================');

    let transfers: { address: string; tokenId?: number; numberOfTokens?: number }[] = [];
    let reserved: typeof transfers = [];
    let otherAddresses = [...ambassadors_hex.concat(ambassadors_ens)];
    let done = new Set();
    let multisigTransfers = 0;

    for (const { address, tokenId: tokenIds } of reserved_address_tokens) {
        for (const tokenId of tokenIds) {
            reserved.push({ address, tokenId });
        }
    }

    for (let tokenId = 0; tokenId < Math.min(totalTokensToMint, maxTokens); tokenId++) {
        try {
            const reservedMatchIndex = reserved.findIndex((tfr) => tfr.tokenId === tokenId);
            if (reservedMatchIndex > -1) {
                //
                const reservedMatch = reserved[reservedMatchIndex];
                reserved[reservedMatchIndex] = null as any;
                reserved = reserved.filter(Boolean);
                //
                let address = reservedMatch.address;
                if (address?.endsWith('.eth')) address = await resolveENS(address);
                transfers.push({ address, numberOfTokens: 1 });
            } else {
                let address = otherAddresses.shift() as string;
                if (address) {
                    if (address?.endsWith('.eth')) address = await resolveENS(address);
                    while (address && done.has(address.toLowerCase())) {
                        address = otherAddresses.shift() as string;
                        if (address?.endsWith('.eth')) address = await resolveENS(address);
                    }
                    if (address) {
                        transfers.push({ address, numberOfTokens: 1 });
                        done.add(address.toLowerCase());
                    } else transfers.push({ address: multisig[0], numberOfTokens: 1 });
                } else transfers.push({ address: multisig[0], numberOfTokens: 1 });
            }
        } catch (error: any) {
            console.error(error.message);
            tokenId--;
        }
    }

    transfers = transfers.slice(0, totalTokensToMint);

    let txs: typeof transfers = [];
    for (const tx of transfers) {
        if (typeof tx.numberOfTokens === 'number') {
            const last = txs.length ? txs[txs.length - 1] : null;
            if (
                last &&
                typeof last.numberOfTokens === 'number' &&
                last.address.toLowerCase() === tx.address.toLowerCase()
            ) {
                last.numberOfTokens = (last.numberOfTokens || 0) + (tx.numberOfTokens || 0);
                continue;
            }
        }
        txs.push(tx);
    }
    transfers = txs;

    await fs.writeFile(path.join(__dirname, './pending_mint_transfers.json'), JSON.stringify(transfers, null, '  '));

    const pqueue = new PQueue({ concurrency: 1 });

    let gas = BigNumber.from(0);

    let transfered: { address: string; numberOfTokens: number }[] = [];

    let tokenCount = 0;
    let failed = false;
    let failedAssetTokens: number[] = [];
    for (const transfer of transfers) {
        pqueue.add(async () => {
            try {
                if (!failed && typeof transfer.numberOfTokens === 'number') {
                    let batches = [];
                    let remaining = transfer.numberOfTokens;
                    const MAX_MINTS_PER_BATCH = 100;
                    do {
                        const batchTokens = Math.min(MAX_MINTS_PER_BATCH, remaining);
                        batches.push(batchTokens);
                        remaining -= batchTokens;
                    } while (remaining > 0);

                    for (const [key, batchTokens] of Object.entries(batches)) {
                        if (false) {
                            const pqueue = new PQueue({ concurrency: 10 });
                            for (let i = tokenCount; i < tokenCount + (transfer.numberOfTokens || 0); i++) {
                                pqueue.add(async () => {
                                    let stoped = failed;
                                    if (!failed && (await verifyTokenAsset(i, SevenTwentyOne))) {
                                    } else if (!failed && (await verifyTokenAsset(i, SevenTwentyOne))) {
                                    } else {
                                        failed = true;
                                        if (!stoped) failedAssetTokens.push(i);
                                    }
                                });
                            }
                            await pqueue.onEmpty();
                            if (failed) {
                                throw Error(`Failed to verify asset for token ${failedAssetTokens.join(', ')}`);
                            }
                        }
                        console.log('Token ID:', tokenCount);
                        batches.length && console.log(`Mint Batch: ${Number(key) + 1} of ${batches.length}`);
                        const estimatedGas = await SevenTwentyOne.estimateGas.mintTokenTransfer(
                            transfer.address,
                            transfer.numberOfTokens
                        );
                        const estimatedGasPrice = await ethers.getDefaultProvider().getGasPrice();
                        console.log(`Estimated Gas: ${utils.formatEther(estimatedGasPrice.mul(estimatedGas))} ETH`);
                        console.log();
                        console.log(
                            `[${tokenCount}] mintTokenTransfer(${transfer.address}, ${transfer.numberOfTokens});`
                        );
                        const txn: TransactionResponse = await SevenTwentyOne.mintTokenTransfer(
                            transfer.address,
                            transfer.numberOfTokens
                        );
                        tokenCount += transfer.numberOfTokens || 0;
                        console.log(`Mint successful for ${transfer.address}`);
                        transfered.push({ address: transfer.address, numberOfTokens: batchTokens });
                        gas = gas.add(txn.gasLimit.mul(txn.gasPrice || BigNumber.from(0)));
                        await printGas(utils, txn);
                        await new Promise((r) => setTimeout(r, 10000));
                    }
                }
            } catch (error: any) {
                console.error(error?.message ? error?.message : error);
                failed = true;
            }
        });
    }

    await pqueue.onEmpty();
    console.log('================================');
    console.log();
    !failed && console.log('ALL DONE');
    console.log('Total gas used (while minting):', Number(utils.formatEther(gas)).toFixed(8), 'ETH');
    console.log();
    console.log('================================');

    if (!failed) {
        if (existsSync(path.join(__dirname, './pending_mint_transfers.json'))) {
            console.log('Removing ./pending_mint_transfers.json');
            await fs.rm(path.join(__dirname, './pending_mint_transfers.json'));
        }
        console.log('Creating ./success_mint_transfers.json');
        await fs.writeFile(
            path.join(__dirname, './success_mint_transfers.json'),
            JSON.stringify(transfered, null, '  ')
        );
    }

    console.log();

    const balanceMultisig = await SevenTwentyOne.balanceOf(multisig[0]);
    console.log(`BalanceOf Multisig: ${balanceMultisig} \n`);

    console.log();
    console.log('================================');
}

/* We recommend this pattern to be able to use async/await everywhere
  and properly handle errors. */
main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });

async function verifyTokenAsset(tokenId: number, contract: Contract) {
    try {
        const baseURI = await contract.baseURI();
        if (!baseURI) throw Error('could not verify token asset (1)');
        if (baseURI) {
            const tokenURI = `${baseURI}${tokenId}`.replace('ipfs://', 'https://ipfs.io/ipfs/');
            console.log(`checking asset for token ${tokenURI}`);
            let response = await fetch(tokenURI);
            const jsonResponse = await response.json();
            if (!jsonResponse?.image) throw Error('could not verify token asset (2)');
            response = await fetch(jsonResponse?.image);
            if (response.ok && response.status >= 200 && response.status < 400) return true;
            return false;
        }
    } catch (error: any) {
        false && console.error(`ERROR: ${error?.message}`);
        return false;
    }
}
