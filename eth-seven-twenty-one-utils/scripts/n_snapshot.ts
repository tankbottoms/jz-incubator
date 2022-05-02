import * as dotenv from 'dotenv';
import { resolve } from 'path';
import fetch from 'node-fetch';
import * as fs from 'fs';

export async function queryTransactions(startBlock: number, endBlock: number, contracts: string[], pageKey?: string) {
    const query = JSON.stringify({
        "jsonrpc": "2.0",
        "id": 0,
        "method": "alchemy_getAssetTransfers",
        "params": [
            {
                fromBlock: `0x${startBlock.toString(16)}`,
                toBlock: `0x${endBlock.toString(16)}`,
                contractAddresses: contracts,
                maxCount: `0x${(100).toString(16)}`,
                category: [ "erc721", "erc1155" ],
                pageKey
            }
        ]
    });

    let resultPageKey = '';
    const addresses: string[] = await fetch(`https://eth-mainnet.alchemyapi.io/v2/${process.env['MAINNET_ALCHEMY_API_KEY']}`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: query
        })
    .then(response => response.json())
    .then(data => {
        if (data['result']['pageKey']) {
            resultPageKey = data['result']['pageKey'];
        }
        return data['result']['transfers'].map((r: any) => r['to']);
    })
    .catch(error => console.log('error', error));

    let addressMap: any = { };
    addresses.map(a => { addressMap[a] ? addressMap[a] += 1: addressMap[a] = 1; });
    if (resultPageKey) {
        const extraResults = await queryTransactions(startBlock, endBlock, contracts, resultPageKey);
        for (const k of Object.keys(extraResults)) {
            addressMap[k] ? addressMap[k] += 1: addressMap[k] = 1;
        }
    }

    return addressMap;
}

/**
 * Retrieves block metadata and returns the timestamp.
 */
export async function getBlockTimestamp(level: number | 'latest'): Promise<{timestamp: number, blockLevel: number}> {
    const [ timestamp, blockLevel ] = await fetch(`https://eth-mainnet.alchemyapi.io/v2/${process.env['MAINNET_ALCHEMY_API_KEY']}`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBlockByNumber", params: [ level === 'latest' ? level : `0x${(level).toString(16)}`, false ], id: 0 })
    }).then(response => {
        return response.json();
    }).then(data => {
        return [ Number(data['result']['timestamp']) * 1000, Number(data['result']['number'])];
    }).catch(e => {
        console.log(`error at ${level}`, e);
        return [ -1, -1 ];
    });

    return { timestamp, blockLevel };
}

/**
 * Makes a reasonable guess about block level given a timestamp.
 */
export async function estimateBlockLevel(timestamp: Date): Promise<number> {
    if (timestamp.getTime() > Date.now()) {
        return -1;
    }

    const head = await getBlockTimestamp('latest');
    let estimateLevel = head.blockLevel - Math.ceil((head.timestamp - timestamp.getTime()) / 15_000);
    let estimateBlock = await getBlockTimestamp(estimateLevel);
    if (estimateBlock.blockLevel === -1) { throw new Error(`failed to get timestamp for block ${estimateLevel}`); }
    let timestampDiff = timestamp.getTime() - estimateBlock.timestamp;

    let q = 1;
    while (Math.abs(timestampDiff) > 20_000) {
        estimateLevel = estimateBlock.blockLevel - Math.ceil((estimateBlock.timestamp - timestamp.getTime()) / 15_000);
        estimateBlock = await getBlockTimestamp(estimateLevel);
        timestampDiff = timestamp.getTime() - estimateBlock.timestamp;
        // console.log(estimateBlock.blockLevel, timestampDiff, q)
        q++;
    }

    console.log(estimateBlock.blockLevel, new Date(estimateBlock.timestamp), q)
    return estimateBlock.blockLevel;
}

async function main(): Promise<void> {
    dotenv.config({ path: resolve(__dirname, '../.env') });

    if (!fs.existsSync('scripts/snapshot_config.json')) { return; }
    let config = JSON.parse(fs.readFileSync('scripts/snapshot_config.json', 'utf8'));

    let startBlock = -1;
    let endBlock = -1;

    if (config['startBlock']) {
        startBlock = Number(config['startBlock']);
    } else {
        startBlock = await estimateBlockLevel(new Date(config['startTime']));
    }

    if (config['endBlock'] && config['endBlock'] === 'latest') {
        endBlock = (await getBlockTimestamp('latest')).blockLevel;
    } else if (config['endBlock']) {
        endBlock = (await getBlockTimestamp(Number(config['endBlock']))).blockLevel;
    } else {
        endBlock = await estimateBlockLevel(new Date(config['endTime']));
    }

    const addressMap = await queryTransactions(startBlock, endBlock, config['contracts']);
    fs.writeFileSync(config['output'], JSON.stringify(addressMap));
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });
