const botsettings = require('./botsettings.json');
const Discord = require('discord.js');
const fs = require('fs');
const config = require('./utility/config');
const db = require('./utility/databaseconnection');
const logger = require('./utility/logger');
const logColor = require('./utility/logcolors');
const getDate = require('./utility/date');

const bcrypt = require('bcryptjs');
const password = botsettings.password;
const salt = botsettings.salt;
const hash = bcrypt.hashSync(password, salt);

const functions = require('./utility/functions');
const contestFunctions = require('./utility/contest');

const prefix = botsettings.prefix;

// const jabrilID = '430932202621108275'; // Cult of Jabril(s)
const jabrilID = '343771301405786113'; // cremes filthy bot testing area

const client = new Discord.Client({disableEveryone: true});
client.commands = new Discord.Collection();


/****************
* Web
****************/
const socket = require('socket.io');
const express = require('express');
const http = require('http');
const hbs = require('express-handlebars');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.engine('hbs', hbs({
  extname: 'hbs',
  helpers: require("./utility/helpers.js").helpers,
  defaultLayout: 'layout',
  layoutsDir: `${__dirname}/web/layouts`
}));
app.set('views', path.join(__dirname, 'web/views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, '/web/public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


const webServer = http.createServer(app).listen(3000, () => {
  logger.info(`${logColor.green}Jabstats web interface on port 3000${logColor.clear}`, {logType: 'log', time: Date.now()});
});
const io = socket.listen(webServer);


app.get('/', (req, res) => {
  // res.send('index');
  res.render('index', {
    title: 'index'
  });
});


app.get('/contest', (req, res) => {

  // get contests

  res.render('contest', {
    title: 'contest'
  });
});

app.get('/log', (req, res) => {

  let infoPath = path.join(__dirname, 'info.log'),
      errorPath = path.join(__dirname, 'error.log'),
      // infoLog = [],
      infoLog = {},
      errorLog = '';

  const getInfoLog = () => {
    fs.readFile(infoPath, {encoding: 'utf-8'}, (err, data) => {
      if (err) throw err;
      let lines = data.split('\n');
      for (let i = 0; i < lines.length; i++) {
        // let el = {};
        // el.log = lines[i];

        // infoLog.push(el);
        infoLog[i] = lines[i];
      }
      // infoLog[0] = infoLogArray;
      // infoLog = data;
      getErrorLog();
    });
  }

  const getErrorLog = () => {
    fs.readFile(errorPath, {encoding: 'utf-8'}, (err, data) => {
      if (err) throw err;
      errorLog = data;
      renderLog();
    });
  }

  const renderLog = () => {
    // infoLog = `{"log": [${infoLog.replace(/\r?\n|\r/g, '').replace(/}{/g, '},{')}]}`;
    // infoLog = JSON.stringify(infoLog);
    // infoLog = infoLog.replace(/\r?\n|\r/g, '').replace(/}{/g, '},{');

    res.render('log', {
      title: 'log',
      infoLog: infoLog,
      errorLog: errorLog,
    });
  }

  getInfoLog();

});

io.sockets.on('connection', (socket) => {
  logger.info(`${logColor.connect} user connected to webinterface`, {logType: 'connect', time: Date.now()});

  socket.on('verify', (data) => {

    if (bcrypt.compareSync(data.pw, hash)) {
      console.log('logged in!');
    } else {
      console.log('wrong pw!');
    }
  });
});



/****************
* Load Events
****************/
fs.readdir("./events/", (err, files) => {
  if (err) {
    logger.error(err, {logType: 'error', time: Date.now()});
    console.error(err);
    return;
  }
  files.forEach(file => {
    const event = require(`./events/${file}`);
    let eventName = file.split(".")[0];
    client.on(eventName, event.bind(null, client));
  });
});


/****************
* Load Commands
****************/
fs.readdir('./cmds/', (err, files) => {
  if (err) {
    logger.error(err, {logType: 'error', time: Date.now()});
    console.error(err);
    return;
  }

	let jsfiles = files.filter(f => f.split('.').pop() === 'js');
	if (jsfiles.length <= 0) {
    logger.info('No commands to load!', {logType: 'warning', time: Date.now()});
		return;
	}

  logger.info(`Loading ${jsfiles.length} commands!`, {logType: 'log', time: Date.now()});

	jsfiles.forEach((f, i) => {
		let props = require(`./cmds/${f}`);
    logger.info(`${i + 1}: ${f} loaded!`, {logType: 'log', time: Date.now()});
		client.commands.set(props.help.name, props);
    if (props.help.alias) {
      client.commands.set(props.help.alias, props);
    }
	});
});





let server;

client.on('ready', async () => {
  server = client.guilds.get(jabrilID);

  functions.logServerStats(server);
  server.channels.forEach(c => {
    functions.updateChannel(server, c);
  });
  functions.updateChannelDeleted(server);
  functions.logMemberCount(server);

  // log daily userCount
  const dailyLog = () => {
    let now = new Date();
    let millisTill23 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 0) - now;
    if (millisTill23 < 0) millisTill23 += 86400000;
    setTimeout(() => {
      logger.info(`it\'s 23:59`);
      functions.logMemberCount(server);
      dailyLog();
    }, millisTill23);
  }
  dailyLog();


  /****************
  * Check for contest Deadlines
  ****************/
  const checkContests = () => {
    let now = new Date();
    let hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 01, 0) - now;
    if (hour < 0) hour += 3600000;
    setTimeout(() => {
      contestFunctions.checkDeadlines(client);
      checkContests();
    }, hour);
  }
  checkContests();


  // store passwords
  db.execute(config, database => database.query(`SELECT * FROM passwords`)
  .then(rows => {
    if (rows.length < 1) {

      db.execute(config, database => database.query(`INSERT INTO passwords (hash) VALUES ('${hash}')`)
      .then(rows => {
        logger.info(`${logColor.green}stored password hash in database${logColor.clear}`, {logType: 'log', time: Date.now()});
      }))
      .catch(err => {
        throw err;
      });
    } else {
      logger.info(`${logColor.yellow}hash already stored${logColor.clear}`, {logType: 'warning', time: Date.now()});
      let dbHash = rows[0].hash;

      if (dbHash != hash) {
        logger.info(`${logColor.yellow}hash not the same${logColor.clear}`, {logType: 'warning', time: Date.now()});
        db.execute(config, database => database.query(`UPDATE passwords SET hash = '${hash}' WHERE id = 1`)
        .then(rows => {
          logger.info(`${logColor.green}updated password hash in database${logColor.clear}`, {logType: 'log', time: Date.now()});
        }))
        .catch(err => {
          throw err;
        });
      }
    }
  }))
  .catch(err => {
    throw err;
  });
});


