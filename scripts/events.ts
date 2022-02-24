import { isEqual, zip } from "lodash";
import {
  distinct,
  distinctUntilKeyChanged,
  filter,
  interval,
  map,
  mergeMap,
  Observable,
  of,
  startWith,
  switchMap,
  tap,
} from "rxjs";
import { ajax } from "rxjs/ajax";
import xhr from "xhr2";

type Transaction = any;
type TransactionReceipt = any;

type Block = {
  block_hash?: string;
  parent_block_hash: string;
  status: string;
  block_number: BigInt;
  state_root?: string;
  timestamp: BigInt;
  transactions: Array<Transaction>;
  transaction_receipts: Array<TransactionReceipt>;
};

type TransactionSummary = Transaction & {
  block_number: string;
  receipt: TransactionReceipt;
};

function transactionsFromBlock(b: Block): Array<TransactionSummary> {
  return zip(b.transactions, b.transaction_receipts).map(
    ([transaction, receipt]) => ({
      ...transaction,
      receipt,
      parent_block_hash: b.parent_block_hash,
    })
  );
}

function eventsFromTransaction({
  block_hash,
  transaction_hash,
  parent_block_hash,
  receipt: { transaction_index, events },
}: TransactionSummary): Array<Event> {
  return events.map((e, i) => ({
    block_hash,
    parent_block_hash,
    transaction_hash,
    transaction_index,
    log_index: i,
    ...e,
  }));
}

function block(
  server: string,
  blockNumber: BigInt | "pending"
): Observable<Block> {
  const url = `https://${server}/feeder_gateway/get_block?blockNumber=${blockNumber}`;
  return ajax({ url, createXHR: () => new xhr() }).pipe(
    map(({ response }) => response as Block)
  );
}

function events(server: string, period = 10000) {
  return interval(period).pipe(
    startWith(0),
    switchMap(() => block(server, "pending")),
    distinctUntilKeyChanged("transactions", isEqual),
    mergeMap((block) => of(...transactionsFromBlock(block))),
    distinct(),
    mergeMap((t) => of(...eventsFromTransaction(t)))
  );
}

const alphaGoerli = "alpha4.starknet.io";
const alphaMainet = "alpha-mainnet.starknet.io";

events(alphaGoerli, 1000).pipe(tap(console.log)).subscribe();