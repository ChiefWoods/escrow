import { beforeEach, describe, expect, test } from "bun:test";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  ACCOUNT_SIZE,
  AccountLayout,
  getAccount,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  MintLayout,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "bn.js";
import { randomBytes } from "crypto";
import { getEscrowPda } from "./pda";
import { fetchEscrowAcc } from "./accounts";
import { LiteSVMProvider } from "anchor-litesvm";
import { LiteSVM } from "litesvm";
import { fundedSystemAccountInfo, getSetup } from "./setup";

describe("escrow", () => {
  let { litesvm, provider, program } = {} as {
    litesvm: LiteSVM;
    provider: LiteSVMProvider;
    program: Program<Escrow>;
  };

  const [mintA, mintB, maker, taker] = Array.from(
    { length: 4 },
    Keypair.generate,
  );

  const [makerAtaA, makerAtaB, takerAtaA, takerAtaB] = [maker, taker]
    .map((kp) => {
      return [mintA, mintB].map((mint) => {
        return getAssociatedTokenAddressSync(
          mint.publicKey,
          kp.publicKey,
          false,
        );
      });
    })
    .flat();

  const [seedA, seedB] = Array.from(
    { length: 2 },
    () => new BN(randomBytes(8)),
  );

  const depositAmount = 1;
  const receiveAmount = 1;

  beforeEach(async () => {
    const [mintAData, mintBData] = Array.from({ length: 2 }, () =>
      Buffer.alloc(MINT_SIZE),
    );

    [mintAData, mintBData].forEach((data) => {
      MintLayout.encode(
        {
          decimals: 6,
          freezeAuthority: PublicKey.default,
          freezeAuthorityOption: 0,
          isInitialized: true,
          mintAuthority: PublicKey.default,
          mintAuthorityOption: 0,
          supply: 1n,
        },
        data,
      );
    });

    const [ataAXData, ataBYData] = Array.from({ length: 2 }, () =>
      Buffer.alloc(ACCOUNT_SIZE),
    );

    AccountLayout.encode(
      {
        mint: mintA.publicKey,
        owner: maker.publicKey,
        amount: 1n,
        delegateOption: 0,
        delegate: PublicKey.default,
        delegatedAmount: 0n,
        state: 1,
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
      },
      ataAXData,
    );

    AccountLayout.encode(
      {
        mint: mintB.publicKey,
        owner: taker.publicKey,
        amount: 1n,
        delegateOption: 0,
        delegate: PublicKey.default,
        delegatedAmount: 0n,
        state: 1,
        isNativeOption: 0,
        isNative: 0n,
        closeAuthorityOption: 0,
        closeAuthority: PublicKey.default,
      },
      ataBYData,
    );

    ({ litesvm, provider, program } = await getSetup([
      ...[maker, taker].map((kp) => {
        return {
          pubkey: kp.publicKey,
          account: fundedSystemAccountInfo(),
        };
      }),
      {
        pubkey: mintA.publicKey,
        account: {
          data: mintAData,
          executable: false,
          lamports: LAMPORTS_PER_SOL,
          owner: TOKEN_PROGRAM_ID,
        },
      },
      {
        pubkey: mintB.publicKey,
        account: {
          data: mintBData,
          executable: false,
          lamports: LAMPORTS_PER_SOL,
          owner: TOKEN_PROGRAM_ID,
        },
      },
      {
        pubkey: makerAtaA,
        account: {
          lamports: LAMPORTS_PER_SOL,
          data: ataAXData,
          owner: TOKEN_PROGRAM_ID,
          executable: false,
        },
      },
      {
        pubkey: takerAtaB,
        account: {
          lamports: LAMPORTS_PER_SOL,
          data: ataBYData,
          owner: TOKEN_PROGRAM_ID,
          executable: false,
        },
      },
    ]));
  });

  test("make an escrow", async () => {
    await program.methods
      .make(seedA, new BN(depositAmount), new BN(receiveAmount))
      .accounts({
        maker: maker.publicKey,
        mintA: mintA.publicKey,
        mintB: mintB.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();

    const escrowPda = getEscrowPda(maker.publicKey, seedA);
    const escrowAccount = await fetchEscrowAcc(program, escrowPda);

    expect(escrowAccount.seed).toStrictEqual(seedA);
    expect(escrowAccount.receiveAmount.toNumber()).toEqual(receiveAmount);
    expect(escrowAccount.maker).toStrictEqual(maker.publicKey);
    expect(escrowAccount.mintA).toStrictEqual(mintA.publicKey);
    expect(escrowAccount.mintB).toStrictEqual(mintB.publicKey);

    const vaultAta = getAssociatedTokenAddressSync(
      mintA.publicKey,
      escrowPda,
      true,
    );
    const vaultAtaAcc = await getAccount(provider.connection, vaultAta);

    expect(Number(vaultAtaAcc.amount)).toEqual(depositAmount);

    const ataAXAcc = await getAccount(provider.connection, makerAtaA);

    expect(Number(ataAXAcc.amount)).toEqual(0);
  });

  test("take an escrow", async () => {
    await program.methods
      .make(seedA, new BN(depositAmount), new BN(receiveAmount))
      .accounts({
        maker: maker.publicKey,
        mintA: mintA.publicKey,
        mintB: mintB.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();

    const escrowPda = getEscrowPda(maker.publicKey, seedA);

    await program.methods
      .take()
      .accounts({
        escrow: escrowPda,
        taker: taker.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([taker])
      .rpc();

    const vaultAta = getAssociatedTokenAddressSync(
      mintA.publicKey,
      escrowPda,
      true,
    );
    const vaultAtaBal = litesvm.getBalance(vaultAta);

    expect(vaultAtaBal).toBe(0n);

    const ataAYAcc = await getAccount(provider.connection, takerAtaA);

    expect(Number(ataAYAcc.amount)).toEqual(receiveAmount);

    const ataBXAcc = await getAccount(provider.connection, makerAtaB);

    expect(Number(ataBXAcc.amount)).toEqual(depositAmount);

    const ataBYAcc = await getAccount(provider.connection, takerAtaB);

    expect(Number(ataBYAcc.amount)).toEqual(0);
  });

  test("cancel an escrow", async () => {
    await program.methods
      .make(seedB, new BN(depositAmount), new BN(receiveAmount))
      .accounts({
        maker: maker.publicKey,
        mintA: mintA.publicKey,
        mintB: mintB.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();

    const escrowPda = getEscrowPda(maker.publicKey, seedB);

    await program.methods
      .cancel()
      .accountsPartial({
        maker: maker.publicKey,
        escrow: escrowPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc();

    const vaultAta = getAssociatedTokenAddressSync(
      mintA.publicKey,
      escrowPda,
      true,
    );
    const vaultAtaAcc = litesvm.getBalance(vaultAta);

    expect(vaultAtaAcc).toBe(0n);

    const ataAXAcc = await getAccount(provider.connection, makerAtaA);

    expect(Number(ataAXAcc.amount)).toEqual(depositAmount);
  });
});
