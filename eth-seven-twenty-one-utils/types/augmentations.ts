// eslint-disable @typescript-eslint/no-explicit-any
import { Fixture } from "ethereum-waffle";

import { Signers } from "./";
import { Base, Sale, Token } from "../typechain";

declare module "mocha" {
    export interface Context {        
        loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
        signers: Signers;
        
        base: Base;                
        sale: Sale;
        token: Token;
    }
};
