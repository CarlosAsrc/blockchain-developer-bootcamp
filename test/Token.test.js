
import { tokens, EVM_REVERT } from './helpers'

const Token = artifacts.require('./Token')
require('chai')
    .use(require('chai-as-promised'))
    .should()


contract('Token', ([deployer, receiver, exchange]) => {

    let token
    let name = "Carlos Token"
    let symbol = "ASRC"
    let decimals = '18'
    let totalSupply = tokens('1000000').toString()

    beforeEach(async () => {
        token = await Token.new()
    })

    describe('deployment', () => {
        it('tracks the name', async () => {
            const result = await token.name()
            result.should.equal(name)
        })

        it('tracks the symbol', async () => {
            const result = await token.symbol()
            result.should.equal(symbol)
        })

        it('tracks the decimals', async () => {
            const result = await token.decimals()
            result.toString().should.equal(decimals)
        })

        it('tracks the total supply', async () => {
            const result = await token.totalSupply()
            result.toString().should.equal(totalSupply.toString())
        })

        it('assigns the total supply to the deployer', async () => {
            const result = await token.balanceOf(deployer)
            result.toString().should.equal(totalSupply.toString())
        })
    })

    describe('sending tokens', () => {

        let amount
        let result

        describe('success', async () => {
            beforeEach(async () => {
                amount = tokens(100)
                result = await token.transfer(receiver, amount, { from: deployer })
            })

            it('transfer tokens balances', async () => {
                let balanceOf
                balanceOf = await token.balanceOf(deployer)
                balanceOf.toString().should.equal(tokens(999900).toString())
                balanceOf = await token.balanceOf(receiver)
                balanceOf.toString().should.equal(tokens(100).toString())
            })

            it('emits a Transfer event', async () => {
                const args = result.logs[0].args
                const event = result.logs[0].event

                event.toString().should.equal('Transfer', 'Event is correct')

                args.from.toString().should.equal(deployer, 'from is correct')
                args.to.toString().should.equal(receiver, 'to is correct')
                args.value.toString().should.equal(amount.toString(), 'value is correct')
            })
        })


        describe('failure', async () => {
            it('rejects insufficient balances', async () => {
                let invalidAmount = tokens(10000000)
                await token.transfer(receiver, invalidAmount, { from: deployer }).should.be.rejectedWith(EVM_REVERT)

                invalidAmount = tokens(10)
                await token.transfer(deployer, invalidAmount, { from: receiver }).should.be.rejectedWith(EVM_REVERT)
            })

            it('rejects invalid recipients', async () => {
                await token.transfer('0x0', amount, { from: deployer }).should.be.rejected
            })
        })
    })

    describe('approving tokens', () => {
        let result
        let amount

        beforeEach(async () => {
            amount = tokens(100)
            result = await token.approve(exchange, amount, { from: deployer })
        })

        describe('success', () => {
            it('allocates an allowance to delegated token spending on exchange', async () => {
                const allowance = await token.allowance(deployer, exchange)
                allowance.toString().should.equal(amount.toString())
            })

            it('emits a Approval event', async () => {
                const args = result.logs[0].args
                const event = result.logs[0].event

                event.toString().should.equal('Approval', 'Event is correct')

                args.owner.toString().should.equal(deployer, 'owner is correct')
                args.spender.toString().should.equal(exchange, 'spender is correct')
                args.value.toString().should.equal(amount.toString(), 'value is correct')
            })
        })

        describe('failure', () => {
            it('rejects invalid spenders', async () => {
                await token.approve(0x0, amount, { from: deployer }).should.be.rejected
            })
        })
    })

    describe('delegated token transfers', () => {

        let amount
        let result

        beforeEach(async () => {
            amount = tokens(100)
            await token.approve(exchange, amount, { from: deployer })
        })

        describe('success', async () => {
            beforeEach(async () => {
                result = await token.transferFrom(deployer, receiver, amount, { from: exchange })
            })

            it('transfer tokens balances', async () => {
                let balanceOf
                balanceOf = await token.balanceOf(deployer)
                balanceOf.toString().should.equal(tokens(999900).toString())
                balanceOf = await token.balanceOf(receiver)
                balanceOf.toString().should.equal(tokens(100).toString())
            })

            it('resets the allowance', async () => {
                const allowance = await token.allowance(deployer, exchange)
                allowance.toString().should.equal('0')
            })

            it('emits a Transfer event', async () => {
                const args = result.logs[0].args
                const event = result.logs[0].event

                event.toString().should.equal('Transfer', 'Event is correct')

                args.from.toString().should.equal(deployer, 'from is correct')
                args.to.toString().should.equal(receiver, 'to is correct')
                args.value.toString().should.equal(amount.toString(), 'value is correct')
            })
        })


        describe('failure', async () => {
            it('rejects insufficient amounts', async () => {
                let invalidAmount = tokens(10000000)
                await token.transferFrom(deployer, receiver, invalidAmount, { from: exchange }).should.be.rejectedWith(EVM_REVERT)
            })

            it('rejects invalid recipients', async () => {
                await token.transferFrom(deployer, '0x0', amount, { from: exchange }).should.be.rejected
            })
        })
    })
})