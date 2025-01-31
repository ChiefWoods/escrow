pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("9w6Bay8y3yDdQzPLH8h4ygBQqDBDHjQEr3U2KqQHec9B");

#[program]
pub mod escrow {
    use super::*;

    pub fn make(
        ctx: Context<Make>,
        seed: u64,
        deposit_amount: u64,
        receive_amount: u64,
    ) -> Result<()> {
        Make::make(ctx, seed, deposit_amount, receive_amount)
    }

    pub fn take(ctx: Context<Take>) -> Result<()> {
        Take::take(ctx)
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        Cancel::cancel(ctx)
    }
}
