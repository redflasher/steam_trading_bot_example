//последнее обновление 08.05.2014

var events = require('events');
var eventEmitter = new events.EventEmitter();

var http = require('http');

var async = require('async');

var mysql      = require('mysql');
var mysqlConn = mysql.createConnection({
  // host     : 'localhost',
  host     : '78.46.20.89',
  port:3306,
  user     : 'steamswap',
  password : '',
  database : 'steamswap'
});

//TODO: проводить закупку исходя из purchase_price (вместо our_price - т.к. это цена продажи) - ok
//TODO: дописать админку (опцию указания цены закупки) - ok


mysqlConn.connect(function(err)
    {
        if(err) console.log('mysql.connection.err: '+err);
        else console.log("mysql connected");
    });

//тестовое время для того, чтобы бот авторизовался. 
//если не успевает - значит завис посреди авторизации и программу следует завершить (чтобы forever перезапустил)
var exitTime = 60;
var needExit = true;//триггер - требуется ли завершить программу. используется совместно со счетчиком тестового времени авторизации
tryAuth();//функция следит, смог ли бот успешно аворизоваться или нет

var botName = "StmForex Bot 1";//имя бота. для каждого бота имя индивидуально. используется в БД и в стиме

var MailListener = require("mail-listener2");
var mailListener = new MailListener({
  username: "bot1@steamforex.com",
  password: "stmbot22",
  host: "imap.yandex.ru",
  port: 993, // imap port
  mailbox: "INBOX", // mailbox to monitor
  markSeen: true, // all fetched email willbe marked as seen and not fetched next time
  fetchUnreadOnStart: true // use it only if you want to get all unread email on lib start. Default is `false`
});

mailListener.start(); // start listening

//получаем письмо и заводим бота
mailListener.on("mail", function(mail){
    // console.log('mail.html',mail.html);

    //BUG: TypeError: Cannot call method 'indexOf' of undefined
    var startIndex = "";
    var code = "";
    if(mail.html !==undefined)
    {
        startIndex = Number(mail.html.indexOf("log in again: </p>"))+26;
        code = String(mail.html).substr(startIndex,5);//ok

        console.log("code:",code);
        logger.info('Received mail with SteamGuard Code. Starting bot...');
        console.log("Bot started: ",(new Date()).toString());
        bot.logOn({
          accountName: login,
          password: password,
          authCode: code
        });
    }
    else
    {
        process.exit();
    }
});


var fs = require('fs');
var winston = require('winston');


var logger = new (winston.Logger)({
        transports: [
                new (winston.transports.Console)({colorize: true}),
                new (winston.transports.File)({level: 'info', timestamp: true, filename: 'cardpool.log', json: false})
        ]
});
var readline = require('readline');

var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
});

var Steam = require('steam');
var bot = new Steam.SteamClient();

var steamtrade = require('steam-trade');
var trade = new steamtrade();

var login = 'stmforex';
var password = 'stmfo00!';


var timeLeft;

var hasTrade = false;
var tradeSession= "";//ссылается на id сессии обмена, чтобы изменять ее статус при наступлении того или иного события
var safeWord;//ссылается на "слово безопасности" (защищает от поддельных ботов)

var isWaitTrade = false;//переменная-указатель статуса "ожидание принятия обмена" (используется после добавления бота в френд-лист)

var oldThemAssets = 0;//используются в waitThemAssets для определения момента, когда поменялось содержимое массива предлагаемых к обмену итемов
var currentThemAssets = -1;//то же

var wrongItem = [];//добавляем сюда не нужные итемы (функция: waitThemAssets)

setInterval(countTradeTime, 1000);//пингуем стим чтобы оставаться "на связи" при обмене итемами

var nextTicket = true;//берем следующий тикет или ждем (идет обработка текущего тикета)


var tradeType ="";//переменная, указывающая, какой тип сделки будет проводиться
var itemsForBuy = {};//содержит список итемов, которые бот продает юзеру ("для покупки юзером")


bot.logOn({
  accountName: login,
  password: password
});




bot.on('loggedOn', function() {
        logger.info('Logged on to Steam');
        // bot.setPersonaState(Steam.EPersonaState.Offline);

        sendMyStatus();//обновляем свой статус в сети каждые 5 минут
});

bot.on('error', function(e) {
        if(e.eresult == Steam.EResult.AccountLogonDenied) {
        }
        else {
        }
});

bot.on('webSessionID', function(sessionid) {
        trade.sessionID = sessionid;
        bot.webLogOn(function(cookie) {

                cookie.toString().split(',').forEach(function(part) {
                        trade.setCookie(part.trim());
                });
                logger.info('Logged into web');
                bot.setPersonaState(Steam.EPersonaState.LookingToTrade);
                needExit = false;
                //обновляем запись в БД о содержимом рюкзака бота
                updateBackpack();
                eventEmitter.emit('lookTasks',true);
        });
});


bot.on('friendMsg', function(steamID, message, type) {
        if(type != Steam.EChatEntryType.ChatMsg) {
                return;
        }
        if(message.toLowerCase() == 'help') {
        }
        else if(message.toLowerCase() == 'credits') {
        }
        else if(message.toLowerCase() == 'donate') {
        }
        else if(message.toLowerCase() == 'confirm') {
        }
        else {
            // bot.sendMessage(steamID, 'Unknown command. Type \'help\' for info.');
        }
});


