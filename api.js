const Hub = require('./hub/lib/hub.js');
const RedisAdapter = require('./hub/lib/adapter/redis.js');
const _ = require('koa-route');
const io = require('socket.io')();

const redis = new RedisAdapter();

const hub = new Hub({
  'storageAdapter': redis,
  'provider': 'http://localhost:14700',
  'seed': 'QWERTY9',
  'security': 2
});

const TEST_PREFIX = 'test';

const PROCESS_INTERVAL = 30 * 1000;

const SYNC_INTERVAL = 60 * 1000;

const getHub = async () => {
  const currentHub = await redis.get(TEST_PREFIX, 'current_hub');
  const hubId = currentHub ? currentHub : 0;
  return hubId;
};

const attachHub = async () => {
  const id = await getHub();
  if (hub.isAttached(id)) {
    return false;
  }
  const attach = await hub.attachById(id);
  return attach;
};

const getStats = async () => {
  const stats = {};
  stats.accounts = await redis.get(TEST_PREFIX, 'accounts');
  stats.deposits = await redis.get(TEST_PREFIX, 'deposits');
  stats.sweeps = await redis.get(TEST_PREFIX, 'sweeps');
  stats.credits = await redis.get(TEST_PREFIX, 'credits');
  stats.withdrawals = await redis.get(TEST_PREFIX, 'withdrawals')
  return stats;
};

io.on('connection', async (socket) => {
  const stats = await getStats();
  socket.emit('stats', {'data': stats, 't': Date.now()});
});

io.listen(3030);

hub.on('deposit', (e) => {
  redis.inrc(TEST_PREFIX, 'deposits');
  io.emit('deposit', {'data': e, 't': Date.now()});
});

hub.on('sweep', (e) => {
  redis.incr(TEST_PREFIX, 'sweeps');
  io.emit('sweep', {'data': e, 't': Date.now()});
});

hub.on('credit', (e) => {
  redis.incr(TEST_PREFIX, 'credits');
  io.emit('credit', {'data': e, 't': Date.now()});
});

hub.on('withdraw', (e) => {
  redis.incr(TEST_PREFIX, 'withdrawals');
  io.emit('withdraw', {'data': e, 't': Date.now()});
});

const initHub = async () => {
 
  const hubId = await getHub();

  attachHub();

  setInterval(async () => {

    const hubId = await getHub();
    
    console.log('Processing...');
    const t0 = process.hrtime();
    
    const processed = await hub.process(hubId);
    
    const dt = process.hrtime(t0);
    console.log(`Processed: ${processed}`);
    
    io.emit('processed', {'processed': processed, 't': Date.now(), 'dt': dt});
  
  }, PROCESS_INTERVAL);

  setInterval(async () => {
    
    const hubId = await getHub();

    console.log('Syncing...');
    const t0 = process.hrtime();
    
    const synced = await hub.sync(hubId);
    
    const dt = process.hrtime(t0);
    console.log(`Synced: ${synced}`);

    io.emit('sync', {'synced': synced, 't': Date.now(), 'dt': dt});

    const stats = await getStats();
    console.log(`Accounts: ${stats.accounts} | Deposits: ${stats.deposits} | Sweeps: ${stats.sweeps} | Credits: ${stats.credits} | Withdrawals: ${stats.withdrawals}`);
    
    io.emit('stats', {'data': stats, 't': Date.now()});

  }, SYNC_INTERVAL);

};

initHub();

const api = {public: {}, restricted: {}};

api.public.home = _.get('', (ctx) => {
  ctx.body = 'Hub';
});

api.public.register = _.post('/register', async (ctx) => {

  const {password} = ctx.body;

  if (!password) {
    ctx.body = 'Set a password!';
    return;
  }

  const hubId = await getHub();

  const register = await hub.registerAccount(hubId, password);

  if (register) {
    ctx.body = account;
  }
  else {
    ctx.body = 'Registration failed :(';
  }

});

api.public.account = _.get('/account/:hubId/:accountId', async (ctx, hubId, accountId) => { 

  const account = await hub.getAccount(parseInt(hubId), parseInt(accountId));
  
  if (!account) {
    ctx.body = 'Not found.';
  }
  else {
    ctx.body = account;
  }

});

api.public.deposit = _.get('/deposit/:hubId/:accountId', async (ctx, hubId, accountId) => {

  hubId = parseInt(hubId);
  accountId = parseInt(accountId);

  const account = await hub.getAccount(hubId, accountId);
  
  if (!account) {
    ctx.body = 'Not found.'
    return;
  }

  let address = await hub.getDepositAddress(hubId, accountId);

  if (!address) {
    address = await hub.getNewDepositAddress(hubId, accountId);
  }

  if (address) {
    ctx.body = `Send tokens here: ${address}`;
  }
  else {
    ctx.body = 'Error :('
  }

});

api.public.balanceOnTangle = _.get('/balance/:hubId/:accountId', async (ctx, hubId, accountId) => {

  const balance = await hub.getBalanceOnTangle(parseInt(hubId), parseInt(accountId));

  if (!balance) {
    ctx.body = 'Not Found';
  }
  else {
    ctx.body = `Balance on Tangle: ${balance}`;
  }

});

api.public.credit = _.get('/credit/:hubId/:accountId', async (ctx, hubId, accountId) => {

  const credit = await hub.getCredit(parseInt(hubId), parseInt(accountId));

  if (!credit) {
    ctx.body = 'Not Found';
  }
  else {
    ctx.body = `Credit: ${credit}`;
  }

});

api.public.withdraw = _.post('/withdraw/:hubId/:accountId/:value/:address', async (ctx, hubId, accountId, value, address) => {

  hubId = parseInt(hubId);
  accountId = parseInt(accountId);
  value = parseInt(value);

  if (!('password' in ctx.body)) {
    ctx.body = 'Provide your password!'; 
    return;
  }
  
  if (!hub.isValidAddress(address)) {
    ctx.body = 'Invalid address!';
    return;
  }
 
  if(!Number.isInteger(value)) {
    ctx.body = 'Value must be an integer';
  }

  const account = await hub.getAccount(hubId, accountId);
  
  if (!account) {
    ctx.body = 'Account not found!';
    return;
  }

  if (ctx.body.password !== account.name) {
    ctx.body = 'Invalid password!';
    return;
  }
  
  const options = {
    'address': address,
    'value': value,
    'checkAddress': false
  };

  const withdrawal = await hub.withdraw(hubId, accountId, options);
  
  if (withdrawal) {
    ctx.body = `Tx: ${withdrawal.hash}`;
  }
  else {
    ctx.body = 'Error :(';
  }

});

api.restricted.credit = _.post('/admin/credit/:hubId/:accountId/:value', async (ctx, hubId, accountId, value) => {

  value = parseInt(value);

  if (!Number.isInteger(value)) {
    ctx.body = 'Invalid value';
    return;
  }

  const credit = await hub.credit(parseInt(hubId), parseInt(accountId), value);

});

module.exports = api;

