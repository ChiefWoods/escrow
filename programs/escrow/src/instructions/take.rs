use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

use crate::{Escrow, ESCROW_SEED};

#[derive(Accounts)]
pub struct Take<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    #[account(mut)]
    pub maker: SystemAccount<'info>,
    #[account(
        mut,
        close = maker,
        has_one = maker,
        has_one = mint_a,
        has_one = mint_b,
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mint::token_program = token_program)]
    pub mint_a: InterfaceAccount<'info, Mint>,
    #[account(mint::token_program = token_program)]
    pub mint_b: InterfaceAccount<'info, Mint>,
    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = mint_a,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_ata_a: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = taker,
        associated_token::token_program = token_program,
    )]
    pub taker_ata_b: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = mint_b,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_ata_b: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl Take<'_> {
    pub fn handler(ctx: Context<Take>) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[
            ESCROW_SEED,
            ctx.accounts.maker.to_account_info().key.as_ref(),
            &ctx.accounts.escrow.seed.to_le_bytes()[..],
            &[ctx.accounts.escrow.bump],
        ]];

        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    authority: ctx.accounts.escrow.to_account_info(),
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint_a.to_account_info(),
                    to: ctx.accounts.taker_ata_a.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            ctx.accounts.vault.amount,
            ctx.accounts.mint_a.decimals,
        )?;

        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    authority: ctx.accounts.taker.to_account_info(),
                    from: ctx.accounts.taker_ata_b.to_account_info(),
                    mint: ctx.accounts.mint_b.to_account_info(),
                    to: ctx.accounts.maker_ata_b.to_account_info(),
                },
            ),
            ctx.accounts.escrow.receive_amount,
            ctx.accounts.mint_b.decimals,
        )?;

        close_account(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                    destination: ctx.accounts.maker.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
        )
    }
}
