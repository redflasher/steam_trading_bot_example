var forever = require('forever-monitor');

  var child = new (forever.Monitor)('trade1.js', {
    max: 99999999999,
    silent: true,
    options: [],
    'logFile': '/var/steam_bot/trade1.log', // Path to log output from forever process (when daemonized)
    'outFile': '/var/steam_bot/trade1.out', // Path to log output from child stdout
    'errFile': '/var/steam_bot/trade1.err'  // Path to log output from child stderr
  });

  child.on('exit', function () {
    console.log('trade1.js has exited after 3 restarts');
  });


  child.start();