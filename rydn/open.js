const ethers = require('ethers')
const provider = ethers.providers.getDefaultProvider('rinkeby') // rinkeby
const solc = require('solc')
const axios = require('axios')

async function open(_privateKey, _channelTimeout) {
    // initialize wallet
    const wallet = new ethers.Wallet(_privateKey)

    // get my address
    const fromAddress = wallet.address

    // get node address
    const nodeAddress = await axios.get('http://localhost:8000/nodeAddress').then(response => response.data.nodeAddress)

    // get start date
    const startDate = Math.floor(Date.now() / 1000)

    // get channelTimeout
    const channelTimeout = 1
        
    // create contract
    const contract = generateContract({fromAddress, nodeAddress, startDate, channelTimeout})
    
    // compile contract: https://github.com/ethereum/solc-js
    let abi
    let bytecode
    const output = solc.compile(contract, 1)
    for (const contractName in output.contracts) {
        bytecode = output.contracts[contractName].bytecode
           abi = JSON.parse(output.contracts[contractName].interface)
    }
    bytecode = '0x' + bytecode

    // contract -> data: https://docs.ethers.io/ethers.js/html/api-contract.html?#deploying-a-contract
    const {data} = ethers.Contract.getDeployTransaction(bytecode, abi)

    // create transaction
    const transaction = {
        data: data,
        gasLimit: ethers.utils.hexlify(1500000),
        gasPrice: await provider.getGasPrice(),
        nonce: await provider.getTransactionCount(fromAddress, 'pending'),
        value: ethers.utils.hexlify(123), // await provider.getBalance(fromAddress) - 1500000
    }

    // sign transaction
    const signedTransaction = wallet.sign(transaction)
    console.log(signedTransaction)
    
    // send to server
    const response = await axios.post('http://localhost:8000/open', {signedTransaction, fromAddress, nodeAddress, startDate, channelTimeout})
}

function generateContract(_args) {
    // I know this can be aconstructor. FUck it.
    return `
        pragma solidity ^0.4.0;

        contract Channel {

            address public fromAddress = ${_args.fromAddress};
            address public nodeAddress = ${_args.nodeAddress};
            uint public startDate = ${_args.startDate};
            uint public channelTimeout = ${_args.channelTimeout};
            
            constructor() payable {}

            function CloseChannel(bytes32 _h, uint8 _v, bytes32 _r, bytes32 _s, uint _wei) public {
                address signer;
                bytes32 proof;
                
                signer = ecrecover(_h, _v, _r, _s);

                if (signer != nodeAddress) revert();

                proof = keccak256(this, _wei);

                if (proof != _h) revert();

                nodeAddress.transfer(_wei);
                
                selfdestruct(fromAddress);
            }

            function ChannelTimeout() public {
                if (startDate + channelTimeout > now) revert();

                selfdestruct(fromAddress);
            }

        }
    `
}

module.exports = {open}
