// eslint-disable @typescript-eslint/no-explicit-any
import { Fixture } from 'ethereum-waffle';
import { Signers } from './';
import type { BancorFormula, BondingCurve, Endowment, DaoRegistry } from '../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import type BN from 'bn.js';

declare module 'mocha' {
  interface SignerWithAddressAndToken extends SignerWithAddress {
    bondingTokenBalance?: BN;
  }
  export interface Context {
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    signers: Signers;
    unnamedAccounts: SignerWithAddressAndToken[];
    BancorFormula: BancorFormula;
    BondingCurve: BondingCurve;
    Endowment: Endowment;
    DaoRegistry: DaoRegistry;
  }
}
