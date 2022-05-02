/* eslint-disable no-unused-expressions */
import { config } from 'dotenv';
import { bool, cleanEnv, num, str } from 'envalid';
import { resolve } from 'path';

config({ path: resolve(__dirname, './.env') });

export const BLANK = '';
export const ETH = 'Ξ';
export const MAINNET_ALCHEMY_KEY = process.env?.MAINNET_ALCHEMY_API_KEY;
export const PROVIDER_ENDPOINT =
  process.env?.PROVIDER_ENDPOINT || `https://eth-mainnet.alchemyapi.io/v2/${MAINNET_ALCHEMY_KEY}`;
export const FREEROSSDAO = {
  address: '0xc102d2544a7029f7BA04BeB133dEADaA57fDF6b4',
  deployed_block: 13_724_221,
  auction_end_block: 13_770_208,
};

const USDC_CONTRACT = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const DAI_CONTRACT = '0x6b175474e89094c44da98b954eedeac495271d0f';

export const environment = cleanEnv(process.env, {
  NODE_ENV: str({
    default: 'development',
    choices: ['development', 'test', 'production', 'staging'],
  }),
  VERBOSE: bool({ default: true }),
  /* only for deployment */
  PUBLIC_KEY: str({ default: BLANK }),
  PRIVATE_KEY: str({ default: BLANK }),
  INFURA_API_KEY: str({ default: BLANK }),
  ETHERSCAN_API_KEY: str({ default: BLANK }),
  MAINNET_ALCHEMY_API_KEY: str({ default: BLANK }),
  ROPSTEN_ALCHEMY_API_KEY: str({ default: BLANK }),
  RINKEBY_ALCHEMY_API_KEY: str({ default: BLANK }),
  REPORT_GAS: bool({ default: true }),
  GANACHE: str({ default: 'ganache-cli --account "BLANK' }),
  /* for snapshot */
  PROVIDER_ENDPOINT: str({ default: PROVIDER_ENDPOINT }),
  SAFE_ADDRESS: str({ default: FREEROSSDAO.address }),
  /* envalid's num does not understand underscores in numbers via env */
  SAFE_DEPLOYED_IN_BLOCK: num({ default: FREEROSSDAO.deployed_block }),
  AUCTION_ENDED_IN_BLOCK: num({ default: FREEROSSDAO.auction_end_block }),
  BLOCKS_PER_CHUNK: num({ default: 100 }),
  SNAPSHOT_FILENAME: str({
    default: process.env?.SAFE_ADDRESS ? `${process.env?.SAFE_ADDRESS}-snapshot.csv` : 'snapshot.csv',
  }),
  NEXT_BLOCK_INFO: str({
    default: process.env?.SAFE_ADDRESS ? `.${process.env?.SAFE_ADDRESS}-next.json` : '.next.json',
  }),
  MERKLE_DISTRIBUTOR: bool({ default: false }),
  DAI_CONTRACT: str({ default: USDC_CONTRACT }),
  CRYPTOQUANT_API_KEY: str({ default: '' }),
});

!environment.isProduction ? console.log(environment) : null;