bot.on('tradeProposed', function(tradeID, steamID) {
    //TODO: делаем запись о том, что кто-то попытался самостоятельно предложить обмен боту
    //wrong_start_trade - "неверная попытка начать обмен" (юзер сам предложил обмен боту)
    mysqlConn.query('UPDATE steambot SET status="wrong_start_trade" WHERE session_id="'+tradeSession+'"', function(e, r, f){});

    bot.sendMessage(steamID,'SteamForex Bot declined your trade offer.\n Please, use steamforex.com for start trade.');
    trade.cancel();

    //TODO: тут обработать случай, когда юзер сам лезет обмениваться, без приглашения бота
    logger.info('Received trade request from ' + steamID);
    trade.cancel();

// TEST: бот отклоняет попытки предложить ему обмен напрямую      
/*        bot.respondToTrade(tradeID, true);
        hasTrade = true;
        setTimeout(function() { hasTrade = false; }, 10000);*/
});

bot.on('friend',function(steamID)
{
    console.log('Friend',steamID,bot.friends.hasOwnProperty(steamID) );//если false - значит только что добавился

    if(!bot.friends.hasOwnProperty(steamID))//бота только что добавили в друзья или он сам добавился
    {
        waitWhileAcceptAsFriend(steamID);
    }
    else
    {
         waitWhileAcceptAsFriend(steamID);
        // console.log(bot.friends[steamID]);

        mysqlConn.query('UPDATE steambot SET status="wait" WHERE session_id="'+tradeSession+'"', function(e, r, f){});
        tradeSession = "";
        eventEmitter.emit('lookTasks',true);//отправляем предложение на обмен после добавления в друзья
    }

/*None: 0,
  Blocked: 1,
  PendingInvitee: 2,
  RequestRecipient: 2,
  Friend: 3,
  RequestInitiator: 4,
  PendingInviter: 4,
  Ignored: 5,
  IgnoredFriend: 6,
  SuggestedFriend: 7,
  Max: 8 } */
});


function waitTrade(steamID)
{
    console.log('waitTrade');

    bot.trade(steamID);
    trade.open(steamID, function() {
    });
    if(isWaitTrade)
    {
        setTimeout(waitTrade,3000,steamID);
    }
}

trade.on('isWaitTrade',function(isWaitTradeStatus)
{
    mysqlConn.query('UPDATE steambot SET status="trade" WHERE session_id="'+tradeSession+'"', function(e, r, f){});

    isWaitTrade = isWaitTradeStatus;
});

//получаем рассылку от index.js о начале торговли. можно смотреть за изменением статуса юзера/торговли
var startTrade = false;
trade.on('startTrade',function(startTrade)
{
    console.log("startTrade");
    mysqlConn.query('UPDATE steambot SET status="processing" WHERE session_id="'+tradeSession+'"', function(e, r, f){});
    startTrade = true;
});

function waitWhileAcceptAsFriend(steamID)
{
    if(bot.friends.hasOwnProperty(steamID) && bot.friends[steamID] == 3)//юзер был в друзьях у бота
    {
        console.log("change friend status");
    }
    else if(bot.friends.hasOwnProperty(steamID) && bot.friends[steamID] == 4)//юзер еще не добавлен
    {
        mysqlConn.query('UPDATE steambot SET status="add_to_friends" WHERE session_id="'+tradeSession+'"', function(e, r, f){});
        bot.sendMessage(steamID,'Welcome to SteamForex Bot!');
        //отправляем запрос на обмен
        // tradeSession = "";
        // eventEmitter.emit('lookTasks',true);
    }
    else
    {
        console.log("waitWhileAcceptAsFriend");
        setTimeout(waitWhileAcceptAsFriend,1000,steamID);
    }
}


bot.on('sessionStart', function(steamid) {
        theirAssets = [];
        myAssets = [];
        theirCredits = 0;
        theirSteamID = steamid;
        timeLeft = 120;
        bot.setPersonaState(Steam.EPersonaState.Busy);
        trade.open(steamid, function() {
                trade.chatMsg('Welcome to SteamForex Bot', function() {

                trade.chatMsg("Check safe word before start trade.");
                trade.chatMsg("Safe word: "+safeWord);
                });
                trade.loadInventory(570, 2, function(inv) {
                        inventory = inv;
                });
        });
});

trade.on('offerChanged',function(isAdd)
{
    console.log('offerChanged');
    eventEmitter.emit('waitThemAssets',true);
});

