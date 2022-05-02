/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */
import { ethers } from 'hardhat';
import { Contract, ContractFactory } from 'ethers';
import { config as dotenvConfig } from 'dotenv';
import { execSync } from 'child_process';
import { BondingCurveToken, BondingCurveVault, BancorFormula, BondingCurve } from '../typechain';
import { resolve } from 'path';

dotenvConfig({ path: resolve(__dirname, '../.env') });

export const getTime = () => Date.now();
export const getElapsed = (now: number) => Date.now() - now;
const now = getTime();

export const deploy_contract = async (contractName: string) => {
  const timer = getTime();
  const Factory: ContractFactory = await ethers.getContractFactory(contractName);
  const DeployedContract: Contract = await Factory.deploy();
  const deployed = await DeployedContract.deployed();
  process.stdout.write(`${DeployedContract.address} (${getElapsed(timer)} ms)` + '\n');
  false && console.log(deployed); // prints the entire contract object, including bytecode
  const { deployTransaction } = deployed;
  const { hash, from, gasPrice, gasLimit, data, chainId, confirmations } = deployTransaction;
  gasPrice !== undefined && gasLimit !== undefined
    ? console.log(
        `Owner:${from}, gas:${gasPrice.toNumber()}, ` +
          `gas limit:${gasLimit.toNumber()} (${confirmations} confirmations)`
      )
    : null;
  console.log('Queuing "npx hardhat verify --network rinkeby ' + `${DeployedContract.address}"`);
  return 'npx hardhat verify --network rinkeby ' + `${DeployedContract.address}`;
};

async function main(): Promise<void> {
  const contracts = ['BondingCurveToken', 'BancorFormula', 'BondingCurveVault', 'BondingCurve'];
  const verifications: string[] = [];

  try {
    for (const contract of contracts) {
      process.stdout.write(`${contract}...`);
      const verification = await deploy_contract(contract);
      verifications.push(verification);
    }
    verifications.forEach(async (v: any) => {
      const stdout = await execSync(v);
      console.log(stdout.toString());
    });
  } catch (e) {
    console.error(e);
  }
}

/* We recommend this pattern to be able to use async/await everywhere
  and properly handle errors. */
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
