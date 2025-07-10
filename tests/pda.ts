import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import idl from "../target/idl/escrow.json";

const ESCROW_PROGRAM_ID = new PublicKey(idl.address);

export function getEscrowPda(maker: PublicKey, seed: BN) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      maker.toBuffer(),
      seed.toArrayLike(Buffer, "le", 8),
    ],
    ESCROW_PROGRAM_ID,
  )[0];
}
