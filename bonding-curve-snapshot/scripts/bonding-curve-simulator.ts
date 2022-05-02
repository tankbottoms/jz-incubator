/* eslint-disable no-unused-vars */
/* eslint-disable camelcase */
/* eslint-disable no-undef */
/* eslint-disable quote-props */
//  @ts-nocheck
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import hre from 'hardhat';
import { toWei, fromWei, toBN } from 'web3-utils';
import { writeFileSync, readFileSync } from 'fs';
import { parse } from 'csv/sync';
import { numberWithCommas } from '../utils';
import { Command } from 'commander';
import axios from 'axios';
import { utils } from 'ethers';
const program = new Command();

const advanceTime = async (time: number) => {
  await hre.ethers.provider.send('evm_increaseTime', [time]);
  await hre.ethers.provider.send('evm_mine', []);
  return true;
};

const log = (...data) => {
  console.log(data.join(''));
};

const { deployContract } = hre.waffle;

let BancorFormula: BancorFormula;
let BondingCurve: BondingCurve;
let Endowment: Endowment;
let DaoRegistry: DaoRegistry;
let IBondingCurveToken: IBondingCurveToken;
let lastETH2USD: 0;

const ZERO_TOKEN = '0x0000000000000000000000000000000000000000';

const tokens = {
  eth: {
    symbol: 'Ξ',
    type: 'eth',
    address: ZERO_TOKEN,
  },
  dai: {
    symbol: 'DAI',
    type: 'stablecoin',
    address: ZERO_TOKEN,
  },
};

const buyInformation = [];

async function deployContacts(signer: SignerWithAddress) {
  log(`
    ############################################################
    #                   Deploy Contracts                       #                                       
    ############################################################  
  `);

  BancorFormula = (await deployContract(signer, await hre.artifacts.readArtifact('BancorFormula'))) as BancorFormula;
  log(`Deployed BancorFormula to the following address => ${BancorFormula.address}`);

  BondingCurve = (await deployContract(signer, await hre.artifacts.readArtifact('BondingCurve'))) as BondingCurve;
  log(`Deployed BondingCurve to the following address => ${BondingCurve.address}`);

  Endowment = (await deployContract(signer, await hre.artifacts.readArtifact('Endowment'))) as Endowment;
  log(`Deployed Endowment to the following address => ${Endowment.address}`);

  DaoRegistry = (await deployContract(signer, await hre.artifacts.readArtifact('DaoRegistry'))) as DaoRegistry;
  log(`Deployed DaoRegistry to the following address => ${DaoRegistry.address}`);
}

async function initializeCurve(signer: SignerWithAddress) {
  const currentBlockNum = await hre.ethers.provider.getBlockNumber();
  const currentBlock = await hre.ethers.provider.getBlock(currentBlockNum);
  const { timestamp } = currentBlock;

  await BondingCurve.initialize(DaoRegistry.address, signer.address);

  await BondingCurve.initializeCurve(
    BancorFormula.address, // _formula
    DaoRegistry.address, // _movement
    Endowment.address, // _endowment
    toWei('1'), // _initiative_goal
    Endowment.address, // _beneficiary
    '0', // _buyFeePct
    '0', // _sellFeePct
    timestamp + 1000, // _timeStart
    timestamp + 100000, // _timeCooldown
    timestamp + 10000000 // _timeEnd
  );

  log(`
    ############################################################
    #                   Initialize Curve                       #                                       
    ############################################################  
  `);

  log('Bonding curve initialization parameters:');
  log(`Formula: ${BancorFormula.address}`);
  log(`Movement: ${DaoRegistry.address}`);
  log(`Endowment: ${Endowment.address}`);
  log(`Initiative_goal: ${toWei('1')}`);
  log(`Beneficiary: ${Endowment.address}`);
  log(`BuyFeePct: ${0}`);
  log(`SellFeePct: ${0}`);
  log(`TimeStart: ${timestamp + 1_000}`);
  log(`TimeCooldown: ${timestamp + 100_000}`);
  log(`TimeEnd: ${timestamp + 10_000_000}`);
}

async function addCollateralToken(
  _token: object,
  _virtualSupply: string,
  _virtualBalance: string,
  _reserveRatio: string
) {
  await BondingCurve.addCollateralToken(_token.address, _virtualSupply, _virtualBalance, _reserveRatio);

  const byDAI = toWei('1').toString();
  const staticPrice = await BondingCurve.evaluateBuyOrder(_token.address, byDAI);

  log(`
  ############################################################
  #                   Add collateral token                   #                                       
  ############################################################  
  `);

  const onePrice = +byDAI / +staticPrice;

  const collateralToken = await BondingCurve.collaterals(_token.address);

  log(`Zero Token: ${_token.address}`);
  log(`Token Parameters: ${collateralToken}`);
  log(`Price 1 token = ${onePrice.toFixed(18)} ${_token.symbol}`);
  const timestamp = Date.now() / 1000;
  const usd = await exchangeRate(timestamp - 86400);
  log(`Price 1 token in USD = ${(onePrice * usd).toFixed(18)} USD`);
}

