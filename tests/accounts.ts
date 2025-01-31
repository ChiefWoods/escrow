import { PublicKey } from "@solana/web3.js";
import { Escrow } from "../target/types/escrow";
import { Program } from "@coral-xyz/anchor";

export async function getEscrowAcc(
  program: Program<Escrow>,
  escrowPda: PublicKey
) {
  return await program.account.escrow.fetchNullable(escrowPda);
}
