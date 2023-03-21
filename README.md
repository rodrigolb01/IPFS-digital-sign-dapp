Aplicativo web para assinar documentos digitalmente e armazenar em blockchain. 
É preciso ter instaladas as extensões Metamask e Phantom Wallet
É preciso também ter configurado um Infura gateway https://app.infura.io/
Instruções:
#1 novo terminal > cd server > npm start.
#2 cd solana (cliente solana) ou cd ethereum (cliente ethereum) 
#3 criar arquivo .env e configurar os campos REACT_APP_INFURA_IPFS_PROJECT_ID e REACT_APP_INFURA_IPFS_PROJECT_SECRET
(no client ethereum é preciso configurar o campo REACT_APP_ETHEREUM_TESTNET=5)
#4 npm start
#5 selecionar arquivo (deve ser .pdf)
#6 selecionar certificado (deve ser .p12)
#7 inserir senha do certificado
#8 clicar em 'sign' e aprovar a transacão (é preciso ter moedas de teste. Podem ser obtidas por uma fauceta)

Fauceta da Solana: 
https://solfaucet.com/
Fauceta da Ethereum: 
https://goerlifaucet.com/ 
https://goerli-faucet.pk910.de/ (é preciso minerar)

