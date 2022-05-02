import '@typechain/hardhat';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { chainIds } from '../utils/chainId';

dotenvConfig({ path: resolve(__dirname, '../.env') });

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

export const createConfig = (network: keyof typeof chainIds): any => {
  const url = `https://eth-${network}.alchemyapi.io/v2/` + `${process.env[`${network.toUpperCase()}_ALCHEMY_API_KEY`]}`;
  return {
    accounts: [`0x${PRIVATE_KEY}`],
    chainId: chainIds[network],
    url,
  };
};
