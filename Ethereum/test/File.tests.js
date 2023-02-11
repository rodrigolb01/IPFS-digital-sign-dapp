const File = artifacts.require("File")

require('chai')
.use(require('chai-as-promised'))
.should()

contract('File', (accounts) => {
    let file

    before(async () => {
        file = await File.deployed()
    })

    describe('deployment', async () => {
        it('deploys successfully', async () => {
            file = await File.deployed()
            const address = file.address;
            assert.notEqual(address, '');
            assert.notEqual(address, 'undefined');
            assert.notEqual(address, '0x0');
            assert.notEqual(address, null)
            console.log('deployed contract address: ' + address)
        })
    })

    describe('set and get', async () => {
        it('get and set file successfully', async () => {
            file = await File.deployed();
            const data = 'Hello World!';
            await file.set(data);
            const retrieved = await file.get();
            assert.equal(data, retrieved);
        })
    })
})