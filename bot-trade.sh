#! /bin/sh
### BEGIN INIT INFO
# Provides: forever node
# Required-Start: $remote_fs $syslog
# Required-Stop: $remote_fs $syslog
 Default-Start: 2
 Default-Stop: 0 1 6
# Short-Description: Node.js App Init Script
# Description: This file should be used to construct scripts to be
# placed in /etc/init.d.
# http://blog.aaa-nan.info/2013/02/nodejs-forever.html
### END INIT INFO
 
export PATH=$PATH:/usr/local/bin
export NODE_PATH=$NODE_PATH:/usr/local/lib/node_modules
 
case "$1" in
start)
exec forever -a -l /var/steam_bot/forever_log.log -o /var/steam_bot/server_output.log -e /var/steam_bot/server_errors.log --sourceDir=/var/steam_bot/ -p /usr/local/lib/node_modules/forever/pidfiles start trade1.js
;;
stop)
exec forever --sourceDir=/var/steam_bot/ stop trade1.js
;;
*)
echo "Usage: /etc/init.d/your_app_name {start|stop}"
exit 1
;;
esac
 
exit 0