async function swapDaiToEth(value: string, timestamp: number) {
  const exchangePriceDai = await exchangeRate(timestamp / 1000, 'stablecoin');
  const exchangePriceEth = await exchangeRate(timestamp / 1000);
  console.log({ exchangePriceDai, exchangePriceEth });
  const val = (+fromWei(value) * exchangePriceDai) / exchangePriceEth;
  if (Math.floor(val) > 0) {
    return toWei(Math.floor(val).toString());
  } else {
    return Math.floor(val * 1e18);
  }
}

async function swapEthToDai(value: string, timestamp: number) {
  const exchangePriceDai = await exchangeRate(timestamp / 1000, 'stablecoin');
  const exchangePriceEth = await exchangeRate(timestamp / 1000);
  const val = (+fromWei(value) * exchangePriceEth) / exchangePriceDai;

  if (Math.floor(val) > 0) {
    return toWei(Math.floor(val).toString());
  } else {
    return Math.floor(val * 1e18);
  }
}

async function makeByOrder(
  file: string,
  swap: string,
  signer: SignerWithAddress,
  token: object,
  count: number,
  exchangeToken: object
) {
  log(`
  ############################################################
  #                   Make Buy Order                         #                                       
  ############################################################  
  `);
  await advanceTime(10000);
  const rawData = readFileSync(file, 'utf8');
  const accounts = parse(rawData, { delimiter: ',' }).filter((item) => item[2] > 0);
  for (let index = 0; index < count ? count : accounts.length; index++) {
    if (!accounts[index]) return;
    const [txnHash, address, value, blockNumber, timestamp, coin] = accounts[index];

    let byed: any;
    let val: any;
    let usd = await exchangeRate(timestamp / 1000, token.type);

    const staticStartPrice = await BondingCurve.evaluateBuyOrder(token.address, toWei('1').toString());
    const startPrice = +toWei('1').toString() / +staticStartPrice;

    let valueBuy = 0;

    if (swap === 'eth/dai') {
      if (coin.toLowerCase() === 'dai') {
        valueBuy = await swapDaiToEth(value, timestamp);
        byed = await BondingCurve.connect(signer).makeBuyOrder(address, token.address, valueBuy.toString(), '100', {
          value: valueBuy.toString(),
        });
        val = toBN(valueBuy);
      } else {
        byed = await BondingCurve.connect(signer).makeBuyOrder(address, token.address, value, '100', {
          value,
        });
        val = toBN(value);
      }
    }

    if (swap === 'dai/eth') {
      if (coin.toLowerCase() === 'eth') {
        valueBuy = await swapEthToDai(value, timestamp);
        byed = await BondingCurve.connect(signer).makeBuyOrder(address, ZERO_TOKEN, valueBuy.toString(), '100', {
          value: valueBuy.toString(),
        });
        val = toBN(valueBuy);
      } else {
        byed = await BondingCurve.connect(signer).makeBuyOrder(address, ZERO_TOKEN, value, '100', {
          value,
        });
        val = toBN(value);
      }
    }

    const byedTransaction = await byed.wait();
    const blockInfo = await hre.ethers.provider.getBlock(byedTransaction.blockNumber);

    const receipt = byedTransaction.events?.filter((x) => {
      return x.event === 'MakeBuyOrder';
    })[0].args;

    const returnedAmount = receipt?.returnedAmount.toString();
    const exchangeRateETH = +receipt?.purchaseAmount / +receipt?.returnedAmount;

    const staticEndPrice = await BondingCurve.evaluateBuyOrder(token.address, toWei('1').toString());
    const endPrice = +toWei('1').toString() / +staticEndPrice;

    log(`(${index + 1}) Start token price = ${startPrice.toFixed(18)} ${token.name}, ${startPrice * usd} $`);
    log(
      `(${index + 1}) Block: ${blockInfo.number}, Timestamp: ${blockInfo.timestamp}, ${address} bought tokens with ${
        token.name
      } ${fromWei(val.toString())} ($ ${numberWithCommas(+fromWei(val.toString()) * usd)}), ` +
        `received ${numberWithCommas(fromWei(returnedAmount).toString())} $TOKENS, ${numberWithCommas(
          +exchangeRateETH.toString() * usd
        )} USD/$TOKEN, ${exchangeRateETH.toFixed(18)} ${token.name}/$TOKEN`
    );
    log(`(${index + 1}) End token price = ${endPrice.toFixed(18)} ${token.name}, ${(endPrice * usd).toFixed(18)} $\n`);

    lastETH2USD = usd;

    buyInformation.push({
      address,
      token_name: token.name,
      value: val.toString(),
      valueToUsd: +fromWei(val.toString()) * usd,
      returnedAmount,
      exchangeRate: exchangeRateETH,
      exchangeRateUSD: +exchangeRateETH.toString() * usd,
      block: blockNumber,
      timestamp,
    });
  }
}

