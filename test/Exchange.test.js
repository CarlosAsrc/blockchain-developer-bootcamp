import { before } from 'lodash'
import { tokens, EVM_REVERT, ETHER_ADDRESS, ether } from './helpers'

const Exchange = artifacts.require('./Exchange')
const Token = artifacts.require('./Token')


require('chai')
    .use(require('chai-as-promised'))
    .should()


contract('Exchange', ([deployer, feeAccount, user1]) => {

    let token
    let exchange
    let feePercent = 10

    beforeEach(async () => {
        token = await Token.new()

        token.transfer(user1, tokens(100), { from: deployer })

        exchange = await Exchange.new(feeAccount, feePercent)
    })

    describe('deployment', () => {
        it('tracks the fee account', async () => {
            const result = await exchange.feeAccount()
            result.should.equal(feeAccount)
        })

        it('tracks the fee percent', async () => {
            const result = await exchange.feePercent()
            result.toString().should.equal(feePercent.toString())
        })

    })

    describe('fallback', () => {
        it('reverts when Ether is sent', async () => {
            await exchange.sendTransaction({ value: 1, from: user1 }).should.be.rejectedWith(EVM_REVERT)
        })
    })

    describe('depositing ether', () => {
        let result
        let amount

        beforeEach(async () => {
            amount = ether(1)
            result = await exchange.depositEther({ from: user1, value: amount })
        })

        it('tracks the balance', async () => {
            let balance = await exchange.tokens(ETHER_ADDRESS, user1)
            balance.toString().should.equal(amount.toString())
        })

        it('emits a Deposit event', async () => {
            const args = result.logs[0].args
            const event = result.logs[0].event

            event.toString().should.equal('Deposit', 'Event is correct')

            args.token.toString().should.equal(ETHER_ADDRESS, 'token is correct')
            args.user.toString().should.equal(user1, 'user is correct')
            args.amount.toString().should.equal(amount.toString(), 'amount is correct')
            args.balance.toString().should.equal(amount.toString(), 'balance is correct')
        })
    })

    describe('withdrawing ether', () => {
        let amount = ether(1)

        beforeEach(async () => {
            await exchange.depositEther({ from: user1, value: amount })
        })

        describe('success', () => {
            let result
            beforeEach(async () => {
                result = await exchange.withdrawEther(amount, { from: user1 })
            })

            it('withdraws Ether funds', async () => {
                const balance = await exchange.tokens(ETHER_ADDRESS, user1)
                balance.toString().should.equal('0')
            })

            it('emits a Withdraw event', async () => {
                const args = result.logs[0].args
                const event = result.logs[0].event

                event.toString().should.equal('Withdraw', 'Event is correct')

                args.token.toString().should.equal(ETHER_ADDRESS, 'token is correct')
                args.user.toString().should.equal(user1, 'user is correct')
                args.amount.toString().should.equal(amount.toString(), 'amount is correct')
                args.balance.toString().should.equal('0', 'balance is correct')
            })
        })

        describe('failure', () => {
            it('rejects withdraws for insufficient balances', async () => {
                await exchange.withdrawEther(ether(2), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })
        })
    })

    describe('depositing tokens', () => {
        let amount
        let result

        describe('success', () => {
            beforeEach(async () => {
                amount = tokens(10)
                await token.approve(exchange.address, amount, { from: user1 })
                result = await exchange.depositToken(token.address, amount, { from: user1 })
            })

            it('tracks the token deposit', async () => {
                let balance
                balance = await token.balanceOf(exchange.address)
                balance.toString().should.equal(amount.toString())

                balance = await exchange.tokens(token.address, user1)
                balance.toString().should.equal(amount.toString())
            })

            it('emits a Deposit event', async () => {
                const args = result.logs[0].args
                const event = result.logs[0].event

                event.toString().should.equal('Deposit', 'Event is correct')

                args.token.toString().should.equal(token.address, 'token is correct')
                args.user.toString().should.equal(user1, 'user is correct')
                args.amount.toString().should.equal(amount.toString(), 'amount is correct')
                args.balance.toString().should.equal(amount.toString(), 'balance is correct')
            })
        })

        describe('failure', () => {
            it('rejects ether deposits', async () => {
                await exchange.depositToken(ETHER_ADDRESS, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })

            it('rejects invalid recipients', async () => {
                await exchange.depositToken(token.address, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })
        })

    })

    describe('withdrawing tokens', () => {
        let amount
        let result



        describe('success', () => {
            beforeEach(async () => {
                amount = tokens(10)

                token.approve(exchange.address, amount, { from: user1 })
                await exchange.depositToken(token.address, amount, { from: user1 })

                result = await exchange.withdrawToken(token.address, amount, { from: user1 })
            })

            it('withdraws token funds', async () => {
                const balance = await exchange.tokens(token.address, user1)
                balance.toString().should.equal('0')
            })

            it('emits a Withdraw event', async () => {
                const args = result.logs[0].args
                const event = result.logs[0].event

                event.toString().should.equal('Withdraw', 'Event is correct')

                args.token.toString().should.equal(token.address, 'token is correct')
                args.user.toString().should.equal(user1, 'user is correct')
                args.amount.toString().should.equal(amount.toString(), 'amount is correct')
                args.balance.toString().should.equal('0', 'balance is correct')
            })
        })

        describe('failure', () => {
            it('rejects withdraws for insufficient balances', async () => {
                await exchange.withdrawToken(token.address, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })

            it('rejects Ether withdraws', async () => {
                await exchange.withdrawToken(ETHER_ADDRESS, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })
        })
    })

    describe('checking balances', () => {
        let amount
        beforeEach(async () => {
            amount = ether(1)
            await exchange.depositEther({ from: user1, value: amount })
        })

        it('tracks the balance', async () => {
            const balance = await exchange.balanceOf(ETHER_ADDRESS, user1)
            balance.toString().should.equal(amount.toString())
        })
    })

    describe('making orders', () => {
        let result

        beforeEach(async () => {
            result = await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), { from: user1 })
        })

        it('tracks the order creation', async () => {
            let orderCount = await exchange.orderCount()
            orderCount.toString().should.equal('1')
            const order = await exchange.orders('1')
            order.id.toString().should.equal('1')
            order.user.should.equal(user1)
            order.tokenGet.should.equal(token.address)
            order.amountGet.toString().should.equal(tokens(1).toString())
            order.tokenGive.should.equal(ETHER_ADDRESS)
            order.amountGive.toString().should.equal(ether(1).toString())
            order.timestamp.toString().length.should.be.at.least(1)
        })

        it('emits an "Order" event', async () => {
            const log = result.logs[0]
            log.event.should.eq('Order')
            const event = log.args
            event.id.toString().should.equal('1')
            event.user.should.equal(user1)
            event.tokenGet.should.equal(token.address)
            event.amountGet.toString().should.equal(tokens(1).toString())
            event.tokenGive.should.equal(ETHER_ADDRESS)
            event.amountGive.toString().should.equal(ether(1).toString())
            event.timestamp.toString().length.should.be.at.least(1)
        })
    })
})