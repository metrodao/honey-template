## Rinkeby deployment
 
This process requires 2 accounts connected in your Rinkeby config. 

Each address must have some test DAI, to get test DAI go here and use the `withdraw` function:
https://rinkeby.etherscan.io/address/0x9a2F850C701b457b73c8dC8B1534Cc187B33F5FD 

For deploying the Honey Pot template with Agreements and mock proposals (note this uses a previously deployed Honey Pot template):

1) Install dependencies inside the root folder and `/mock-actions`:
```
$ npm install
```

2) Compile contracts inside the root folder and `/mock-actions`:
```
$ npx truffle compile
```

3) Configure the Honey Pot DAO in: `scripts/new-dao.js`

4) Deploy a DAO to Rinkeby. Execute in the root folder (requires a Rinkeby account accessible by the truffle script as documented here:
https://hack.aragon.org/docs/cli-intro#set-a-private-key):
```
$ npx truffle exec scripts/new-dao.js --network rinkeby
```

5) Install agreements and create mock proposals. Execute in the `/mock-actions` folder:
```
$ npx truffle exec src/rinkeby.js --network rinkeby
```

6) The DAO address is in `/mock-actions/src/rinkeby-config.json`