eventEmitter.on('waitThemAssets',function()
{
    console.log('waitThemAssets');
    currentThemAssets = trade.themAssets.length;

    if(currentThemAssets != oldThemAssets)
    {
        console.log('assets changed');

        
        var items = trade.themAssets;

        //TODO:сделать систему контроля нужных и не нужных итемов (при обмене)
        //проверяем, все ли итемы бот готов покупать. если есть те, которые не нужны - сообщаем об этом юзеру
        //ok (сделано)

        var query = 'SELECT name FROM items_dota2 WHERE ';
        //в этом цикле мы формируем запрос в БД для проверки, не добавил ли юзер не нужные итемы. если добавил - не соглашаемся на обмен, пока он их не уберет
        for(var i=0;i<items.length;i++)
        {
            query+='(name="'+items[i].name+'" AND purchase=0) OR ';//делаем выборку тех итемов, которые нам НЕ нужны
        }
        // return;
        query = query.substr(0,query.length-3);//удаляем из запроса последнее OR
        // console.log(query);
        // console.log(items);
        //включаем "ожидающую"(wait) функцию, в которой будут добавлены(или удалены) элементы в массив wrongItem
        //это делается по той причине, что Valve тупит и только со второго(или более) раза возвращает действительное количество вещей, предложенных на обмен
        //FIXED: решено ^. Дело было в том, что Node.js работает асинхронно и нужно было внести вывод wrongItem в тело mysql-запроса (либо сделать запрос синхронным)
        query = ec_splash(query);

        // console.log("query",query);
        // return;
        if(items.length >0)//если итемов нет, то не выполняем проверку на ненужные итемы
        {
            //выполняем проверку, не предлагает ли нам юзер лишние итемы
            mysqlConn.query(query,function(err,rows,fields)
            {
                // console.log("rows",rows);
                
                wrongItem = [];//обнуляем массив при каждом предложении юзера на обмен итемов (обнуляем - просто для удобства, чтобы не удалять их вручную)
                
                for(var i=0;i<rows.length;i++)
                {
                    wrongItem[i] = rows[i].name;
                }

                // console.log("wrongItem",wrongItem);
            });
        }

        //в цикле производится добавление classid'ов от итемов в рюкзаке юзера - в БД
        for(var i=0;i<items.length;i++)
        {
            mysqlConn.query('SELECT name,classid FROM items_dota2 WHERE name="'+items[i].name+'"', function(err, rows, fields)
            {
                if(err)return;
                // console.log("After select");
                //TODO: протестировать ситуацию, когда не первый добавленный на обмен итем будет с нулевым классидом

                for(var n=0;n<rows.length;n++)
                {
                    console.log(rows[n].classid);
                    if(rows[n].classid == 0)//если classid отсутствует - добавляем его
                    {
                        // console.log("new CLASSID: "+items[i].classid);
                        console.log("new CLASSID: "+items);
                        // mysqlConn.query('UPDATE items_dota2 SET classid="'+items[i].classid+'" WHERE name="'+rows[n].name+'"', function(err2, rows2, fields2)
                        mysqlConn.query('UPDATE items_dota2 SET classid="'+items[0].classid+'" WHERE name="'+rows[n].name+'"', function(err2, rows2, fields2)
                        {
                            // console.log(items[0].classid);
                            // console.log("item was updated.");
                        });
                    }
                }
            });
        }
        oldThemAssets = currentThemAssets;
        if(oldThemAssets == 0)currentThemAssets = -1;

        setTimeout(function()
            {
                eventEmitter.emit('waitThemAssets',true);
            },
            100);

    }
    else
    {
        //BUG: иногда зацикливается (если юзер слишком быстро добавил итем в обменник)
        // setTimeout(waitThemAssets,100);
       /* setTimeout(function()
            {
                eventEmitter.emit('waitThemAssets',true);
            },
            100);*/
    }
});

trade.on('ready',function()
{
    //вызывается, когда юзер ставит галочку "готов к обмену"

    //TODO: протестировать еще раз бота;
    //посмотреть, что делает getItems и дописать код в функции, где есть этот вызов

    if(tradeType==="buy")
    {
        trade.ready(function()
        {
            trade.confirm();
        });
    }

    else if(tradeType === "sell")
    {
        console.log("wrongItem",wrongItem);
        if(wrongItem.length >0)
        {
            //пишем сообщение юзеру, чтобы он удалил из обменника лишнее
            trade.chatMsg('Warning: wrong items!\nPlease, remove next items:',function()
                {
                    var wrongItemsList = "";
                    for(var i=0;i<wrongItem.length;i++)
                    {
                        wrongItemsList+=wrongItem[i]+"\n";
                    }
                    trade.chatMsg(wrongItemsList);
                });
        }
        else//нет ненужных итемов. можно обмениваться.
        {
            //делаем проверку, не превышено ли количество допустимых к обмену итемов
            var numItems = {};
            numItems.items = {};
            for(var i=0;i<trade.themAssets.length;i++)
            {
                if(numItems.items[trade.themAssets[i].name] == undefined)
                {
                    if(numItems.num == undefined) numItems.num = 1;
                    else numItems.num++;
                    numItems.items[trade.themAssets[i].name] = {};
                    numItems.items[trade.themAssets[i].name].count = 1;
                    numItems.items[trade.themAssets[i].name].name = trade.themAssets[i].name;
                }
                else
                {
                    numItems.items[trade.themAssets[i].name].count++;
                    numItems.items[trade.themAssets[i].name].name = trade.themAssets[i].name;
                }
            }
            // console.log(numItems);

            //проверяем, не наложил ли юзер большее число подходящих итемов, чем нам нужно
            var query = 'SELECT * FROM items_dota2 WHERE ';
            for(var item in numItems.items)
            {
                query+='(name="'+numItems.items[item].name+'" AND purchase <"'+numItems.items[item].count+'") OR ';
            }
            query = query.substr(0,query.length-3);//удаляем из запроса последнее OR

            //делаем проверку, не наложил ли юзер вещей больше, чем мы готовы купить
            mysqlConn.query(query,function(err,rows,fields)
            {
                if(err)return;

                var wrongItemNum = {};//массив для записи итемов, количество которых превышено
                wrongItemNum.items = {};
                wrongItemNum.num = 0;

                for(var i=0;i<rows.length;i++)
                {
                    wrongItemNum.items[rows[i].name] = {};
                    wrongItemNum.items[rows[i].name].name = rows[i].name;
                    wrongItemNum.items[rows[i].name].added = numItems.items[rows[i].name].count;
                    wrongItemNum.items[rows[i].name].maxNum = rows[i].purchase;
                    wrongItemNum.num++;
                }
                //перечисляем лишние итемы, если такие есть
                var wrongItemsNumList = "";
                for(var item in wrongItemNum.items)
                {
                    wrongItemsNumList+=wrongItemNum.items[item].name+" (max: "+wrongItemNum.items[item].maxNum+", you added: "+wrongItemNum.items[item].added+")";
                }

                if(wrongItemNum.num >0)//если есть избыточное количество итемов
                {
                    trade.chatMsg("Warning! You have exceeded the number of things:\n"+wrongItemsNumList+"\nPlease, remove excess items, before continue trade.");
                }
                else//если все в порядке
                {
                    trade.ready(function()
                        {
                            trade.confirm();
                        });
                    trade.chatMsg("Fine. Trading...");
                    mysqlConn.query('UPDATE steambot SET status="success" WHERE session_id="'+tradeSession+'"', function(err, rows, fields){});
                }
            });
        }
    }//end sell
});

