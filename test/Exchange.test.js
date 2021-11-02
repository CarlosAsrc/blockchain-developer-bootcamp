import { tokens, EVM_REVERT, ETHER_ADDRESS, ether } from './helpers'

const Exchange = artifacts.require('./Exchange')
const Token = artifacts.require('./Token')


require('chai')
    .use(require('chai-as-promised'))
    .should()


contract('Exchange', ([deployer, feeAccount, user1, user2]) => {

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
        it('reverts when Ether is sent', () => {
            exchange.sendTransaction({ value: 1, from: user1 }).should.be.rejectedWith(EVM_REVERT)
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

        it('emits a Deposit event', () => {
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

            it('emits a Withdraw event', () => {
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

            it('emits a Deposit event', () => {
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
            it('rejects ether deposits', () => {
                exchange.depositToken(ETHER_ADDRESS, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })

            it('rejects invalid recipients', () => {
                exchange.depositToken(token.address, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })
        })

    })

    describe('withdrawing tokens', () => {
        let amount
        let result

        describe('success', () => {
            beforeEach(async () => {
                amount = tokens(10)

                await token.approve(exchange.address, amount, { from: user1 })
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
            it('rejects withdraws for insufficient balances', () => {
                exchange.withdrawToken(token.address, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })

            it('rejects Ether withdraws', () => {
                exchange.withdrawToken(ETHER_ADDRESS, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
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

    describe('orders actions', async () => {

        beforeEach(async () => {
            await exchange.depositEther({ from: user1, value: ether(1) })
            await token.transfer(user2, tokens(100), { from: deployer })
            await token.approve(exchange.address, tokens(2), { from: user2 })
            await exchange.depositToken(token.address, tokens(2), { from: user2 })
            await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), { from: user1 })
        })

        describe('filling orders', () => {
            let result

            describe('success', () => {
                beforeEach(async () => {
                    // user2 fills order
                    result = await exchange.fillOrder('1', { from: user2 })
                })
                //user2 should receive 10% less ether
                it('executes the trade & charges fees', async () => {
                    let balance
                    balance = await exchange.balanceOf(token.address, user1)
                    balance.toString().should.equal(tokens(1).toString(), 'user1 received tokens')
                    balance = await exchange.balanceOf(ETHER_ADDRESS, user2)
                    balance.toString().should.equal(ether(1).toString(), 'user2 received Ether')
                    balance = await exchange.balanceOf(ETHER_ADDRESS, user1)
                    balance.toString().should.equal('0', 'user1 Ether deducted')
                    balance = await exchange.balanceOf(token.address, user2)
                    balance.toString().should.equal(tokens(0.9).toString(), 'user2 tokens deducted with fee applied')
                    const feeAccount = await exchange.feeAccount()
                    balance = await exchange.balanceOf(token.address, feeAccount)
                    balance.toString().should.equal(tokens(0.1).toString(), 'feeAccount received fee')
                })

                it('updates filled orders', async () => {
                    const orderFilled = await exchange.orderFilled(1)
                    orderFilled.should.equal(true)
                })

                it('emits a "Trade" event', () => {
                    const log = result.logs[0]
                    log.event.should.eq('Trade')
                    const event = log.args
                    event.id.toString().should.equal('1', 'id is correct')
                    event.user.should.equal(user1, 'user is correct')
                    event.tokenGet.should.equal(token.address, 'tokenGet is correct')
                    event.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
                    event.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct')
                    event.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
                    event.userFill.should.equal(user2, 'userFill is correct')
                    event.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
                })
            })

            describe('failure', () => {

                it('rejects invalid order ids', () => {
                    const invalidOrderId = 99999
                    exchange.fillOrder(invalidOrderId, { from: user2 }).should.be.rejectedWith(EVM_REVERT)
                })

                it('rejects already-filled orders', () => {
                    // Fill the order
                    exchange.fillOrder('1', { from: user2 }).should.be.fulfilled
                    // Try to fill it again
                    exchange.fillOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
                })

                it('rejects cancelled orders', () => {
                    // Cancel the order
                    exchange.cancelOrder('1', { from: user1 }).should.be.fulfilled
                    // Try to fill the order
                    exchange.fillOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
                })
            })
        })

        describe('cancelling orders', async () => {
            let result

            describe('success', async () => {
                beforeEach(async () => {
                    result = await exchange.cancelOrder('1', { from: user1 })
                })

                it('updates cancelled orders', async () => {
                    const orderCancelled = await exchange.orderCancelled('1')
                    orderCancelled.should.equal(true)
                })

                it('emits an "Cancel" event', async () => {
                    const log = result.logs[0]
                    log.event.should.eq('Cancel')
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

            describe('failure', async () => {
                it('rejects invalid order ids', async () => {
                    const invalidId = 9999
                    await exchange.cancelOrder(invalidId, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
                })

                it('rejects unauthorized cancelations', async () => {
                    await exchange.cancelOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
                })
            })
        })

    })
})