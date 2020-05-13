const settings = require('../botsettings.json');

let mysql;
if(settings.databaseType && settings.databaseType === 'SQLITE')
  mysql = require('better-sqlite3');
else
  mysql = require('mysql');

class Database {
  constructor(config) {
    this.config = config;
    this.databaseType = settings.databaseType || 'MYSQL';
    this.connection;

    this._setConnection();
  }

  _setConnection() {
    if(this.databaseType === 'SQLITE')
      this.connection = new mysql('../jabstat.sqlite');
    else
      this.connection = mysql.createConnection(this.config);
  }

  query(sql, args) {
    return new Promise((resolve, reject) => {
      if(this.databaseType === 'MYSQL') {
        this.connection.query(sql, args, (err, rows) => {
          if (err)
            return reject(err);
          resolve(rows);
        });
      } else {
        let stmt = this.connection.prepare(sql);

        let rows;
        try {
          rows = stmt.get(args);
          resolve(rows);
        } catch(e) {
          reject(e);
        }
      }
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if(this.databaseType === 'MYSQL') {
        this.connection.end(err => {
          if (err)
            return reject(err);
          resolve();
        });
      } else {
        try {
          this.connection.close();
          resolve();
        } catch(e) {
          reject(e);
        }
      }
    });
  }
}

// class Database {
//   constructor(config) {
//     if(settings.databaseType && settings.databaseType === 'SQLITE')
//       this.connection
//     // this.connection = mysql.createConnection(config);
//   }
//   query(sql, args) {
//     return new Promise((resolve, reject) => {
//       this.connection.query(sql, args, (err, rows) => {
//         if (err)
//           return reject(err);
//         resolve(rows);
//       });
//     });
//   }
//   close() {
//     return new Promise((resolve, reject) => {
//       this.connection.end(err => {
//         if (err)
//           return reject(err);
//         resolve();
//       });
//     });
//   }
// }

module.exports = Database;