trade.on('end', function(status, getItems) {
    console.log('trade.on("end"): ',itemsForBuy);
/*    getItems(function(items)
    {
        console.log("getItems: ",items);
    });
*/

    //используется для обновления баланса юзера (после сделки свойство исчезает, поэтому сохраняем его в переменную)
    var stmID = trade.tradePartnerSteamID;


    //если торговля еще не началась - не меняем статус тикета, т.к. это не относится к торговле
    // if(startTrade) return;

//TODO: разобраться, в каких случаях вызывается end

/*
    //steam-trade index.js:

    this.emit('end', {
        2: 'empty', // happens when both parties confirm a trade with no items on either side
        3: 'cancelled',
        4: 'timeout',
        5: 'failed',*/

    //statuses: complete, cancelled

    isStartTrading = false;

  if(status =="complete"
    ||
    status =="failed"
    // ||
    // status =="empty"//этот статус срабатывает, когда юзер не включил стим //TODO: иногда выпадает empty при попытке начать обмен. пофиксить.
    ||
    status =="cancelled"//TODO: отладить этот статус
    ||
    status =="timeout"
    )
  {
    // TODO: не во всех случаях сделка прошла, если есть complete

    console.log("status",status);


    //если Empty - надо написать юзеру, чтобы он открыл свой стим-клиент, прежде чем трейдиться с ботом
    mysqlConn.query('UPDATE steambot SET status="'+status+'" WHERE session_id="'+tradeSession+'"', function(err, rows, fields)
    {
        tradeSession ="";
        eventEmitter.emit('lookTasks',true);
        // if(status !="cancelled")tradeSession ="";//TEST
        // if(status !="cancelled")startTrade = false;
        // startTrade = false;//прекращаем обработку текущего тикета
    });
  }



  if (status == 'complete')
  {

    if(tradeType==="buy")
    {
        console.log("buy trade finished");
        updateBackpack();

        //обновляем записи о зарезервированных итемах(удаляем зарезервированные итемы из таблицы reserved_items)
         mysqlConn.query("DELETE FROM reserved_items WHERE steamid='"+stmID+"'", function(err, rows, fields)
            {
                if(err)console.og("mysql.reserved_items.error: "+err);
                console.log("deleted reserved items");


                var itemsArr = [];
                for(var item in itemsForBuy)
                {
                    // console.log("item src: ",itemsForBuy[item]);
                    itemsArr.push({name:itemsForBuy[item].name,amount:itemsForBuy[item].count});
                }

                //уменьшаем на проданное количество итемов
                //по завершении покупки уменьшаем поле reserved в таблице items_dota2 (когда юзер купил - итем больше не в резервации)
                async.each(itemsArr,function(item)
                {
                    console.log("buy item: ",item);
                    var queryForPrice = 'SELECT name,our_price FROM items_dota2 WHERE name="'+ec_splash(item.name)+'"';
                     mysqlConn.query(queryForPrice,function(err,rows,fields)
                     {
                        if(err)return;

                        console.log('our_price: ',rows);
                        async.each(rows,function(it)
                        {
                            if(item.name === it.name)
                            {
                                //уменьшаем баланс юзера (т.к. он купил вещь)
                                var totalPrice = item.amount * it.our_price;//умножаем кол-во на цену
                                //TODO:перед продажей юзеру вещи проверять, хватает ли у него средств
                                mysqlConn.query('UPDATE users SET credits=credits-'+totalPrice+' WHERE steamid="'+stmID+'"',function(err,rows,fields){});
                                console.log("change user creadit: ",item.amount,it.our_price);
                            }
                        });

                        //обновляем поле "зарезервировано" в купленном итеме (уменьшаем, т.к. юзер выкупил вещь)
                        //TODO: проверить, нужно ли здесь так же и уменьшать in_stock для итема, или это уже где-то есть
                        mysqlConn.query('UPDATE items_dota2 SET reserved=reserved-'+item.amount+' WHERE name="'+item.name+'"',
                        function(e,r,f)
                        {if(e){console.log("buy.error: "+e);return;} });

                     });
                });
            });
    }
    else if(tradeType==="sell")
    {
        getItems(function(items) {
            //определяем количество каждого вида полученного итема
            var gettingItems = {};
            gettingItems.items = {};
            gettingItems.numItems = 0;
            for(var i=0;i<items.length;i++)
            {
                if(gettingItems.items[items[i].name] == undefined)//встретился в массиве впервые
                {
                    gettingItems.items[items[i].name] = {};
                    gettingItems.items[items[i].name].name = items[i].name;
                    gettingItems.items[items[i].name].count = 1;
                    gettingItems.numItems++;
                }
                else
                {
                    gettingItems.items[items[i].name].count++;
                }
            }

            //определяем цены для каждого из итемов
            var queryForPrice = 'SELECT name,purchase_price FROM items_dota2 WHERE ';
            var totalProfit = 0;//суммарная цена всех полученных итемов
            //составляем запрос для обновления данных о требующихся к покупке итемах
            for(var item in gettingItems.items)
            {
                var query='UPDATE items_dota2 SET purchase=purchase-'+gettingItems.items[item].count+', in_stock=in_stock+'+gettingItems.items[item].count+' WHERE name="'+gettingItems.items[item].name+'"';
                mysqlConn.query(query, function(err, rows, fields){});
                queryForPrice +='name="'+gettingItems.items[item].name+'" OR ';
            }
            //обновляем счет юзера
            queryForPrice = queryForPrice.substr(0,queryForPrice.length-4);//удаляем из запроса последнее OR
            mysqlConn.query(queryForPrice, function(err, rows, fields)
                {
                    for(var i=0;i<rows.length;i++)
                    {
                        totalProfit += (gettingItems.items[rows[i].name].count * rows[i].purchase_price);
                    }
                    console.log("totalProfit",totalProfit);
                    console.log("stmID",stmID);//TODO:проверить значение
                    mysqlConn.query('UPDATE users SET credits=credits+'+totalProfit+' WHERE steamid="'+stmID+'"',function(err,rows,fields){});
                });


        tradeSession ="";//сессия так же завершена, можем брать следующую заявку
        });
    }
  }

  //TODO: добавить обновление полей in_stock,
  //а так же таблицу reserved_items

    //если сессия закончена (с каким-либо результатом), то берем следующую заявку из базы
    // tradeSession="";
});


