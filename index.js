const authClass = require("./user-auth");
const joi = require("joi");
const uniqid = require("uniqid");
const clr = require("./cli-colors");
const pool = require("./pool");
const env = process.env;
const key = env.AUTH_JWT_KEY;

if (!key) {
  throw `${clr.Red}\n\nERROR: JWT Key not found. Please, add AUTH_JWT_KEY value to .env file${clr.Reset}\n\n`;
}

const auth = new authClass(key);

class userAuthModel {
  constructor(options = {}) {
    this.user = null;

    this.pool = pool;

    this.error = null;

    this.options = {
      // default options
      ...{
        queries: {
          // login query - SELECT * from users where email='some@email.com'
          login: "SELECT * FROM `{{table}}` WHERE `{{login}}`=?",
          // insert query
          insert: "INSERT INTO {{table}} {{fields}} VALUES {{values}}",
          // update query
          insert: "UPDATE {{table}}  set {{fields}} where ?=?",
        },

        tables: {
          users: process.env.AUTH_TABLES_USERS || "users",
          sessions: process.env.AUTH_TABLES_SESSIONS || "sessions",
        },

        userFields: {
          id: env.AUTH_USER_FIELDS_ID || "id",
          login: env.AUTH_USER_FIELDS_LOGIN || "email",
          password: env.AUTH_USER_FIELDS_PASSWORD || "password",
        },

        sessionFields: {
          session_id: env.AUTH_SESSION_FIELDS_SESSION || "sessionId",
          session_user: env.AUTH_SESSION_FIELDS_USER || "userId",
        },

        verification: {
          user: joi.object({
            email: joi.string().email().required(),
            password: joi.string().min(6).required(),
          }),
        },

        // Logger calback for error messages. Default is console.log
        logger: console.log,
      },

      // overrides
      ...options,
    };
  }

