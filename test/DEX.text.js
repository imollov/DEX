const { tokens, ether, EVM_REVERT, ETHER_ADDRESS } = require('./helpers.js');

const Token = artifacts.require('./Token')
const DEX = artifacts.require('./DEX')

require('chai')
  .use(require('chai-as-promised'))
  .should()

contract('DEX', ([deployer, feeAccount, user1, user2]) => {
  let token
  let dex
  const feePercent = 10

  beforeEach(async () => {
    // Deploy Token
    token = await Token.new(deployer, tokens(1000000))

    // Transfer some tokens to user1
    token.transfer(user1, tokens(100), { from: deployer })

    // Deploy DEX
    dex = await DEX.new(feeAccount, feePercent)
  })

  describe('deployment', () => {
    it('tracks the fee account', async () => {
      const result = await dex.feeAccount()
      result.should.equal(feeAccount)
    })

    it('tracks the fee percent', async () => {
      const result = await dex.feePercent()
      result.toString().should.equal(feePercent.toString())
    })
  })

  describe('fallback', () => {
    it('reverts when Ether is sent', () => {
      dex.sendTransaction({ value: 1, from: user1 }).should.be.rejectedWith(EVM_REVERT)
    })
  })

  describe('depositing Ether', () => {
    let result
    let amount

    beforeEach(async () => {
      amount = ether(1)
      result = await dex.depositEther({ from: user1, value: amount})
    })

    it('tracks the Ether deposit', async () => {
      const balance = await dex.tokens(ETHER_ADDRESS, user1)
      balance.toString().should.equal(amount.toString())
    })

    it('emits a Deposit event', () => {
      const log = result.logs[0]
      log.event.should.eq('Deposit')
      const event = log.args
      event.token.should.equal(ETHER_ADDRESS, 'token address is correct')
      event.user.should.equal(user1, 'user address is correct')
      event.amount.toString().should.equal(amount.toString(), 'amount is correct')
      event.balance.toString().should.equal(amount.toString(), 'balance is correct')
    })
  })

  describe('withdrawing Ether', () => {
    let result
    let amount

    beforeEach(async () => {
      // Deposit Ether first
      amount = ether(1)
      await dex.depositEther({ from: user1, value: amount })
    })

    describe('success', () => {
      beforeEach(async () => {
        // Withdraw Ether
        result = await dex.withdrawEther(amount, { from: user1 })
      })

      it('withdraws Ether funds', async () => {
        const balance = await dex.tokens(ETHER_ADDRESS, user1)
        balance.toString().should.equal('0')
      })

      it('emits a "Withdraw" event', () => {
        const log = result.logs[0]
        log.event.should.eq('Withdraw')
        const event = log.args
        event.token.should.equal(ETHER_ADDRESS)
        event.user.should.equal(user1)
        event.amount.toString().should.equal(amount.toString())
        event.balance.toString().should.equal('0')
      })
    })

    describe('failure', () => {
      it('rejects withdraws for insufficient balances', async () => {
        await dex.withdrawEther(ether(100), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
      })
    })
  })

  describe('depositing tokens', () => {
    let result
    let amount

    describe('success', () => {
      beforeEach(async () => {
        amount = tokens(10)
        await token.approve(dex.address, amount, { from: user1 })
        result = await dex.depositToken(token.address, amount, { from: user1 })
      })

      it('tracks the token deposit', async () => {
        // Check dex token balance
        let balance
        balance = await token.balanceOf(dex.address)
        balance.toString().should.equal(amount.toString())
        // Check tokens on dex
        balance = await dex.tokens(token.address, user1)
        balance.toString().should.equal(amount.toString())
      })

      it('emits a Deposit event', () => {
        const log = result.logs[0]
        log.event.should.eq('Deposit')
        const event = log.args
        event.token.should.equal(token.address, 'token address is correct')
        event.user.should.equal(user1, 'user address is correct')
        event.amount.toString().should.equal(amount.toString(), 'amount is correct')
        event.balance.toString().should.equal(amount.toString(), 'balance is correct')
      })
    })

    describe('failure', () => {
      it('rejects Ether deposits', () => {
        dex.depositToken(ETHER_ADDRESS, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
      })

      it('fails when no tokens are approved', () => {
        // Don't approve any tokens before depositing
        dex.depositToken(token.address, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
      })
    })
  })

  describe('withdrawing tokens', () => {
    let result
    let amount

    describe('success', async () => {
      beforeEach(async () => {
        // Deposit tokens first
        amount = tokens(10)
        await token.approve(dex.address, amount, { from: user1 })
        await dex.depositToken(token.address, amount, { from: user1 })

        // Withdraw tokens
        result = await dex.withdrawToken(token.address, amount, { from: user1 })
      })

     it('withdraws token funds', async () => {
        const balance = await dex.tokens(token.address, user1)
        balance.toString().should.equal('0')
     })

     it('emits a "Withdraw" event', () => {
        const log = result.logs[0]
        log.event.should.eq('Withdraw')
        const event = log.args
        event.token.should.equal(token.address)
        event.user.should.equal(user1)
        event.amount.toString().should.equal(amount.toString())
        event.balance.toString().should.equal('0')
      })
    })

    describe('failure', () => {
      it('rejects Ether withdraws', () => {
        dex.withdrawToken(ETHER_ADDRESS, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
      })

      it('fails for insufficient balances', () => {
        // Attempt to withdraw tokens without depositing any first
        dex.withdrawToken(token.address, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
      })
    })
  })

  describe('checking balances', () => {
    beforeEach(async () => {
      await dex.depositEther({ from: user1, value: ether(1) })
    })

    it('returns user balance', async () => {
      const result = await dex.balanceOf(ETHER_ADDRESS, user1)
      result.toString().should.equal(ether(1).toString())
    })
  })

  describe('making orders', () => {
    let result

    beforeEach(async () => {
      result = await dex.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), { from: user1 })
    })

    it('tracks the newly created order', async () => {
      const orderCount = await dex.orderCount()
      orderCount.toString().should.equal('1')
      const order = await dex.orders('1')
      order.id.toString().should.equal('1', 'id is correct')
      order.user.should.equal(user1, 'user is correct')
      order.tokenGet.should.equal(token.address, 'tokenGet is correct')
      order.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
      order.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct')
      order.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
      order.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
    })

    it('emits an "Order" event', () => {
      const log = result.logs[0]
      log.event.should.eq('Order')
      const event = log.args
      event.id.toString().should.equal('1', 'id is correct')
      event.user.should.equal(user1, 'user is correct')
      event.tokenGet.should.equal(token.address, 'tokenGet is correct')
      event.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
      event.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct')
      event.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
      event.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
    })
  })

  describe('order actions', () => {

    beforeEach(async () => {
      // user1 deposits ether only
      await dex.depositEther({ from: user1, value: ether(1) })
      // give tokens to user2
      await token.transfer(user2, tokens(100), { from: deployer })
      // user2 deposits tokens only
      await token.approve(dex.address, tokens(2), { from: user2 })
      await dex.depositToken(token.address, tokens(2), { from: user2 })
      // user1 makes an order to buy tokens with Ether
      await dex.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), { from: user1 })
    })

    describe('filling orders', () => {
      let result

      describe('success', () => {
        beforeEach(async () => {
          // user2 fills order
          result = await dex.fillOrder('1', { from: user2 })
        })

        it('executes the trade & charges fees', async () => {
          let balance
          balance = await dex.balanceOf(token.address, user1)
          balance.toString().should.equal(tokens(1).toString(), 'user1 received tokens')
          balance = await dex.balanceOf(ETHER_ADDRESS, user2)
          balance.toString().should.equal(ether(1).toString(), 'user2 received Ether')
          balance = await dex.balanceOf(ETHER_ADDRESS, user1)
          balance.toString().should.equal('0', 'user1 Ether deducted')
          balance = await dex.balanceOf(token.address, user2)
          balance.toString().should.equal(tokens(0.9).toString(), 'user2 tokens deducted with fee applied')
          const feeAccount = await dex.feeAccount()
          balance = await dex.balanceOf(token.address, feeAccount)
          balance.toString().should.equal(tokens(0.1).toString(), 'feeAccount received fee')
        })

        it('updates filled orders', async () => {
          const orderFilled = await dex.orderFilled(1)
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
          dex.fillOrder(invalidOrderId, { from: user2 }).should.be.rejectedWith(EVM_REVERT)
        })

        it('rejects already-filled orders', () => {
          // Fill the order
          dex.fillOrder('1', { from: user2 }).should.be.fulfilled
          // Try to fill it again
          dex.fillOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
        })

        it('rejects cancelled orders', () => {
          // Cancel the order
          dex.cancelOrder('1', { from: user1 }).should.be.fulfilled
          // Try to fill the order
          dex.fillOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
        })
      })
    })

    describe('cancelling orders', () => {
      let result

      describe('success', async () => {
        beforeEach(async () => {
          result = await dex.cancelOrder('1', { from: user1 })
        })

        it('updates cancelled orders', async () => {
          const orderCancelled = await dex.orderCancelled(1)
          orderCancelled.should.equal(true)
        })

        it('emits a "Cancel" event', () => {
          const log = result.logs[0]
          log.event.should.eq('Cancel')
          const event = log.args
          event.id.toString().should.equal('1', 'id is correct')
          event.user.should.equal(user1, 'user is correct')
          event.tokenGet.should.equal(token.address, 'tokenGet is correct')
          event.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
          event.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is correct')
          event.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
          event.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
        })
      })

      describe('failure', () => {
        it('rejects invalid order ids', () => {
          const invalidOrderId = 99999
          dex.cancelOrder(invalidOrderId, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
        })

        it('rejects unauthorized cancelations', async () => {
          // Try to cancel the order from another user
          await dex.cancelOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
        })
      })
    })
  })
})