function countTradeTime() {
        if(!trade.tradePartnerSteamID) {
                // tradeSession ="";//TEST
                return;
        }
        timeLeft--;
        if(timeLeft === 60 || timeLeft === 30 || timeLeft === 10) {
                trade.chatMsg('Warning: You have ' + timeLeft + ' seconds left in this trade session.');
        }
        if(timeLeft === 0) {
            // if(timeLeft == 110) {
                tradeSession = "";
                logger.info('Client\'s trade timer expired.');
                // trade.cancel();

                //закончилось время на обмен (юзер протормозил и не успел обменяться)
                mysqlConn.query('UPDATE steambot SET status="time_expired" WHERE session_id="'+tradeSession+'"', function(err, rows, fields)
                {
                    //todo:
                    //hasTrade = false;
                    // tradeSession = "";
                    eventEmitter.emit('lookTasks',true);
                });
        }
        //test
        // console.log("trade offers: ");
        // console.log(bot);
}



function exchangeOffer(steamID)
{
    console.log("exchangeOffer");
    //BUG: TypeError: Cannot call method 'send' of undefined
    //TODO: Fix this bug
    console.log(bot.friends[steamID]);
    if(bot.friends[steamID] === 3)//уже друг
    {
        bot.trade(steamID);
        // trade.open(steamID, function()
        // {
        //     console.log("send exchange offer to "+steamID);
        // });
    }
    else//еще не друг (возможно только добавился)
    {
        bot.addFriend(steamID);
        //TODO: здесь бывало завивание цикла
        console.log("add to friend now");//ожидаем пока юзер подтвердит дружбу
        // eventEmitter.emit('lookTasks',true);
    }
}
//TODO: возможно стоит сделать перезапуск, если бот не проявляет активности в течение 5 минут
//TODO: обработать ситуацию, когда бот предлагает обмен, но юзер не жмет "начать обмен"(зависание на get next ticket)

//Life Cycle
//периодически вызываемая функция, проверяет наличие в БД необработанных задач,
//проверяет, не занят ли бот трейдингом с юзером в данный момент,
//и, если не занят, берет самый ранний запрос на выполнение и стучится к юзеру.
// function lookTasks()

