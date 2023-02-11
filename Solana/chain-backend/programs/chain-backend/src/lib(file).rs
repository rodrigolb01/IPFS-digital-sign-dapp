use anchor_lang::prelude::*;

declare_id!("GTdmmYgyr7nCZU1DFKN1hEi7D3AVMn2FFQQNkgSeBV7m");

#[program]
pub mod myepicproject {
  use super::*;
  pub fn start_stuff_off(ctx: Context<StartStuffOff>) -> Result <()> {
    let base_account = &mut ctx.accounts.base_account;
    base_account.total_file_hashes = 0;
    Ok(())
  }

  // The function now accepts a file_hash param from the user. We also reference the user from the Context
  pub fn add_file_hash(ctx: Context<AddFileHash>, file_hash: String) -> Result <()> {
    let base_account = &mut ctx.accounts.base_account;
    let user = &mut ctx.accounts.user;

	// Build the struct.
    let item = ItemStruct {
      file_hash: file_hash.to_string(),
      user_address: *user.to_account_info().key,
    };

	// Add it to the file_hash vector.
    base_account.file_hash_list.push(item);
    base_account.total_file_hashes += 1;
    Ok(())
  }
}

#[derive(Accounts)]
pub struct StartStuffOff<'info> {
  #[account(init, payer = user, space = 9000)]
  pub base_account: Account<'info, BaseAccount>,
  #[account(mut)]
  pub user: Signer<'info>,
  pub system_program: Program <'info, System>,
}

// Add the signer who calls the AddFileHash method to the struct so that we can save it
#[derive(Accounts)]
pub struct AddFileHash<'info> {
  #[account(mut)]
  pub base_account: Account<'info, BaseAccount>,
  #[account(mut)]
  pub user: Signer<'info>,
}

// Create a custom struct for us to work with.
#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ItemStruct {
    pub file_hash: String,
    pub user_address: Pubkey,
}

#[account]
pub struct BaseAccount {
    pub total_file_hashes: u64,
	// Attach a Vector of type ItemStruct to the account.
    pub file_hash_list: Vec<ItemStruct>,
}