  /**
   * Run a dummy query to check DB connection
   */
  async checkConnection() {
    // this query must run if there is a connection and database is selected
    try {
      await pool.query("SHOW TABLES;");
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Retuns user by login/password combination using current configuration or null if not found.
   * @param {*} login
   * @param {*} password
   * @throws {Error} database error when fetching user
   * @returns {object|null}
   */
  async userByLoginAndPassword(login, password) {
    // get users table name from options
    const table = this.options.tables.users;

    // get login field from options
    const field = this.options.userFields.login;

    // get login query from options
    const query = this.options.queries.login
      // replace table placeholder
      .replace(/{{(table)}}/, table)
      // replace field placeholder
      .replace(/{{(login)}}/, field);

    // fetch user from DB
    const [result] = await this.pool.query(query, [login]);
    //const user = result[0]
    return result[0];
  }

  /**
   * Authenticates user: stores session in DB and returns authentication token on success, returns false on fail.
   * @param {*} login
   * @param {*} password
   * @param {function: bool} shouldAuthenticate optional async boolean callback function. If returns false, login process won't be finished. Can be used to additional validation, e.g. user credentials. Set callback's .error property to customize error message.
   * @returns {string|false} Returns token string or false on fail. Error message is stored in instance's .error property.
   */
  async login(login, password, shouldAuthenticate = async () => true) {
    const self = this;

    self.error = null;

    try {
      // get users table name from options
      const table = this.options.tables.users;

      // get login field from options
      const field = this.options.userFields.login;
      const idField = this.options.userFields.id;
      const passwordField = this.options.userFields.password;

      // get login query from options
      const query = this.options.queries.login
        // replace table placeholder
        .replace(/{{(table)}}/, table)
        // replace field placeholder
        .replace(/{{(login)}}/, field);

      // fetch user from DB
      const [result] = await this.pool.query(query, [login]);
      const user = result[0];

      // if user fetched
      if (!(user && user[passwordField] && user[idField])) {
        this.error = "Error fetching user from DB";
        return false;
      }

      // additional validation via callback
      if (!(await shouldAuthenticate(user))) {
        // error for additional validation via shouldAuthenticate
        // set shouldAuthenticate.error to some error text to customize this specific error.
        this.error = shouldAuthenticate.error || "User validation failed";
        return false;
      }

      // create session id
      const sessionId = uniqid();

      // check the password hash and get token
      const token = await auth.auth(
        // login data
        password,
        user.password,
        // payload
        { userId: user[idField], sessionId },
        // expire to default 30 minutes
        30
      );

      // if token received - store session to DB and return token
      if (!token) {
        this.error = auth.error;
        return false;
      }

      this.token = token;
      this.user = user;

      // store session to DB
      if (await this.storeSession(sessionId, user[idField])) {
        return token;
      }

      this.error = "Error storing session";
      return false;
    } catch (e) {
      switch (e.code) {
        case "ECONNREFUSED":
          this.error = "Connection refused";
          this.log(this.error);
          break;
        default:
          this.error = "Error fetching user from DB";
          this.log(this.error);
          break;
      }
      return false;
    }
  }

  async register(user) {
    this.error = null;
    const { value, error } = this.options.verification.user.validate(user);

    if (error) {
      this.error = error.details[0].message;
      return false;
    } else {
      this.log("Registration user data", value);

      // hash the password
      const hash = await auth.hash(user.password);

      if (hash) {
        // replace password with hash
        user.password = hash;

        // prepare insert statement
        const { query, values } = this.prepareInsertStatement(
          user,
          this.options.tables.users
        );

        try {
          // execute insert query
          const [insert] = await this.pool.execute(query, values);
          this.log(insert, insert.insertId);
          return insert.insertId;
        } catch (e) {
          this.log("error registering", e.message);
          let message = "Error writing user to database";
          switch (e.code) {
            // catch duplicate entry error
            case "ER_DUP_ENTRY":
              message = "User with such parameters already exists!";
              break;
          }
          this.error = message;
          return false;
        }
      } else {
        this.error = "Error creating password hash. Registration failed";
        return false;
      }
    }
  }

  async storeSession(sessionId, userId) {
    const { session_id, session_user } = this.options.sessionFields;
    const q = this.prepareInsertStatement(
      {
        [session_id]: sessionId,
        [session_user]: userId,
      },
      this.options.tables.sessions
    );
    try {
      this.log("inserting session");
      const res = await this.pool.query(q.query, q.values);
      this.log("session store result", res);
      return true;
    } catch (e) {
      this.log("error inserting session", e.message);
      this.error = e.message;
      return false;
    }
  }

  /**
   * Prepares insert statement for given table with data from passed item object.
   * Returns an object with two elements: {query, values} to be used like:  pool.execute(query, values)
   * @param {*} item
   * @param {*} table
   */
  prepareInsertStatement(item, table) {
    const fields = "`" + Object.keys(item).join("`, `") + "`";
    const placeholders = Object.keys(item).fill("?").join(", "); // "'" + Object.values(item).join("', '") + "'"
    const values = Object.values(item);

    let query = `INSERT INTO \`${table}\` (${fields}) VALUES(${placeholders});`;
    this.log("prepared insert statement", { query, values });

    return { query, values };
  }

  async logout(token) {
    const content = auth.decodeToken(token);
    if (content) {
      const { sessionId, userId } = content;
      if (sessionId && userId) {
        await this.deleteSesion(sessionId, userId);
      } else {
        this.log("Session id and user id were not found in token");
      }
    } else {
      this.log("Could not decode token");
    }
  }

  async deleteSesion(sessionId, userId) {
    try {
      const { session_id, session_user } = this.options.sessionFields;

      // const sessionIdField = this.options.sessionFields.session_id
      // const userIdField = this.options.userFields.id
      const sessionTable = this.options.tables.sessions;

      await this.pool.query(
        `DELETE FROM ${sessionTable} WHERE ${session_id}=? AND ${session_user}=?`,
        [sessionId, userId]
      );
      this.log("session deleted:", `${sessionId}, ${userId}`);
      return true;
    } catch (e) {
      this.log("deleteSession: " + e.mesage, e);
      return false;
    }
  }

  async verifyToken(token) {
    this.error = null;

    const result = await auth.verifyToken(token);
    if (result.error) {
      this.error = result.error;
      return false;
    } else {
      return result;
    }
  }

  async renewToken(token) {
    try {
      const decoded = await auth.decodeToken(token);

      if (!decoded) {
        return false;
      }

      // TODO: fetch payload from old token, get new token and return
      const { userId, sessionId, iat, exp } = decoded;

      // check whether we actually have session ID and user ID
      if (!(userId && sessionId)) {
        this.error =
          "Error renewing token: Somehow the old token didn't hold userId and/or sessionId";
        this.log(this.error, decoded);
        return false;
      }

      // verify token
      if (!(await this.verifyToken(token))) {
        // delete the session if token not verified
        if (!(await this.deleteSesion(sessionId, userId))) {
          this.log(
            `renewToken: could not delete session ${sessionId} for user ${userId}`
          );
        }
        return false;
      }

      // attempt to fetch expiration time from previous token
      const diff = exp - iat;

      // difference between exp and iat is the expiration time in seconds.
      // if difference is a positive number, use it, divided by 60, otherwise use default 30 minutes
      const expireIn = !isNaN(diff) && diff > 0 ? diff / 60 : 30;

      // return new token
      try {
        return await auth.getToken({ userId, sessionId }, expireIn);
      } catch (e) {
        this.error = "Error fetching new token:" + e.mesage;
        this.log(this.error);
        return false;
      }
    } catch (e) {
      this.error = "Error renewing token: " + e.message;
      this.log(this.error);
      return false;
    }
  }

  log(message, params = {}) {
    this.options.logger(message, params);
  }
}

module.exports = userAuthModel;
module.exports.service = auth;