function timestampConvert(timestamp: number) {
  const date = new Date(timestamp * 1_000);
  const year = date.getFullYear();
  const month = date.getMonth() < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1;
  const day = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
  return `${year}${month}${day}`;
}

async function exchangeRate(timestamp: number, token = 'eth') {
  const from = timestampConvert(timestamp);
  try {
    const uri =
      token === 'eth'
        ? `https://api.cryptoquant.com/v1/eth/market-data/price-ohlcv?window=day&from=20191001&limit=10`
        : `https://api.cryptoquant.com/v1/stablecoin/market-data/price-ohlcv?token=usdt_eth&window=day&from=${from}&limit=10`;
    const { data } = await axios.get(uri, {
      params: {
        api_key: process.env.CRYPTOQUANT_API_KEY,
      },
    });
    return data.result.data.pop().close;
  } catch (err) {
    console.error('Error api fetch: ', err?.message);
  }
}

async function writeFile(file: string, token_name: string) {
  log(`
    ############################################################
    #                  Writing csv file                        #                                       
    ############################################################  
  `);
  const accounts = [
    [
      'Buyer Address',
      'Token',
      `Buy ${token_name}`,
      `Buy USD`,
      'Return Tokens',
      'Return Tokens (fromWei)',
      'Token price',
      'Token price USD',
      'Block',
      'Timestamp',
    ],
  ];
  const merkleData = {};

  for (let i = 0; i < buyInformation.length; i++) {
    const a = buyInformation[i];
    accounts.push([
      a.address,
      a.token_name,
      fromWei(a.value.toString()).toString(),
      a.valueToUsd,
      a.returnedAmount,
      fromWei(a.returnedAmount),
      a.exchangeRate,
      a.exchangeRateUSD,
      a.block,
      a.timestamp,
    ]);
    merkleData[a.address] = a.returnedAmount;
  }
  const lineArray: string[] = [];
  accounts.forEach(function (infoArray) {
    const line = infoArray.join(',');
    lineArray.push(line);
  });
  const csvContent = lineArray.join('\n');
  writeFileSync(file, csvContent);
  writeFileSync(file.replace('.csv', '.json'), JSON.stringify(merkleData));
  log('Write csv file successful!');
}

