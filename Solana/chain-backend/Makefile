help:
	echo "This is my Makefile, storing some utils"
test:
	anchor test

switch-devnet:
	solana config set --url devnet
	solana config get
	solana airdrop 2
	solana balance

get-address-devnet:
	solana address -k target/deploy/chain_backend-keypair.json

