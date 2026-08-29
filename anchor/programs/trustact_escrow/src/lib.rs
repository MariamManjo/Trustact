use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("592wks1UXnk4arVMb3N8S7xcu2dgKp8LiGFNHheVap7N");

/// The Trustact backend's signer — the only key allowed to release or close
/// a round's escrowed funds. Consensus and the payout split are computed
/// off-chain (they depend on judging answers, which isn't on-chain data),
/// so this program can't verify a payout is "correct" itself. It only
/// verifies the caller is the backend, and moves the exact PDA-held funds
/// that caller asks it to move. Same trust boundary as a custodial treasury
/// wallet — the difference is each round's money now sits in its own PDA
/// instead of one shared balance, so it can be reasoned about per-round and
/// can't be spent by a plain wallet-to-wallet transfer.
pub const AUTHORITY: Pubkey = pubkey!("hbQPveofRrhn1tp4xzVLMUu8dVzbzfXDaT2j4hhKw1E");

#[program]
pub mod trustact_escrow {
    use super::*;

    /// Asker deposits the round's fee into a fresh PDA vault keyed by
    /// `round_id` (the same UUID, as raw bytes, used off-chain).
    pub fn deposit(ctx: Context<Deposit>, round_id: [u8; 16], amount: u64) -> Result<()> {
        require!(amount > 0, EscrowError::ZeroAmount);

        let vault = &mut ctx.accounts.round_vault;
        vault.asker = ctx.accounts.asker.key();
        vault.round_id = round_id;
        vault.amount = amount;
        vault.bump = ctx.bumps.round_vault;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.asker.to_account_info(),
                    to: ctx.accounts.round_vault.to_account_info(),
                },
            ),
            amount,
        )
    }

    /// Authority-only: pays one recipient out of the round's vault. Called
    /// once per winner in the same transaction — Solana allows multiple
    /// instructions per transaction, so a whole round's payout is still one
    /// atomic, all-or-nothing send.
    pub fn payout_one(ctx: Context<PayoutOne>, _round_id: [u8; 16], amount: u64) -> Result<()> {
        let vault_info = ctx.accounts.round_vault.to_account_info();
        let recipient_info = ctx.accounts.recipient.to_account_info();

        **vault_info.try_borrow_mut_lamports()? = vault_info
            .lamports()
            .checked_sub(amount)
            .ok_or(EscrowError::InsufficientVaultBalance)?;
        **recipient_info.try_borrow_mut_lamports()? = recipient_info
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;

        Ok(())
    }

    /// Authority-only: closes the vault once its payouts are done, refunding
    /// whatever's left (normally just the rent-exempt minimum) to itself.
    pub fn close_round(_ctx: Context<CloseRound>, _round_id: [u8; 16]) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(round_id: [u8; 16])]
pub struct Deposit<'info> {
    #[account(mut)]
    pub asker: Signer<'info>,

    #[account(
        init,
        payer = asker,
        space = 8 + RoundVault::INIT_SPACE,
        seeds = [b"round", round_id.as_ref()],
        bump,
    )]
    pub round_vault: Account<'info, RoundVault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(round_id: [u8; 16])]
pub struct PayoutOne<'info> {
    #[account(mut, constraint = authority.key() == AUTHORITY @ EscrowError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"round", round_id.as_ref()],
        bump = round_vault.bump,
    )]
    pub round_vault: Account<'info, RoundVault>,

    /// CHECK: a plain SOL recipient. Server picks who's a winner and how
    /// much they get from off-chain judging before this instruction is ever
    /// built — this program just moves the lamports, it doesn't decide.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(round_id: [u8; 16])]
pub struct CloseRound<'info> {
    #[account(mut, constraint = authority.key() == AUTHORITY @ EscrowError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        close = authority,
        seeds = [b"round", round_id.as_ref()],
        bump = round_vault.bump,
    )]
    pub round_vault: Account<'info, RoundVault>,
}

#[account]
#[derive(InitSpace)]
pub struct RoundVault {
    pub asker: Pubkey,
    pub round_id: [u8; 16],
    pub amount: u64,
    pub bump: u8,
}

#[error_code]
pub enum EscrowError {
    #[msg("Deposit amount must be greater than zero.")]
    ZeroAmount,
    #[msg("Only the Trustact backend authority can release escrowed funds.")]
    Unauthorized,
    #[msg("Vault does not have enough balance for this payout.")]
    InsufficientVaultBalance,
    #[msg("Payout amount overflowed.")]
    Overflow,
}
