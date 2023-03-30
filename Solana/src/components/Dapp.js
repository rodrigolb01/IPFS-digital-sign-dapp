import {
  Connection,
  clusterApiUrl,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import { decode } from "@project-serum/anchor/dist/cjs/utils/bytes/hex";

const Dapp = () => {
  const fromPubKey = new PublicKey(
    "EPSHkvpPWGXQXUvqPzmV1vqUNHYocu2GCRB8hLH1nTYC"
  );
  const fromPrivateKey =
    "3Ezt1WEACFotRA3BGmp1MMj7SwJwFLEn8v7YcZ6RnxYpwbFYJGs1GDovzZun52fzHuR6Qq3c4mAymjDakM8N3Tdr";

  const toPublicKey = new PublicKey(
    "EihQT2hBw45r46AfEmXoLZMic5tgBmz5aKLGsr8VZhU2"
  );

  const sendTx = async () => {
    const tx = await createTransferInstruction();
    const receipt = await signTransaction(tx, fromPrivateKey);
    console.log(receipt);
  };

  const createTransferInstruction = async () => {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromPubKey,
        /** Account that will receive transferred lamports */
        toPubkey: toPublicKey,
        /** Amount of lamports to transfer */
        lamports: 100000000,
      })
    );
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const blockHash = (await connection.getLatestBlockhash("finalized"))
      .blockhash;
    tx.feePayer = fromPubKey;
    tx.recentBlockhash = blockHash;
    const serializedTransaction = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: true,
    });
    const transactionBase64 = serializedTransaction.toString("base64");

    console.log("Instruction: ");
    console.log(transactionBase64);

    return transactionBase64;
  };

  const signTransaction = async (encodedTransaction, fromPrivateKey) => {
    try {
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

      const feePayer = Keypair.fromSecretKey(decode(fromPrivateKey));
      const recoveredTransaction = Transaction.from(
        Buffer.from(encodedTransaction, "base64")
      );
      const signedTrasaction = recoveredTransaction.partialSign(feePayer);
      const txnSignature = await connection.sendRawTransaction(
        signedTrasaction.serialize()
      );
      return txnSignature;
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div>
      <h4>Create encoded instruction</h4>
      <button onClick={sendTx}></button>
    </div>
  );
};

export default Dapp;