client.on('message', async message => {
  // check for emotes in message
  let found = message.content.match(/<a?:([^:]*):([^>]*)>/g);

  if (found != null) {
    for (let i = 0; i < found.length; i++) {
      let emote = found[i].match(/<a?:([^:]*):([^>]*)>/i);
      emote[0].startsWith('<a') ? functions.logEmote(message, emote, true) : functions.logEmote(message, emote);
    }
  }


  functions.logMessageCount(message);
  functions.logMember(message.member, 1);

  let messageArray = message.content.split(/\s+/g);
  let command = messageArray[0];
  let args = messageArray.slice(1);

  if (!command.startsWith(prefix)) return;

  let cmd = client.commands.get(command.slice(prefix.length));
  if (cmd) cmd.run(client, message, args, db);


});


client.on('channelCreate', channel => {
  functions.updateChannel(server, channel, 'create');
});
client.on('channelDelete', channel => {
  functions.updateChannel(server, channel, 'remove');
});
client.on('channelUpdate', channel => {
  functions.updateChannel(server, channel, 'update');
});

// client.on('guildBanAdd', (guild, user) => {
//   functions.updateMemberBanned(user, 1);
// });
// client.on('guildBanRemove', (guild, user) => {
//   functions.updateMemberBanned(user, 0);
// });

client.on('guildMemberAdd', member => {
  functions.logMember(member);
  functions.logMemberCount(server);
});


client.on('guildMemberRemove', member => {
  functions.logMember(member);
  functions.logMemberCount(server);
});


client.on('guildMemberUpdate', (oldMember, newMember) => {
  functions.logMember(newMember);
  functions.logMemberCount(server);
});

client.on('error', err => {
  logger.error(err, {logType: 'error', time: Date.now()});
  console.error(err);
});

// login
client.login(botsettings.token);