eventEmitter.on('lookTasks',function()
{
    // console.log("lookTasks ",tradeSession,startTrade);
    // console.log("hasTrade: ",hasTrade);
    console.log("tradeSession: ",tradeSession);

    //если текущая сессия обмена не закончена, то не берем следующую заявку
    if(tradeSession !=="")
    // if(nextTicket)
    {
        console.log("breaking");
        setTimeout(eventEmitter.emit,3000,'lookTasks',true);
        // setTimeout(lookTasks,3000);//TEST
        return;
    }

    // console.log("lookTasks");
    // else if(!hasTrade)
    //нет текущей заявки
    else
    {
        console.log("get new ticket");
        //todo remove return
        // return;
        mysqlConn.query('SELECT * FROM steambot WHERE status="wait" ORDER BY id LIMIT 1', function(err, rows, fields) {
          if (err)
            {
                console.log("error:lookTasks.mysql",err);
                setTimeout(eventEmitter.emit,3000,'lookTasks',true);
                //TODO: высылаем е-мейл о том, что закрыт порт к мускулу
                // throw err;
                // return;
            }
            // if(!startTrade) return;
            //TEST
            if(rows === undefined)return;
            if(rows.length >0)
            // if(rows.length >0 && startTrade)
            {
                // console.log(rows[0].timestamp, new Date());
                // return;
                //TODO: протестировать конфликтующие запросы на обмен (одновременно от двух разных юзеров). +сделано
                //TODO: здесь добавить изменение статуса на "в процессе"
                //TODO: убедиться, что hasTrade работает как нужно. и что оно вообще требуется тут (иначе - убрать его)
                // console.log(rows);
                // console.log(rows[0]);
                // console.log(rows[0].steamid);
                tradeSession = rows[0].session_id;
                //обозначаем, что тикет пошел на обработку
                //TODO: если бот уже добавлен в друзья - записываем статус как предложение обмена,
                if((bot.friends.hasOwnProperty(rows[0].steamid) && bot.friends[rows[0].steamid] == 3))
                {
                    mysqlConn.query('UPDATE steambot SET status="offer_trade" WHERE session_id="'+tradeSession+'"', function(e, r, f){});
                    safeWord = rows[0].safeword;

                    // console.log('db info: ',rows[0]);
                    // return;

                    //бот забирает итемы (покупает)
                    if(rows[0].action ==="sell")//юзер продает
                    {
                        console.log("sell action");
                        tradeType = "sell";
                        exchangeOffer( rows[0].steamid );
                    }
                    else if(rows[0].action ==="buy")
                    {
                        mysqlConn.query('SELECT our_price,name,num,item FROM reserved_items,items_dota2 WHERE reserved_items.item=items_dota2.name_for_url AND reserved_items.steamid="'+rows[0].steamid+'" ',
                        function(e, r, f)
                        {
                            console.log("r: ",r);

                            tradeType = "buy";
                            var itemsArr = {};

                            for(var item in r)
                            {
                                // console.log("item: ",r[item]);
                                if(itemsArr[r[item].item ] === undefined)//итем еще не добавлен
                                {
                                    // itemsArr[r[item].item ].name_for_url = r[item].item;
                                    itemsArr[r[item].item ] = {};
                                    itemsArr[r[item].item ].count = r[item].num;
                                    itemsArr[r[item].item ].name = r[item].name;
                                }
                                else
                                {
                                    itemsArr[r[item].item ].count += r[item].num;
                                }
                            }
                            // console.log("buy items: ",itemsArr);
                            if(rows[0].steamid === undefined || itemsArr===undefined)
                            {
                                console.log("rows[0].steamid. error: "+rows[0].steamid);
                            }
                            else
                            {
                                console.log("buy info:",itemsArr,rows[0].steamid);
                                buyOffer(itemsArr,rows[0].steamid);//отправляем в функцию json-массив с итемами, их количеством и названиями
                            }
                        });
                        
                        console.log("buy action");
                    }
                    else
                    {
                        console.log("no known action");
                        tradeType = "no_action";
                    }


                    console.log("get next ticket ",tradeSession);
                    //через 30 секунд стим сбрасывает период ожидания юзера, когда тот нажмет "начать обмен"
                    //включаем счетчик на 20 секунд (время ожидания бота). юзер должен нажать кнопку "Начать обмен"

                    //INFO: вроде окей
                    //временно отменено
                    setTimeout(function()
                    {
                        console.log('user not accessed a offer more than 10 seconds?');
                        mysqlConn.query('SELECT * FROM steambot WHERE status="offer_trade" AND session_id="'+tradeSession+'"', function(e, r, f)
                            {

                                if(r.length >0)
                                {
                                    mysqlConn.query('UPDATE steambot SET status="user_was_slow" WHERE session_id="'+tradeSession+'" AND status="offer_trade" ', function(e1, r1, f1){});
                                    console.log('user not accessed a offer more than 10 seconds.');
                                    tradeSession = "";
                                    trade.cancel();
                                    eventEmitter.emit('lookTasks',true);
                                }
                                else
                                {
                                    //TODO: избавиться от зависания рабочего цикла тут
                                    //сделано: отдебажена ситуация, когда бот не запущен, а юзер кидает тикет
                                    console.log("pause point...");
                                    console.log("user status: ",rows[0]);

                                    //TODO: отдебажить ситуацияю, когда юзер закрывает окно с кнопкой "начат обмен" (зависание, статус юзера - 1)


                                   
                                    /*
                                    * проверяем, в сети ли юзер. если нет - возвращаемся к просмотру тикетов
                                    */
                                    var options = {
                                      host: 'api.steampowered.com',
                                      path: "/ISteamUser/GetPlayerSummaries/v0002/?key=2ACC2BE6E1DDAECD9F0A34D30061FB2C&steamids="+rows[0].steamid,
                                      port: '80',
                                      //This is the only line that is new. `headers` is an object with the headers to request
                                      // headers: {'custom': 'Custom Header Demo works'}
                                    };

                                    callback = function(response) {
                                    var userInfo="";
                                      response.on('data', function (chunk) {
                                        userInfo += chunk;
                                      });

                                      response.on('end', function () {
                                        console.log("userInfo: ");
                                        userInfo = JSON.parse(userInfo);
                                        console.log('person state: ',userInfo.response.players[0].personastate);

                                        if(userInfo.response.players[0].personastate === 0)//юзер был в офлайне
                                        {
                                            mysqlConn.query('UPDATE steambot SET status="offline" WHERE session_id="'+tradeSession+'"', function(e1, r1, f1){});
                                            console.log('user was offline.');
                                            tradeSession = "";
                                            trade.cancel();
                                            eventEmitter.emit('lookTasks',true);
                                        }
                                        else//юзер был в оффлайне, но его действия привели к "зависанию" рабочего цикла
                                        {
                                            //TODO(20.05.2014):
                                            //этот код вызывает преждевременное окончание обмена. удалить или исправить.

                                            //сбрасываем цикл ожидания и возобновляем рабочий цикл бота
                                            mysqlConn.query('UPDATE steambot SET status="another_bug" WHERE session_id="'+tradeSession+'"', function(e1, r1, f1){});
                                            console.log('another bug.');
                                            tradeSession = "";
                                            trade.cancel();
                                            eventEmitter.emit('lookTasks',true);
                                        }
                                      });
                                    };

                                    var req = http.request(options, callback);
                                    req.end();
                                }
                            });

                        // tradeSession = "";
                        // trade.cancel();
                        // eventEmitter.emit('lookTasks',true);
                    },
                    10000//даем 10 секунд на то, чтобы начать обмен
                    );

                    nextTicket = false;//TODO:проверить, используется ли это где-либо или нет
                }
                else if((bot.friends.hasOwnProperty(rows[0].steamid) && bot.friends[rows[0].steamid] == 4))
                {
                    mysqlConn.query('UPDATE steambot SET status="unknown_friend_status" WHERE session_id="'+tradeSession+'"', function(e, r, f){});
                    // mysqlConn.query('UPDATE steambot SET status="user_must_add_bot_to_friends" WHERE session_id="'+tradeSession+'"', function(e, r, f){});
                }
                else//другое состояние
                {
                    // mysqlConn.query('UPDATE steambot SET status="unknown_friend_status" WHERE session_id="'+tradeSession+'"', function(e, r, f){});
                    mysqlConn.query('UPDATE steambot SET status="user_must_add_bot_to_friends" WHERE session_id="'+tradeSession+'"', function(e, r, f){});
                    exchangeOffer( rows[0].steamid );
                }
            }
            else
            {
                // console.log("not rows");
                setTimeout(function()
                {
                    eventEmitter.emit('lookTasks',true);
                },
                3000);
            }
        });
    }
/*    setTimeout(
        function()
        {
            eventEmitter.emit('lookTasks',true);
        },3000);*/
});


