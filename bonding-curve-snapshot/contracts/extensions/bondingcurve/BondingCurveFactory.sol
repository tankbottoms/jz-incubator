pragma solidity ^0.8.0;

// SPDX-License-Identifier: MIT

import '../../core/DaoConstants.sol';
import '../../core/CloneFactory.sol';

contract BondingCurveFactory is CloneFactory, DaoConstants {
    address public identityAddress;
    address public token;
    event BondingCurveCreated(address bondingCurveAddress);

    constructor(address _identityAddress, address _token) {
        identityAddress = _identityAddress;
        token = _token;
    }

    /**
     * @notice Create and initialize a new BondingCurve
     */
    function createBondingCurve() external returns (address bondingCurve) {
        bondingCurve = _createClone(identityAddress);
        emit BondingCurveCreated(bondingCurve);
    }
}
