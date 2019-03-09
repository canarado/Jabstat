const botsettings = require('./botsettings.json');
const Discord = require('discord.js');
const fs = require('fs');
const Database = require('./utility/database');
const config = require('./utility/config');
const winston = require('winston');

const prefix = botsettings.prefix;

const client = new Discord.Client({disableEveryone: true});
client.commands = new Discord.Collection();

/****************
* Database Connection
****************/
const db = new Database(config);
db.execute = ( config, callback ) => {
    const database = new Database( config );
    return callback( database ).then(
        result => database.close().then( () => result ),
        err => database.close().then( () => { throw err; } )
    );
};


/****************
* Load Commands
****************/
fs.readdir('./cmds/', (err, files) => {
	if (err) console.log(err);

	let jsfiles = files.filter(f => f.split('.').pop() === 'js');
	if (jsfiles.length <= 0) {
		console.log('No commands to load!');
		return;
	}

	console.log(`Loading ${jsfiles.length} commands!`);

	jsfiles.forEach((f, i) => {
		let props = require(`./cmds/${f}`);
		console.log(`${i + 1}: ${f} loaded!`);
		client.commands.set(props.help.name, props);
	});
});


/****************
* Logger
****************/
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}



/****************
* Ready
****************/
const logUserCount = () => {
  const server = client.guilds.get('343771301405786113');
  const d = new Date();
  const dateSimple = `${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()}`;
  const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
  // log global userCount
  db.execute(config, database => database.query(`SELECT * FROM jabmemberCount WHERE date = '${dateSimple}'`)
  .then(rows => {
    if (rows.length < 1) {
      // insert
      database.query(`
        INSERT INTO jabmemberCount (date, memberCount, updated)
        VALUES ('${dateSimple}', ${server.memberCount}, '${date}')`
      );
      logger.info(`Inserted memberCount ${dateSimple} into jabmemberCount @${date}`);
    } else {
      // update
      database.query(`UPDATE jabmemberCount SET memberCount = ${server.memberCount}, updated = '${date}' WHERE date = '${rows[0].date}'`);
      logger.info(`Updated memberCount ${dateSimple} in jabmemberCount @${date}`);
    }
    return;
  }))
  .catch(err => {
    logger.error(err);
    throw err;
  });
} // logUserCount


const logServerStats = () => {
  const server = client.guilds.get('343771301405786113');
  // DB general stats
  db.execute(config, database => database.query(`SELECT * FROM jabstats`)
  .then(rows => {
    if (rows.length < 1) {
      // insert
      database.query(`
        INSERT INTO jabstats (serverID, name, nameAcronym, memberCount, available, icon, iconURL, region, large, afkTimeout, ownerID, createdAt, createdTimestamp, explicitContentFilter, splash, splashURL, verified)
        VALUES ('${server.id}', '${server.name}', '${server.nameAcronym}', ${server.memberCount}, ${server.available}, '${server.icon}', '${server.iconURL}', '${server.region}', ${server.large}, ${server.afkTimeout}, '${server.ownerID}', '${server.createdAt}', '${server.createdTimestamp}', ${server.explicitContentFilter}, '${server.splash}', '${server.splashURL}', ${server.verified})
      `);
      logger.info(`Inserted serverStats`);
    } else {
      // update
      database.query(`
        UPDATE jabstats SET
          serverID = '${server.id}',
          name = '${server.name}',
          nameAcronym = '${server.nameAcronym}',
          memberCount = ${server.memberCount},
          available = ${server.available},
          icon = '${server.icon}',
          iconURL = '${server.iconURL}',
          region = '${server.region}',
          large = ${server.large},
          afkTimeout = ${server.afkTimeout},
          ownerID = '${server.ownerID}',
          createdAt = '${server.createdAt}',
          createdTimestamp = '${server.createdTimestamp}',
          explicitContentFilter = ${server.explicitContentFilter},
          splash = '${server.splash}',
          splashURL = '${server.splashURL}',
          verified = ${server.verified}
        WHERE id = ${rows[0].id}
      `);
      logger.info(`Updated serverStats`);
    }
    return;
  }))
  .catch(err => {
    logger.error(err);
    throw err;
  });
} // logServerStats


const logChannels = () => {
  const server = client.guilds.get('343771301405786113');
  logger.info(`Start logging channels`);
  server.channels.forEach(c => {
    db.execute(config, database => database.query(`SELECT * FROM jabchannels WHERE channelID = '${c.id}'`)
    .then(rows => {
      if (c.topic == undefined) c.topic = '';
      if (c.nsfw == undefined) c.nsfw = false;
      if (c.lastMessageID == undefined) c.lastMessageID = '';
      if (rows.length < 1) {
        // insert
        database.query(`
          INSERT INTO jabchannels (channelID, name, position, type, topic, nsfw, lastMessageID)
          VALUES ('${c.id}', '${c.name}', ${c.position}, '${c.type}', '${c.topic}', ${c.nsfw}, '${c.lastMessageID}')`
        );
        logger.info(`Inserted ${c.name} into jabchannels`);
      } else {
        // update
        database.query(`
          UPDATE jabchannels SET
            channelID = '${c.id}',
            name = '${c.name}',
            position = ${c.position},
            type = '${c.type}',
            topic = '${c.topic}',
            nsfw = ${c.nsfw},
            lastMessageID = '${c.lastMessageID}'
          WHERE id = ${rows[0].id}
        `);
        logger.info(`Updated ${c.name} in jabchannels`);
      }
      return;
    }))
    .catch(err => {
      logger.error(err);
      throw err;
    });
  });
} // logChannels