var isStartTrading = false;
trade.on('tradeEvent',function()
{
    console.log("tradeEvent.tradeType: ",tradeType);
    //TODO: дописать добавление итемов в окно обмена и сразу за этим нажатие кнопки "обменять"
    if(tradeType === "buy")
    {
        // console.log(itemsForBuy);
        
        var itemsArr = [];
        for(var item in itemsForBuy)
        {
            // console.log("item src: ",itemsForBuy[item]);
            itemsArr.push({name:itemsForBuy[item].name,amount:itemsForBuy[item].count});
        }

        if(isStartTrading)return;
        isStartTrading = true;
        trade.loadInventory(570, 2, function(inv) {
                // inventory = inv;

        async.each(inv,function(item)
        {
            // console.log("a1",item.name);
            // console.log(itemsArr);

            async.each(itemsArr,function(it)
            {
                console.log("a3");
            
                if(it.name === item.name
                    && it.amount>0)//todo:узнаем количество итема в резерве и добавляем
                {
                    it.amount--;
                    console.log("AAA: ",it.name +" ||| "+ item.name);
                    // console.log(item);
                    if(item === undefined)
                    {
                        console.log("tradeEvent.error");
                        return;
                    }
                    else
                    {
                        if(trade ===undefined)
                        {
                            console.log("error: not created trade class");
                            //TODO: перезапускать бота или иным образом обработать эту ошибку
                            return;
                        }
                        else
                        {
                            // console.log("trade.addItem: ",trade.addItem);
                            // console.log("item: ",item);
                            try
                            {
                                trade.addItem(item);
                            }
                            catch(e)
                            {
                                console.log("trade.addItem error: ",e);
                                isStartTrading = false;
                                tradeSession="";
                                trade.emit('lookTasks');
                            }
                        }
                    }
                }
            },
            function(err)
            {
                console.log('err callback 2');
            });

        },
        function(err)//callback
        {
            console.log("err callback");
/*            trade.ready(function()
            {
                trade.confirm();
            });*/
        });

        console.log("op");

/*        trade.ready(function()
        {
            trade.confirm();
        });*/

        });

    }
    else if(tradeType === "sell")
    {

    }
    else
    {

    }
});

