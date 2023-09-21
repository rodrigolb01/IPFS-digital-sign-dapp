# IPFS digital sign 
[![NPM](https://img.shields.io/npm/l/react)](https://github.com/rodrigolb01/IPFS-digital-sign-dapp/blob/main/LICENSE) 

# Sobre o projeto

Aplicativo web para assinar documentos digitalmente e armazenar em blockchain. 

# Tecnologias utilizadas
## Back end
- Javascript
- Html
- CSS

# Como executar o projeto

## Back end
Pré-requisitos: 
- Extensão Metamask 
- Extensão Phantom Wallet
- Instalar certificado KeyStore.p12 na pasta /resources
- configurar um IPFS Infura gateway em https://app.infura.io/


Instruções:

- novo terminal > cd server > npm start.

- cd solana (cliente solana) ou cd ethereum (cliente ethereum) 

- criar arquivo .env e configurar as variáveis REACT_APP_INFURA_IPFS_PROJECT_ID e REACT_APP_INFURA_IPFS_PROJECT_SECRET com as informações fornecidas no dasboard do Gateway Infura.
Configurar também REACT_APP_ETHEREUM_TESTNET=5

- npm start

- selecionar arquivo (deve ser .pdf)

- selecionar o certificado keyStore.p12

- inserir a senha que foi configurada durante a instalação do certificado

- clicar em 'sign' e aprovar a transacão mas é preciso ter moedas de teste. Podem ser obtidas por uma fauceta dos links abaixo

Fauceta da Solana: 
https://solfaucet.com/

Fauceta da Ethereum: 
https://goerlifaucet.com/ 

Fauceta da Ethereum: https://goerli-faucet.pk910.de/ (é preciso minerar)


A assinatura do documento pode ser validada por um leitor de pdf

# Autor

Rodrigo Linhares Barroso

https://www.linkedin.com/in/rodrigo-linhares-barroso-6271671a4/











