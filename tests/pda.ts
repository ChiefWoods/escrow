import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import idl from "../target/idl/escrow.json";

export function getEscrowPdaAndBump(maker: PublicKey, seed: BN) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      maker.toBuffer(),
      seed.toArrayLike(Buffer, "le", 8),
    ],
    new PublicKey(idl.address)
  );
}
