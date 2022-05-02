/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-undef */
import hre from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { writeFileSync } from 'fs';
import { randomInt } from 'crypto';
import { toWei, fromWei, toBN } from 'web3-utils';

const ZERO_TOKEN = '0x0000000000000000000000000000000000000000';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const keys = async (obj: any) => {
  Object.keys(obj)
    .toString()
    .split(',')
    .forEach((p) => {
      process.stdout.write(`${p}` + '\n');
    });
};

export const printTxReceipt = async (receipt: any) => {
  process.stdout.write(
    `${receipt.from} => ${receipt.to} (gasUsed:${receipt.gasUsed})(${receipt.status})` +
      '\n' +
      `\ttx:${receipt.transactionHash} (block.no:${receipt.blockNumber})` +
      '\n'
  );
};

export const getRandomInt = (max: number): number => {
  return Math.floor(Math.random() * max);
};

const advanceTime = async (time: number) => {
  await hre.ethers.provider.send('evm_increaseTime', [time]);
  await hre.ethers.provider.send('evm_mine', []);
  return true;
};

export function shouldBehaveLikeBondingCurveToken(): void {
  const transactions: [number, number, string, string, number][] = [];
  let capasitor = 0;

  it('should return BancorFormula contract constructor initial state', async function () {
    const BancorFormulaAddress = await this.BancorFormula.address;
    const BancorFormulaBalance: BigNumber = await hre.ethers.provider.getBalance(BancorFormulaAddress);
    process.stdout.write(
      'Deployed Bancor Formula balance => ' +
        `${await this.BancorFormula.address}: ${BancorFormulaBalance} (wei)` +
        '\n'
    );
  });

  it('should return BondingCurve contract constructor initial state', async function () {
    const BondingCurveAddress = await this.BondingCurve.address;
    const BondingCurveBalance: BigNumber = await hre.ethers.provider.getBalance(BondingCurveAddress);
    process.stdout.write(
      'Deployed Bonding Curve balance => ' + `${await this.BondingCurve.address}: ${BondingCurveBalance} (wei)` + '\n'
    );
  });

  it('should initialize BondingCurve - initializeCurve', async function () {
    const currentBlockNum = await hre.ethers.provider.getBlockNumber();
    const currentBlock = await hre.ethers.provider.getBlock(currentBlockNum);
    const { timestamp } = currentBlock;

    await this.BondingCurve.initialize(this.DaoRegistry.address, this.signers.admin.address);

    await this.BondingCurve.initializeCurve(
      this.BancorFormula.address, // _formula
      this.DaoRegistry.address, // _movement
      this.Endowment.address, // _endowment
      toWei('1'), // _intiative_goal
      this.Endowment.address, // _beneficiary
      '0', // _buyFeePct
      '0', // _sellFeePct
      timestamp + 1000, // _timeStart
      timestamp + 100000, // _timeCooldown
      timestamp + 10000000 // _timeEnd
    );

    process.stdout.write('Bonding curve initialization parameters:');
    process.stdout.write(
      `${
        (this.BancorFormula.address, // _formula
        this.DaoRegistry.address, // _movement
        this.Endowment.address, // _endowment
        toWei('1'), // _intiative_goal
        this.Endowment.address, // _beneficiary
        '0', // _buyFeePct
        '0', // _sellFeePct
        timestamp + 1000, // _timeStart
        timestamp + 100000, // _timeCooldown
        timestamp + 10000000) // _timeEnd
      }` + '\n'
    );

    const buyFeePercent = await this.BondingCurve.buyFeePct();
    console.log(`buy fee % verification ${buyFeePercent}`);
    const sellFeePercent = await this.BondingCurve.sellFeePct();
    console.log(`sell fee % verification ${sellFeePercent}`);
  });

  it('should add collateral token to BondingCurve - addCollateralToken', async function () {
    await this.BondingCurve.addCollateralToken(ZERO_TOKEN, toWei('0.2'), toWei('0.1'), '90000');
    const collateralToken = await this.BondingCurve.collaterals(ZERO_TOKEN);
    console.log(`collateral token (0) ${collateralToken}`);
  });

  it('should make buy order to BondingCurve - makeBuyOrder', async function () {
    this.timeout(60 * 60 * 1000);
    await advanceTime(10000);
    for (let index = 0; index < this.unnamedAccounts.length; index++) {
      const account = this.unnamedAccounts[index % this.unnamedAccounts.length];
      const amount = toWei((randomInt(1, 1000) / 100000).toString());
      console.log(account.address, 'buy tokens using', fromWei(amount), 'ETH');
      const byed = await this.BondingCurve.connect(account).makeBuyOrder(account.address, ZERO_TOKEN, amount, '100', {
        value: amount,
      });

      const receipt = (await byed.wait()).events?.filter((x) => {
        return x.event === 'MakeBuyOrder';
      })[0].args;
      const returnedAmount = fromWei(receipt?.returnedAmount.toString());
      const purchaseAmount = fromWei(receipt?.purchaseAmount.toString());
      const exchangeRate = +purchaseAmount / +returnedAmount;
      capasitor += +returnedAmount;
      account.bondingTokenBalance = toBN(receipt?.returnedAmount.toString());
      transactions.push([index, exchangeRate, returnedAmount, purchaseAmount, capasitor]);
      // console.log(transactions[transactions.length - 1]);
    }
    console.log('using all the hardhat signers, buy smallest increment tokens and print out the token price');
  });

  it('should make sell order to BondingCurve - makeSellOrder', async function () {
    this.timeout(60 * 60 * 1000);
    await advanceTime(10000);
    for (let index = 0; index < this.unnamedAccounts.length / 3; index++) {
      const accountIndex = randomInt(0, this.unnamedAccounts.length - 1);
      const account = this.unnamedAccounts[accountIndex];
      const sellBondingTokenAmount = Math.round(
        // @ts-expect-error
        account.bondingTokenBalance / 3
      ).toString();
      console.log('sellBondingTokenAmount: TOKEN ', fromWei(sellBondingTokenAmount));

      try {
        const byed = await this.BondingCurve.connect(account).makeSellOrder(
          account.address,
          ZERO_TOKEN,
          sellBondingTokenAmount,
          '1'
        );

        const receipt = (await byed.wait()).events?.filter((x) => {
          return x.event === 'MakeSellOrder';
        })[0].args;

        const returnedAmountETH = fromWei(receipt?.returnedAmount.toString());
        const sellAmount = fromWei(receipt?.sellAmount.toString());
        const exchangeRate = +returnedAmountETH / +sellAmount;
        capasitor -= +sellAmount;

        // @ts-expect-error
        account.bondingTokenBalance = account.bondingTokenBalance - toBN(receipt?.sellAmount.toString());

        transactions.push([index, exchangeRate, sellAmount, returnedAmountETH, capasitor]);
      } catch (error) {
        console.log(error);
      }
    }

    const lineArray: string[] = [];
    transactions.forEach(function (infoArray) {
      const line = infoArray.join(',');
      lineArray.push(line);
    });

    const csvContent = lineArray.join('\n');
    writeFileSync('testData.csv', csvContent);
    console.log('using some percentage of individuals, from common-stack, demonstrate various sell orderes');
  });

  it('should also distribute a token across ./example-data/example.csv', async function () {
    console.log('using example.csv, distribute tokens across the curve');
  });

  it('should update ./snapshot/index to store the block number, timestamp with the address and amount contributed', async function () {
    console.log('using the updated example.csv, distribute tokens across the curve');
  });

  it('should display other unnamed addresses and balances', async function () {
    const ad: SignerWithAddress = this.signers.admin;
    process.stdout.write('(+)' + '\t' + `${await ad.address}:${await ad.getBalance()}` + '\n');
    for (let i = 0; i < this.unnamedAccounts.length; i++) {
      const a: SignerWithAddress = this.unnamedAccounts[i];
      process.stdout.write(`(${i})` + '\t' + `${await a.address}:${await a.getBalance()}` + '\n');
    }
    process.stdout.write("🎉🎉🎉 Let's start fondling the contract" + '\n');
  });

  it('should display BondingCurve functions and properties', async function () {
    false && expect(await keys(this.BondingCurveToken));
    console.log('disabled');
  });

  it('should display unnamed addresses and balances again', async function () {
    const ad: SignerWithAddress = this.signers.admin;
    process.stdout.write('\n' + '(+)' + '\t' + `${await ad.address}:${await ad.getBalance()}` + '\n');

    const accounts = [['Addres', 'ETH', 'TOKENS']];
    for (let i = 0; i < this.unnamedAccounts.length; i++) {
      const a = this.unnamedAccounts[i];
      // @ts-expect-error
      process.stdout.write(
        `(${i})` +
          '\t' +
          `${await a.address} ETH:${fromWei((await a.getBalance()).toString())}, TOKEN Price:${fromWei(
            a.bondingTokenBalance?.toString()
          )}` +
          '\n'
      );
      // @ts-expect-error
      accounts.push([
        a.address,
        fromWei((await a.getBalance()).toString()),
        fromWei(a.bondingTokenBalance?.toString()),
      ]);
    }
    const lineArray: string[] = [];
    accounts.forEach(function (infoArray) {
      const line = infoArray.join(',');
      lineArray.push(line);
    });
    const csvContent = lineArray.join('\n');
    writeFileSync('accountsData.csv', csvContent);
  });
}
