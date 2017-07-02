window.onload = () => {

const socket = io('http://localhost:3030');

const textarea = document.querySelector('#promt');
const log = document.querySelector('#log');

log.style.height = window.innerHeight - 60 + 'px';

const TEST_HUB = '0';

let LOGGING = false;

const append = (value, noSymbol) => {
  const el = document.createElement('div');
  el.classList.add('line');
  let html = '';
  if (!noSymbol) {
    html += '> ';
  }
  el.innerHTML = html + value;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
};

const isJSON = (str) => {
  try {
    JSON.parse(str);
  }
  catch (e) {
    return false;
  }
  return true;
}

const getTime = (timestamp) => {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = "0" + date.getMinutes();
  const seconds = "0" + date.getSeconds();
  return ('[' + hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2) + ']');
};

const lockPromt = () => {
  textarea.setAttribute('disabled', true);
};

const freePromt = () => {
  textarea.removeAttribute('disabled');
  textarea.focus();
}; 

const makeRequest = (method, endpoint, params, cb) => {
  lockPromt();
  const init = {
    method: method
  };
  if (params) {
    let body = [];
    for (let property in params) {
      const encodedKey = encodeURIComponent(property);
      const encodedValue = encodeURIComponent(params[property]);
      body.push(encodedKey + "=" + encodedValue);
    }
    body = body.join("&");
    init.headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    init.body = body;
  }
  fetch('http://localhost:3000' + endpoint, init).then((res) => {
    cb(res);
    freePromt();
  }).catch((err) => {
    append('Error: ' + err.message, true);
    freePromt();
  });
};

const startIO = (socket) => {
  if (!LOGGING) {
    return false;
  }
  socket.on('processed', (data) => {
    console.log(data);
    append('* ' + getTime(data.t) + ' Processed: <b>' + data.processed + '</b>, duration: <b>' + data.dt + '</b> ms', true);
  });
  socket.on('sync', (data) => {
    append('* ' + getTime(data.t) + ' Synced: <b>' + data.synced + '</b>, duration: <b>' + data.dt + '</b> ms', true);
  });
  socket.on('stats', (data) => {
    const d = data.data;
    append('* ' + getTime(data.t)  + ' Accounts: <b>' + d.accounts + '</b> | Deposits: <b>' + d.deposits + '</b> | Sweeps: <b>' + d.sweeps + '</b> | Credits: <b>' + d.credits + '</b> | Withdrawals: <b>' + d.withdrawals + '</b>', true);
  });
  socket.on('deposit', (data) => {
    const d = data.data;
    append('+ ' + getTime(data.t) + ' Deposit > Account: <b>' + d.account + '</b> | Address: <b>' + d.address + '</b> @ keyIndex <b>' + d.keyIndex + '</b> | Value: <b>' + d.value  + '</b>', true);
  });
  socket.on('sweep', (data) => {
    const d = data.data;
    append('~ ' + getTime(data.t) + ' Sweep > Account: <b>' + d.account + '</b> | Address: <b>' + d.address + '</b> @ keyIndex <b>' + d.keyIndex + '</b> | Destination: <b>' + d.destinationAddress  + '</b> | Value: <b>' + d.value  + '</b> | Hash: <b>' + d.hash + '</b>', true);
  });
  socket.on('credit', (data) => {
    const d = data.data;
    append('- ' + getTime(data.t) + ' Credit > Account: <b>' + d.account + '</b> | Value: <b>' + d.value + '</b> | Credit: <b>' + d.credit + '</b> | Address: <b>' + d.address + '</b> | Remainder: <b>' + d.remainder  + '</b> | Tx: <b>' + d.hash + '</b> | Updated account <b>' + d.updatedAccount  + '</b>', true);
    append('- Inputs: <b>' + d.inputs.toString() + '</b>', true);
    append('- Remainder Address: <b>' + d.remainderAddress + '</b>');
  });
  socket.on('withdraw', (data) => {
    const d = data.data;
    append('- ' + getTime(data.t) + ' Withdraw > Account: <b>' + d.account + '</b> | Value: <b>' + d.value + '</b> | Credit: <b>' + d.credit + '</b> | Blanace on tangle: <b>' + d.balanceOnTngle + '</b> | Offchain: <b>' + d.offchain  + '</b>', true);
  });
  socket.on('register', (data) => {
    const info = data.data;
    append('* ' + getTime(data.t)  + 'Registration > Account Id: <b>' + info.id + '</b> | Balance on tangle: <b>' + info.balanceOnTangle + '</b> | Credit: <b>' + info.credit + '</b>', true);
  });
};

