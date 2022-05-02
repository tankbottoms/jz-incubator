import { initializeApp } from '@firebase/app';
import { getFirestore, getDoc, doc, Timestamp } from '@firebase/firestore';
import { resolve } from 'path';
import { promises as fs } from 'fs';

const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  measurementId: '',
};

const app = initializeApp(firebaseConfig);

const firestore = getFirestore(app);

interface Transaction {
  sender: string;
  timestamp: Timestamp;
  value: string;
  coin: string;
  block: number;
  blockHash: string;
}

const outFile = resolve(__dirname, '../ledger.csv');

const CSV_HEADINGS = ['txnHash', 'sender', 'value', 'blockNumber', 'timestamp', 'coin'];

async function main() {
  const snapshot = await getDoc(doc(firestore, `prod-snapshot/transactions`));
  let entries: any[] = Object.entries(snapshot.data() || {}).map(
    ([txnHash, { sender, value, block, timestamp, coin }]: [string, Transaction]) => [
      txnHash,
      sender,
      value,
      block,
      timestamp.toMillis(),
      coin,
    ]
  );
  entries = entries.sort((a, b) => Number(a[3]) - Number(b[3]));
  entries.unshift(CSV_HEADINGS);

  await fs.writeFile(outFile, '');
  for (const row of entries) {
    await fs.appendFile(outFile, `${row.join(',')}\n`);
  }
  console.log();
  console.log('Write Output:', outFile);
  console.log();
}

main()
  .then(() => {
    console.log('DONE');
    process.exit(0);
  })
  .catch((error) => {
    console.log(error.message);
    process.exit(-1);
  });
