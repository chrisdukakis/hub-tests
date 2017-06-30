const Hub = require('./hub/lib/hub.js');
const RedisAdapter = require('./hub/lib/adapter/redis.js');

const redis = new RedisAdapter();

const HOT_WALLET_SEED = 'QWERTY9';
const NUM_HOT_WALLET_ADDRESSES = 10;
const HUB_SEED = 'ASDFGH9';

const hub = new Hub({
  'storageAdapter': redis,
  'provider': 'http://localhost:14700',
  'seed': HOT_WALLET_SEED,
  'security': 2
});

const setup = async () => {
 
  const testHub = await hub.create(0, {
    'seed': HUB_SEED,
    'security': 2,
    'name': 'testhub'
  });

  console.log('Created testhub #0', testHub);

  for (let i = 0; i < NUM_HOT_WALLET_ADDRESSES; i++) {

    const input = await hub.createHotWalletInput(0);
  
    if (input) {
      console.log(`Created hot wallet address ${input.address} @ keyIndex ${input.keyIndex}`);
    }

  }

};

setup().then(() => {
  console.log('ready!');
  process.exit();
});
