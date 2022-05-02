/* eslint-disable no-undef */
import hre from 'hardhat';
import { Artifact } from 'hardhat/types';
import { Signers } from '../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import type { BancorFormula, BondingCurve, Endowment, DaoRegistry } from '../typechain';
import { shouldBehaveLikeBondingCurveToken } from './BondingCurve.behavior';

const { deployContract } = hre.waffle;

describe('Setup Admin and Unnamed Accounts', function () {
  before(async function () {
    this.timeout(4 * 60 * 1000);
    this.signers = {} as Signers;

    const signers: SignerWithAddress[] = await hre.ethers.getSigners();
    this.signers.admin = signers[0];
    this.unnamedAccounts = [] as SignerWithAddress[];
    for (let i = 1; i <= signers.length - 1; i++) {
      const unnamedAccount: SignerWithAddress = signers[i];
      this.unnamedAccounts.push(unnamedAccount);
    }
    console.log(this.unnamedAccounts.length);
  });

  describe('BondingCurve - initialization', function () {
    before(async function () {
      const BancorFormula: Artifact = await hre.artifacts.readArtifact('BancorFormula');
      this.BancorFormula = (await deployContract(this.signers.admin, BancorFormula)) as BancorFormula;
      console.log(`Deployed BancorFormula to the following address => ${this.BancorFormula.address}`);

      const BondingCurve: Artifact = await hre.artifacts.readArtifact('BondingCurve');
      this.BondingCurve = (await deployContract(this.signers.admin, BondingCurve)) as BondingCurve;
      console.log(`Deployed BondingCurve to the following address => ${this.BondingCurve.address}`);

      const Endowment: Artifact = await hre.artifacts.readArtifact('Endowment');
      this.Endowment = (await deployContract(this.signers.admin, Endowment)) as Endowment;
      console.log(`Deployed Endowment to the following address => ${this.Endowment.address}`);

      const DaoRegistry: Artifact = await hre.artifacts.readArtifact('DaoRegistry');
      this.DaoRegistry = (await deployContract(this.signers.admin, DaoRegistry)) as DaoRegistry;
      console.log(`Deployed DaoRegistry to the following address => ${this.DaoRegistry.address}`);

      process.stdout.write('\n');
    });

    // it("should generate supplemental information", function () => {            });

    shouldBehaveLikeBondingCurveToken();
  });
});
