/* eslint-disable no-unused-vars */
/* eslint-disable camelcase */
/* eslint-disable no-unused-expressions */
import { BigNumber, ethers } from 'ethers';
import { formatEther } from '@ethersproject/units';
import { parse, stringify } from 'csv/sync';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { PQueue } from '../p-queue';
import { logger } from '../utils';
import { CEX_OVERRIDES } from '../example-data/cex-overrides';
import { environment } from '../environment';

import { Command } from 'commander';
import { Provider } from 'ethers/node_modules/@ethersproject/abstract-provider';
const program = new Command();

const {
  NODE_ENV,
  PROVIDER_ENDPOINT,
  SAFE_ADDRESS,
  SAFE_DEPLOYED_IN_BLOCK,
  AUCTION_ENDED_IN_BLOCK,
  BLOCKS_PER_CHUNK,
  SNAPSHOT_FILENAME,
  NEXT_BLOCK_INFO,
  DAI_CONTRACT,
} = environment;

let erc20TokenSymbol = '';

type Snapshot = {
  [txnHash: string]: {
    sender: string;
    value: ethers.BigNumber;
    blockNumber: number;
    timestamp: number;
    coin: string;
  };
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const event_concurrency = 1;
const verbosity = environment.VERBOSE;
const provider = new ethers.providers.JsonRpcProvider(PROVIDER_ENDPOINT as string);
const pause_per_block = 1_000;

const process_queue = new PQueue({ concurrency: event_concurrency });
let snapshot: Snapshot;

const daiContract = new ethers.Contract(
  environment.DAI_CONTRACT,
  [
    `event Transfer(address indexed sender, address indexed receiver, uint256 value)`,
    {
      constant: true,
      inputs: [],
      name: 'symbol',
      outputs: [{ name: '', type: 'string' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
    {
      constant: true,
      inputs: [],
      name: 'decimals',
      outputs: [{ name: '', type: 'uint8' }],
      payable: false,
      stateMutability: 'view',
      type: 'function',
    },
  ],
  provider
);

function readFromSnapshot(filename: string): Snapshot {
  if (!existsSync(filename)) return {};
  const data = parse(readFileSync(filename), { columns: true }) as {
    txnHash: string;
    sender: string;
    value: string;
    blockNumber: number;
    timestamp: number;
    coin: string;
  }[];
  return data.reduce<Snapshot>((memo, { txnHash, sender, value, blockNumber, timestamp, coin }) => {
    memo[txnHash] = {
      sender,
      value: ethers.BigNumber.from(value),
      blockNumber,
      timestamp,
      coin,
    };
    return memo;
  }, {});
}

function writeToSnapshot(snapshot: Snapshot, filename: string) {
  writeFileSync(
    filename,
    stringify(
      Object.keys(snapshot).map((txnHash: string) => ({
        txnHash,
        sender: snapshot[txnHash].sender,
        value: snapshot[txnHash].value.toString(),
        blockNumber: snapshot[txnHash].blockNumber,
        timestamp: snapshot[txnHash].timestamp,
        coin: snapshot[txnHash].coin,
      })),
      {
        header: true,
      }
    )
  );
}

function getNextBlock(startBlock: number) {
  if (!existsSync(NEXT_BLOCK_INFO)) return startBlock;
  return JSON.parse(readFileSync(NEXT_BLOCK_INFO).toString()).next;
}

function setNextBlock(next: number) {
  writeFileSync(NEXT_BLOCK_INFO, JSON.stringify({ next }));
}

const getNetworkStatus = async (provider: Provider) => {
  verbosity ? logger.info(`Connected to:${PROVIDER_ENDPOINT}, Network:${JSON.stringify(provider)}`) : null;
  let resolve: Function;
  const promise = new Promise((r) => (resolve = r));
  let i = 0;
  provider.getBlockNumber().then((blockNumber: any) => {
    logger.info(`current block number:${blockNumber}`);
    check(++i);
  });
  provider.getGasPrice().then((gasPrice) => {
    logger.info(`current gas price:${formatEther(gasPrice)} ETH`);
    check(++i);
  });
  function check(i: number) {
    if (i === 2) resolve();
  }
  logger.info(`queue concurrency:${event_concurrency}, block per chunk:${BLOCKS_PER_CHUNK}`);
  await promise;
};

async function main(
  startBlock: number,
  endBlock: number,
  chunkSize: number,
  contractAddress: string,
  outputFilename: string,
  override: boolean
) {
  const safe = new ethers.Contract(
    contractAddress,
    ['event SafeReceived(address indexed sender, uint256 value)'],
    provider
  );

  erc20TokenSymbol = await daiContract.symbol();
  let concatDecimals = Array(18 - Math.min(await daiContract.decimals(), 18))
    .fill('0')
    .join('');

  snapshot = readFromSnapshot(outputFilename) as Snapshot;
  verbosity ? logger.info(`Snapshot has ${Object.keys(snapshot).length} entries.`) : null;

  await getNetworkStatus(provider);

  const fromBlock = getNextBlock(startBlock);
  const toBlock = Number(endBlock);

  verbosity ? logger.info(`snapshotting from ${fromBlock} to ${toBlock}`) : null;

  const ethfilter = safe.filters.SafeReceived();
  const daifilter = daiContract.filters.Transfer();

  const handleContribution = async (event: ethers.Event) => {
    if (!event || !event.args) return;
    const sender = event.args.sender as string;
    const receiver = event.args.receiver as string;
    const value = ethers.BigNumber.from(event.args.value);
    const timestamp = new Date(((await event.getBlock()).timestamp ?? 0) * 1_000);
    const coin = receiver ? erc20TokenSymbol : 'ETH';
    const txnHash = event.transactionHash;
    const block = event.blockNumber;
    if (sender && txnHash && timestamp) {
      logger.info(`(${block}) ${sender} sent ${formatEther(value + (coin === 'ETH' ? '' : concatDecimals))} ${coin}`);
      snapshot[txnHash] = {
        sender: sender,
        value: BigNumber.from(value.toString() + (coin === 'ETH' ? '' : concatDecimals)),
        timestamp: timestamp.getTime(),
        blockNumber: block,
        coin: coin,
      };
    }
  };

  let lastChunkNumber = 0;
  for (let i = fromBlock; i <= toBlock; i = i + chunkSize) {
    const fromChunkNumber = i;
    const toChunkNumber = Math.min(fromChunkNumber + chunkSize - 1, toBlock) || fromChunkNumber + 1;
    try {
      const ethEvents = await safe.queryFilter(ethfilter, fromChunkNumber, toChunkNumber);
      const daiEvents = await daiContract.queryFilter(daifilter, fromChunkNumber, toChunkNumber);
      const releventDaiEvents = daiEvents.filter((event) => event.args?.receiver === contractAddress);
      const events = [...ethEvents, ...releventDaiEvents].filter(Boolean);
      verbosity && events.length !== 0
        ? logger.info(`blocks ${fromChunkNumber} => ${toChunkNumber} ` + `contains ${events.length} events`)
        : logger.info(`blocks ${fromChunkNumber} => ${toChunkNumber} are empty`);

      for (let index = 0; index < events.length; index++) {
        const event: ethers.Event = events[index];
        const eventBlock = await event.getBlock();

        if (!event.args?.sender || !event.args?.value) {
          logger.info('Invalid event??', event);
          return;
        }

        const sender = CEX_OVERRIDES[event.transactionHash] ?? (event.args.sender as string);
        const value = event.args.value as ethers.BigNumber;

        if (CEX_OVERRIDES[event.transactionHash]) {
          logger.info(
            `remapping tx ${event.transactionHash} for ${ethers.utils.formatEther(value)} ETH from ${
              event.args.sender
            } to ${CEX_OVERRIDES[event.transactionHash]}`
          );
        }

        process_queue
          .add(async () => await handleContribution(event))
          .then(() => {
            writeToSnapshot(snapshot, outputFilename);
          });

        verbosity && lastChunkNumber !== toChunkNumber && logger.info(`setting next to ${toChunkNumber + 1}`);
        setNextBlock(toChunkNumber + 1);
        lastChunkNumber = toChunkNumber;
      }
      !pause_per_block && (await sleep(pause_per_block));
    } catch (error) {
      logger.error(error);
      break;
    }
  }
  logger.info('writing to snapshot.csv');
  writeToSnapshot(snapshot, outputFilename);
}

const parseDec = (n: string) => parseInt(n, 10);

program.version('0.0.1');
program
  .option('-s, --start <block>', 'start block', parseDec, SAFE_DEPLOYED_IN_BLOCK)
  .option('-e, --end <block>', 'end block', parseDec, AUCTION_ENDED_IN_BLOCK)
  .option('--chunk <number>', 'blocks per chunk', parseDec, BLOCKS_PER_CHUNK)
  .option('-a, --address <address>', 'address', SAFE_ADDRESS)
  .option('-o, --output <filename>', 'output filename', 'ledger.csv')
  .option('--override', 'use manual overrides?', true);

program.parse(process.argv);

const options = program.opts();

process.on('SIGINT', () => {
  logger.info('writing to snapshot.csv');
  writeToSnapshot(snapshot, options.output);
  logger.info('received SIGINT, exiting gracefully');
  process.exit();
});

main(options.start, options.end, options.chunk, options.address, options.output, options.override)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error(error?.message);
    process.exit(1);
  });
