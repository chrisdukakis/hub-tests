const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const json = require('koa-json');

const api = require('./api.js');

const {public, restricted} = api;

const app = new Koa();

app.use(bodyParser());

app.use(json());

app.use(async (ctx, next) => {
  ctx.set('Access-Control-Allow-Origin', '*');
  await next();
});

app.use(async (ctx, next) => {
  ctx.body = ctx.request.body;
  await next();
});

populate(public);

app.use(async (ctx, next) => {

  const {secret} = ctx.body;

  if (secret === 'top') {
    await next();
  }
  else {
    ctx.body = 'Hub';
  }

});

populate(restricted); 
  
app.listen(3000);
console.log('Listening on port 3000');

function populate(api) {
  for (const route of Object.keys(api)) {
    app.use(api[route]);
  }
  return Promise.resolve();
}