//функция покупки у бота итема (бот стучится и добавляет в окно обмена нужные итемы)
function buyOffer(itemsArr,steamID)
{
    console.log("buyOffer ");//,steamID,itemsArr);

    //назначем боту итемы, которые юзер у него покупает
    itemsForBuy = itemsArr;

    if(bot.friends[steamID] == 3)//уже друг
    {
        bot.trade(steamID);
/*        trade.open(steamID, function()
        {
            console.log("send buy offer to "+steamID);
        });*/
    }
    else//еще не друг (возможно только добавился)
    {
        bot.addFriend(steamID);
        //TODO: здесь бывало завивание цикла
        console.log("add to friend now(buy)");//ожидаем пока юзер подтвердит дружбу
        // eventEmitter.emit('lookTasks',true);
    }

/*    //по завершении покупки уменьшаем поле reserved в таблице items_dota2 (когда юзер купил - итем больше не в резервации)
    mysqlConn.query('UPDATE bot_status SET timestamp="'+date+'" WHERE bot_name="'+botName+'"',
    function(e,r,f){});*/
    //перенесено в др. функцию
}
//записываем в БД текущее время, чтобы можно было определить, в "онлайне" сейчас бот или нет
function sendMyStatus()
{
    // console.log("sendMyStatus");
    mysqlConn.query('SELECT bot_name FROM bot_status WHERE bot_name="'+botName+'"',function(err,rows,fields)
    {
        var date = (new Date().getTime()).toString();

        if(rows === undefined)return;
/*        console.log("test/rows: ",rows);
        return;*/
        // console.log(date);
        if(rows.length >0)
        {
            mysqlConn.query('UPDATE bot_status SET timestamp="'+date+'" WHERE bot_name="'+botName+'"',
                function(e,r,f){});
        }
        else
        {
            mysqlConn.query('INSERT INTO bot_status(bot_name,timestamp) VALUES("'+botName+'","'+date+'"")',
                function(e,r,f){});
        }
    });

    setTimeout(sendMyStatus,3600000);
}

//функция следит, смог ли бот успешно аворизоваться или нет
function tryAuth()
{
    console.log('tryAuth');
    if(needExit)
    {
        if(exitTime <=0)
        {
            process.exit();
        }
        exitTime--;
        setTimeout(tryAuth,1000);
    }
    //else - если бот авторизовался, то не вызываем более эту функцию
}

/*
Здесь после каждой сделки актуализируем содержимое рюкзака бота в базу данных
*/
function updateBackpack()
{
    console.log("updateBackpack");
    tradeType ="";
        //для доты2
        trade.loadInventory(570, 2, function(inv) {
            mysqlConn.query('UPDATE items_dota2 SET in_stock="0"',
                function(e,r,f)
                {
                    if(e)
                    {console.log("updateBackpack.error: "+e);}
                    else
                    {
                        for(var item in inv)
                        {
                            mysqlConn.query('UPDATE items_dota2 SET in_stock=in_stock+1 WHERE name="'+inv[item].name+'"',
                            function(e,r,f)
                            {if(e)console.log("updateBackpack.error2: "+e);});
                        }
                    }
                });
        });
        //для тф2
        trade.loadInventory(440, 2, function(inv) {
            mysqlConn.query('UPDATE items_tf2 SET in_stock="0"',
                function(e,r,f)
                {
                    if(e)
                    {console.log("updateBackpack.tf2.error: "+e);}
                    else
                    {
                        for(var item in inv)
                        {
                            mysqlConn.query('UPDATE items_tf2 SET in_stock=in_stock+1 WHERE name="'+inv[item].name+'"',
                            function(e,r,f)
                            {if(e)console.log("updateBackpack.tf2.error2: "+e);});
                        }
                    }
                });
        });


/*    mysqlConn.query('UPDATE bot_status SET timestamp="'+date+'" WHERE bot_name="'+botName+'"',
        function(e,r,f){});*/
}

//TODO: (проверить пофиксены ли эти баги)
/*
пофиксить следующие баги:
1. бот отдает все имеющиеся итемы, вместо количества зарезервированных
2. при продаже (когда бот получает айтемы) в массиве идексом являются Id, что может привести к ошибке если продаются 2 или более одинаковых итема
3. правильно обновлять, записывать, удалять строки из таблиц items_dota2 и reserved_items (иногда данные таблиц не соответствуют рюкзаку бота или резервированию юзера)
4. перед куплей/продажей - проверка, забанен ли юзер на трейд или нет (http://steamcommunity.com/profiles/76561198036370701/?xml=1)
*/

function ec_splash(query)
{
    // var search_chars = ["\\s","\\%","\\(","\\)","\\'","\\:",'\\-','\\!','\\?','\\`','\\&','\\^','\\*'];
    // var replace_chars = ["-","","","","","","-","","","","","",""];

    var search_chars = ["'"];
    var replace_chars = ["\'"];

    for(var n=0;n<search_chars.length;n++)
    {
        query = query.replace(new RegExp(search_chars[n],'g'), replace_chars[n]);
    }
    return query;
}