async function main(
  type: string,
  virtual_supply: string,
  virtual_balance: string,
  reserve_ratio: string,
  count: number,
  input: string,
  output: string
): Promise<void> {
  const signers: SignerWithAddress[] = await hre.ethers.getSigners();

  const [token_alias, token_exchange_alias] = type.split('/');

  const token = { ...tokens[token_alias], name: token_alias };
  const exchangeToken = { ...tokens[token_exchange_alias], name: token_exchange_alias };

  await deployContacts(signers[0]);
  await initializeCurve(signers[0]);
  await addCollateralToken(token, toWei(virtual_supply).toString(), toWei(virtual_balance).toString(), reserve_ratio);

  await makeByOrder(input, type, signers[0], token, count, exchangeToken);

  await writeFile(output, token_alias);

  log(`
  ############################################################
  #                          Summary                         #                                       
  ############################################################  
  `);
  const bondingCurveToken = await BondingCurve.bondingToken();
  IBondingCurveToken = await hre.ethers.getContractAt('BondingCurveToken', bondingCurveToken);

  const token_distribution = {
    Total: { total: 0, percentage: 100 },
    'Endowment seed': { gnosis: '0x143cC0A996De329C1C5723Ee4F15D2a40c1203c6', total: 0, percentage: 20 },
    'Public endowment contributors': { gnosis: '0x143cC0A996De329C1C5723Ee4F15D2a40c1203c6', total: 0, percentage: 20 },
    Airdrops: { gnosis: '0x143cC0A996De329C1C5723Ee4F15D2a40c1203c6', total: 0, percentage: 30 },
    Staking: { gnosis: '0xfE021e62637Cf8B880a76b09E94904693D38256A', total: 0, percentage: 10 },
    'Liquidity Pools': { gnosis: '0x607d56643673649bd25AA47325A7a6AFeffc3B4a', total: 0, percentage: 20 },
    Treasury: { gnosis: '0x2187e6a7c765777d50213346F0Fe519fCA706fbD', total: 0, percentage: 0 }, // remaining tokens
  };

  const tokenTotalSupply = await IBondingCurveToken.totalSupply();
  const airdrops = toBN(tokenTotalSupply.toString()).mul(toBN(40)).div(toBN(100));
  const staking = toBN(tokenTotalSupply.toString()).mul(toBN(10)).div(toBN(100));
  const lp = toBN(tokenTotalSupply.toString()).mul(toBN(20)).div(toBN(100));

  token_distribution.Total.total = tokenTotalSupply.toString();
  token_distribution['Endowment seed'].total = toBN(tokenTotalSupply.toString())
    .mul(toBN(token_distribution['Endowment seed'].percentage))
    .div(toBN(100))
    .toString();
  token_distribution['Public endowment contributors'].total = toBN(tokenTotalSupply.toString())
    .mul(toBN(token_distribution['Public endowment contributors'].percentage))
    .div(toBN(100))
    .toString();
  token_distribution.Airdrops.total = toBN(tokenTotalSupply.toString())
    .mul(toBN(token_distribution.Airdrops.percentage))
    .div(toBN(100))
    .toString();
  token_distribution.Staking.total = toBN(tokenTotalSupply.toString())
    .mul(toBN(token_distribution.Staking.percentage))
    .div(toBN(100))
    .toString();
  token_distribution['Liquidity Pools'].total = toBN(tokenTotalSupply.toString())
    .mul(toBN(token_distribution['Liquidity Pools'].percentage))
    .div(toBN(100))
    .toString();
  token_distribution.Treasury.total = toBN(tokenTotalSupply.toString())
    .mul(toBN(token_distribution.Treasury.percentage))
    .div(toBN(100))
    .toString();

  const summary = {
    'Total supply': {
      value: `${+fromWei(
        buyInformation.reduce((partialsum, info) => toBN(partialsum).add(toBN(info.value)), 0).toString()
      )} ${token_alias}`,
    },
    'Total supply USD': {
      value: `${numberWithCommas(
        +fromWei(buyInformation.reduce((partialsum, info) => toBN(partialsum).add(toBN(info.value)), 0).toString()) *
          lastETH2USD
      )} $`,
    },
    'Total minted tokens': {
      value: numberWithCommas(utils.formatEther(tokenTotalSupply.toString())),
      percentage: '100 %',
    },
    'Airdrop budget': {
      value: numberWithCommas(utils.formatEther(airdrops.toString())),
      percentage: '40 %',
    },
    'Staking incentives': {
      value: numberWithCommas(utils.formatEther(staking.toString())),
      percentage: '10 %',
    },
    'Liquidity pool': {
      value: numberWithCommas(utils.formatEther(lp.toString())),
      percentage: '20 %',
    },
    Treasury: {
      value: numberWithCommas(utils.formatEther(toBN(tokenTotalSupply).sub(airdrops).sub(staking).sub(lp).toString())),
      percentage: '30 %',
    },
  };
  console.table(summary);
  process.stdout.write('\n');

  false && console.table(token_distribution);
}

/* We recommend this pattern to be able to use async/await everywhere
  and properly handle errors. */
program.version('0.0.1');
program
  .option('--type <string>', 'Convert eth/dai or dai/eth', 'eth/dai')
  .option('-vs, --virtual_supply <string>', 'virtual-supply', '5')
  .option('-vb, --virtual_balance <string>', 'virtual-balance', '4')
  .option('-r, --reserve_ratio <string>', 'reserve-ratio', '150000')
  .option('-c, --count <number>', 'count accounts', 0)
  .option('-i, --input <file path>', 'input file', './ledger.csv')
  .option('-o, --output <file path>', 'output file', 'accountsData.csv');

program.parse(process.argv);
const options = program.opts();

process.on('SIGINT', async () => {
  writeFile(options.output, options.token_name);

  const bondingCurveToken = await BondingCurve.bondingToken();
  IBondingCurveToken = await hre.ethers.getContractAt('BondingCurveToken', bondingCurveToken);

  await summary(IBondingCurveToken, options.token_name);

  process.exit(0);
});

main(
  options.type,
  options.virtual_supply,
  options.virtual_balance,
  options.reserve_ratio,
  +options.count,
  options.input,
  options.output
)
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