const stopIO = (socket) => {
  socket.removeAllListeners('processes');
  socket.removeAllListeners('sync');
  socket.removeAllListeners('deposit');
  socket.removeAllListeners('sweep');
  socket.removeAllListeners('credit');
  socket.removeAllListeners('withdraw');
  socket.removeAllListeners('register');
};

const register = (password) => {
  makeRequest('post', '/register', {'password': password}, (res) => {
    return res.text().then((text) => {
      if (isJSON(text)) {
        const info = JSON.parse(text);
        append('Id: <b>' + info.id + '</b> | Password: <b>' + info.name + '</b> | Balance on tangle: <b>' + info.balanceOnTangle + '</b> | Credit: <b>' + info.credit + '</b>', true);
        append('Use your accound id <b> ' + info.id + '</b> to send queries.');
      }
      else {
        append(text, true);
      }
    });
  });
};

const deposit = (id) => {
  makeRequest('get', '/deposit/' + TEST_HUB + '/' + id, null, (res) => {
    return res.text().then((text) => {
      append(text, true);
    });
  });
};

const getAccountInfo = (id, cb) => {
  makeRequest('get', '/account/' + TEST_HUB + '/' + id, null, cb);
};

const withdraw = (id, password, value, address) => {
  const params = {password: password};
  makeRequest('post', '/withdraw/' + TEST_HUB + '/' + id + '/' + value + '/' + address, params, (res) => {
    return res.text().then((text) => {
      append(text, true);
    });
  });
};

const help = () => {
  const print = [
    '',
    'Available commands:',
    '',
    '<span> - register [name]</span>',
    '<span> - get [accountId]</span>',
    '<span> - deposit [accountId]</span>',
    '<span> - getbalance [accountId]</span>',
    '<span> - getcredit [accountId]</span>',
    '<span> - withdraw [accountId] [password] [value] [address]</span>',
    '<span> - logs',
    '<span> - help</span>',
    ''
  ];
  for (l of print) {
    append(l, true);
  }
};

const execCommand = (input) => {
  input = input.trim();
  const parts = input.split(' ');
  const command = parts[0];
  const n = parts.length;
  
  if (command !== 'logs') {
    LOGGING = false;
    stopIO(socket);
  }

  if (command === 'register') {
    if (n === 2) {
      register(parts[1]);
    }
    else {
      append('! Invalid arguements', true);
    }
  }
  else if (command === 'get') {
    if (n === 2) {
      getAccountInfo(parts[1], (res) => {
        return res.text().then((info) => {
          if (isJSON(info)) {
            info = JSON.parse(info);
          }
          else {
            info = false;
          }
          if (info) {
            append('Id: <b>' + info.id + '</b> | Balance on tangle: <b>' + info.balanceOnTangle + '</b> | Credit: <b>' + info.credit + '</b>', true);
          }
          else {
            append('Error :(');
          }
        });
      });
    }
    else {
      append('! Invalid arguements', true);
    }
  }
  else if (command === 'getbalance') {
    if (n === 2) {
      getAccountInfo(parts[1], (res) => {
        return res.text().then((info) => {
          if (isJSON(info)) {
            info = JSON.parse(info);
          }
          else {
            info = false;
          }
          if (info && ('balanceOnTangle' in info)) {
            append(info.balanceOnTangle, true);
          }
          else {
            append('Error :(', true);
          }
        });
      });
    }
    else {
      append('! Invalid arguements', true);
    }
  }
  else if (command === 'getcredit') {
    if (n === 2) {
      getAccountInfo(parts[1], (res) => {
        return res.text().then((info) => {
          if (isJSON(info)) {
            info = JSON.parse(info);
          }
          else {
            info = false;
          }
          if (info && ('credit' in info)) {
            append(info.credit, true);
          }
          else {
            append('Error :(', true);
          }
        });
      });
    }
    else {
      append('! Invalid arguements', true);
    }
  }
  else if (command === 'deposit') {
    if (n === 2) {
      deposit(parts[1]);
    }
    else {
      append('! Invalid arguemets', true);
    }
  }
  else if (command === 'withdraw') {
    if (n === 5) {
      withdraw(parts[1], parts[2], parts[3], parts[4]);
    }
    else {
      append('! Invalid arguements', true);
    }
  }
  else if (command === 'help') {
    help();
  }
  else if (command === 'logs') {
    LOGGING = true;
    append('Fetching...', true);
    startIO(socket);
  }
  else {
    append('! Command "' + parts[0] + '" not found.');
  }
  return;
};

textarea.focus();

textarea.addEventListener('keydown', (e)  => {
  if (e.which == 13 && ! e.shiftKey) {
    append(e.target.value);
    execCommand(e.target.value);
    e.target.value = '';
    e.preventDefault();
  }
  return;
});

};
