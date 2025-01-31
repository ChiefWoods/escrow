import { Program } from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";
import { AddedAccount, startAnchor } from "solana-bankrun";
import { Escrow } from "../target/types/escrow";
import idl from "../target/idl/escrow.json";

export async function getBankrunSetup(accounts: AddedAccount[] = []) {
  const context = await startAnchor("", [], accounts);
  const provider = new BankrunProvider(context);
  const program = new Program(idl as Escrow, provider);

  return {
    context,
    provider,
    program,
  };
}