//
client.on('ready', async () => {
  console.log('\x1b[32m%s\x1b[0m', `Bot is ready! ${client.user.username}`);
  logger.info(`***************************`);
  logger.info(`Bot started | ${Date.now()}`);

  client.user.setActivity(`collecting stats`, "https://ice-creme.de");

  logServerStats();
  logChannels();

  // *********************
  const server = client.guilds.get('343771301405786113');
  db.execute(config, database => database.query(`SELECT * FROM jabchannels`)
  .then(rows => {

    rows.forEach(c => {
      let id = c.channelID;
      console.log(`FROM DB ${id}`);
      let channel = server.channels.get(id);
      if (!channel) {
        // set channel to deleted
        database.query(`
          UPDATE jabchannels SET deleted = true WHERE channelID = ${id}
        `);
        logger.info(`Updated channel ${id} to deleted`);
      }
    });

  }))
  .catch(err => {
    logger.error(err);
    throw err;
  });
  // *********************

  // log daily userCount
  let now = new Date();
  let millisTill23 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 0) - now;
  if (millisTill23 < 0) {
       millisTill23 += 86400000; // it's after 23:59, try 23:59 tomorrow.
  }
  setTimeout(() => {
    console.log('it\'s 23:59');
    logger.info('it\'s 23:59');
    logUserCount();
  }, millisTill23);
});



/****************
* Message
****************/
client.on('message', async message => {
  let messageArray = message.content.split(/\s+/g);
  let command = messageArray[0];
  let args = messageArray.slice(1);

  if (!command.startsWith(prefix)) return;

  let cmd = client.commands.get(command.slice(prefix.length));
  if (cmd) cmd.run(client, message, args, db);
});


client.on('message', async message => {
  // Database
  const server = client.guilds.get('343771301405786113');

  const d = new Date();
  const dateSimple = `${d.getDate()}.${d.getMonth()}.${d.getFullYear()}`;

  const date = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // log global messageCount
  db.execute(config, database => database.query(`SELECT * FROM jabmessageCount WHERE date = '${dateSimple}'`)
  .then(rows => {

    if (rows.length < 1) {
      // insert
      database.query(`
        INSERT INTO jabmessageCount (date, messageCount, updated)
        VALUES ('${dateSimple}', 1, '${date}')`
      );
      logger.info(`Inserted total messageCount ${dateSimple} into jabmesageCount @${date}`);
    } else {
      // update
      let messageCount = parseInt(rows[0].messageCount) + 1;

      database.query(`UPDATE jabmessageCount SET messageCount = ${messageCount}, updated = '${date}' WHERE date = '${rows[0].date}'`);
      logger.info(`Updated total messageCount ${dateSimple} in jabmesageCount @${date}`);
    }
    return;
  }))
  .catch(err => {
    logger.error(err);
    throw err;
  });


  // log user messageCount
  const author = message.author;

  db.execute(config, database => database.query(`SELECT * FROM jabusers WHERE userID = '${author.id}'`)
  .then(rows => {

    const nickname = message.guild.members.get(author.id).nickname;
    let nicknames = [];

    if (rows.length < 1) {
      nicknames.push(nickname);

      database.query(`
        INSERT INTO jabusers (userID, username, discriminator, nick, nicknames, avatar, bot, lastMessageID, messageCount, updated)
        VALUES ('${author.id}', '${author.username}', '${author.discriminator}', '${nickname}', '${nicknames}', '${author.avatar}', ${author.bot}, '${author.lastMessageID}', 1, '${date}')
      `);
      logger.info(`Inserted ${author.username}'s messageCount & infos into jabusers`);
    } else {
      let messageCount = parseInt(rows[0].messageCount) + 1;
      nicknames = rows[0].nicknames.split(',');

      if (!nicknames.includes(nickname)) nicknames.push(nickname);

      database.query(`
        UPDATE jabusers SET username = '${author.username}', discriminator = '${author.discriminator}', nick = '${nickname}', nicknames = '${nicknames}', avatar = '${author.avatar}', bot = ${author.bot}, lastMessageID = '${author.lastMessageID}', messageCount = ${messageCount}, updated = '${date}' WHERE userID = ${author.id}
      `);
      logger.info(`Updated ${author.username}'s messageCount & infos in jabusers`);
    }

  }))
  .catch(err => {
    logger.error(err);
    throw err;
  });


});


// login
client.login(botsettings.token);
