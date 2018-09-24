// Load up the discord.js library
const Discord = require("discord.js");
// Apply our changes to the discord.js structures
require("./StructureExtensions")(Discord);
// We also load the rest of the things we need in this file:
const Enmap = require("enmap");
const {
  join,
  dirname
} = require("path");
const {
  readdir
} = require("fs");
class Song {
  constructor(Track, Video) {
    if (Track) this.track = Track;
    if (Video) this.video = Video;
  }
}
// Export the edited client as an extension of the default
module.exports = class Client extends Discord.Client {
  constructor(...args) {
    super(...args);

    // Here we load the config file that contains our token and our prefix values.
    // client.config.token should contain the bot's token
    // client.config.prefix should contain the message prefix
    this.config = require(join(dirname(require.main.filename), args[0]))(this);
    // And set the token to be used for logging into the api
    if (this.config.token) this.token = this.config.token;
    // Generate a cache of client permissions for pretty perm names in commands.
    this.levelCache = this.config.permLevels.reduce((cache, level) => {
      cache[level.name] = level.level;
      return cache;
    }, {});

    // Commands are put in collections where they can be read from,
    // catalogued, listed, etc.
    this.commands = new Map();
    // Now we integrate the use of Evie's awesome Enhanced Map module, which
    // essentially saves a collection to disk. This is great for per-server configs,
    // and makes things extremely easy for this purpose.
    this.guildData = new Enmap({
      name: "guildData"
    });
    this.tempGuildData = {};

    // Add some subcommands to the logger to allow cleaner code
    ["error", "warn", "debug", "cmd"].forEach(mode => this.logger[mode] = e => this.logger(e, mode));

    // These 2 process methods will catch exceptions and give *more details* about the error and stack trace.
    process.on("uncaughtException", (err) => {
      const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
      this.logger.error(`Uncaught Exception: ${errorMsg}`);
      // Always best practice to let the code crash on uncaught exceptions. 
      // Because you should be catching them anyway.
      process.exit(1);
    });

    process.on("unhandledRejection", err => {
      this.logger.error(`Unhandled rejection: ${err}`);
    });
    this.audio = {
      youtubeAPI: require("googleapis").google.youtube({
        version: "v3",
        auth: this.config.youtubeClientToken,
      }),
      refreshSpotifyAccessToken: () => {
        return new Promise(resolve => {
          const client = this;
          const req = require("https").request({
            hostname: "accounts.spotify.com",
            path: "/api/token",
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": `Basic ${Buffer.from(this.config.spotifyClientId + ":" + this.config.spotifyClientSecret).toString("base64")}`
            }
          }, res => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
              client.config.spotifyAccessToken = JSON.parse(data).access_token;
              resolve(true);
            });
          });
          req.write("grant_type=client_credentials");
          req.end();
        });
      },
      Song: Song,
      spotifyApi: endpoint => {
        return new Promise(resolve => {
          require("https").request({
            hostname: "api.spotify.com",
            path: endpoint,
            headers: {
              "Authorization": `Bearer ${this.config.spotifyAccessToken}`
            }
          }, response => {
            let data = "";
            response.on("data", chunk => data += chunk);
            response.on("end", () => resolve(JSON.parse(data)));
          }).end();
        });
      },
      spotifyURI: tag => {
        return new Promise(res => {
          tag = tag.replace(/spotify:|user:/g, "");
          var [type, id] = tag.split(":");
          this.audio.spotifyApi(`/v1/${type}s/${id}`).then(response => {
            const SongGroup = new Map();
            const Tracks = [];
            if (type === "track") {
              Tracks.push(response);
              SongGroup.metadata = {
                type: "track"
              };
            } else {
              // This else statement is actually only considering 'playlist' and 'album' types
              type === "album" ? response.tracks.items.forEach(i => Tracks.push(i) && SongGroup.set(i.id, {})) : response.tracks.items.forEach(i => Tracks.push(i.track) && SongGroup.set(i.id, {}));
              delete response.tracks;
              SongGroup.metadata = response;
            }
            SongGroup.ytIds = new Object();
            Promise.all(Tracks.map(async track => {
              const results = await this.audio.youtubeAPI.search.list({
                part: "id, snippet",
                q: `${type === "album" ? SongGroup.metadata.name : track.artists[0].name} ${track.name}`,
                type: "video",
                safeSearch: "none"
              });
              return SongGroup.ytIds[results.data.items[0].id.videoId] = SongGroup.set(track.id, new this.audio.Song(track, results.data.items[0])).get(track.id);
            })).then(async () => {
              let ytDetails = [];
              while (ytDetails.length < SongGroup.size) {
                const response = await this.audio.youtubeAPI.videos.list({
                  part: "contentDetails",
                  id: Array.from(SongGroup.values()).map(i => i.video.id.videoId).slice(ytDetails.length, ytDetails.length + 50).join(",")
                });
                ytDetails = ytDetails.concat(response.data.items);
              }
              ytDetails.forEach(details => SongGroup.ytIds[details.id].video.contentDetails = details.contentDetails);
              res(SongGroup);
            });
          });
        });
      }
    };
    this.audio.refreshSpotifyAccessToken();
  }

  /**
   * This is a very basic permission system for commands which uses "levels"
   * "spaces" are intentionally left black so you can add them if you want.
   * @constructor
   * @param {User|GuildMember} User The message to check for permlevel
   * @returns {Number} The permission level the
   */
  permlevel(User) {
    let permlvl = 0;
    const isGuildMember = Boolean(User.constructor.name === "GuildMember");
    const permOrder = this.config.permLevels.slice(0).sort((p, c) => p.level > c.level ? 1 : -1);

    while (permOrder.length) {
      const currentLevel = permOrder.shift();
      if (!(isGuildMember) && currentLevel.guildMemberOnly) continue;
      if (currentLevel.check(User)) permlvl = currentLevel.level;
    }
    return permlvl;
  }
  /**
   * Converts a string or number to blocktext. Input must only be one character
   * 
   * Uses the client.config.emojiConvertReference (Set in config.js) to convert
   * any characters that exist in that file, and has a fallback for
   * alphabetical and numerical characters
   * @constructor
   * @param {String|Number} input The value to be converted
   * @returns {String} A blocktext version of the passed string
   */
  toEmojiString(input) {
    if (input.toString()) input = input.toString();
    if (this.config.emojiConvertReference && this.config.emojiConvertReference[input]) return this.config.emojiConvertReference[input];
    if (input.length > 1) return new Error("Input too long");
    if (parseInt(input)) return [":zero:", ":one:", ":two:", ":three:", ":four:", ":five:", ":six:", ":seven:", ":eight:", ":nine:"][input];
    if (/[a-z|A-Z]/.test(input)) return input.replace(/[a-z|A-Z]/, i => `:regional_indicator_${i.toLowerCase()}:`);
    return input;
  }
  /**
   * "Clean" removes @everyone pings, as well as tokens, and makes code blocks
   * escaped so they're shown more easily. As a bonus it resolves promises
   * and stringifies objects!
   * @constructor
   * @param client The client. Used to fetch token to redact
   * @param text The text to clean
   * @returns The text, with token removed and mentions broken
   */
  // TODO: Remove this function.
  async clean(text) {
    if (text && text.constructor.name == "Promise")
      text = await text;
    if (typeof text !== "string")
      text = require("util").inspect(text, {
        depth: 1
      });

    text = text
      .replace(/`/g, "`" + String.fromCharCode(8203))
      .replace(/@/g, "@" + String.fromCharCode(8203))
      .replace(this.token, "mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0");

    return text;
  }
  /**
   * Loads command using file name. Command file format is demonstrated in ./commands/ping.js
   * @constructor
   * @param {String} commandName Name of the js file to load, minus '.js'
   * @returns {String} false if command loaded, Describes error if not
   */
  loadCommand(commandName) {
    let props;
    try {
      props = require(`../commands/${commandName}`);
    } catch (e) {
      return e;
    }
    if (props.init) props.init(this);
    if (!props.help.name) props.help.name = commandName.split(".")[0];
    this.commands.set(props.help.name, props);
    if (props.conf && props.conf.aliases) props.conf.aliases.forEach(alias => this.commands.set(alias, props));
  }
  /**
   * Unloads command using alias / command name.
   * @constructor
   * @param {String} commandName The name of the command to unload
   * @return {String} Name of unloaded command - can be used to [client.loadCommand] in the case that an alias was passed
   */
  async unloadCommand(commandName) {
    const command = this.commands.get(commandName);
    if (!command) return new Error("The command `" + commandName + "` doesn't seem to exist, nor is it an alias. Try again!");
    if (command.shutdown) await command.shutdown(this);
    this.commands.delete(commandName);
    const mod = require.cache[require.resolve(`../commands/${commandName}`)];
    delete require.cache[require.resolve(`../commands/${commandName}.js`)];
    mod.parent.children.some((child, index) => child === mod ? mod.parent.children.splice(index, 1) : false);
    return commandName;
  }
  logger(content, type = "log") {
    console.log(`${new Date(Date.now()).toLocaleTimeString()} [${type.toUpperCase()}] ${content}`);
  }
  loadCommands(dir) {
    // Here we load **commands** into memory, as a collection, so they're accessible
    // here and everywhere else.
    // I've looked into making loading commands asynchronous, however it doesn't really
    // provide any benefit until ~20 commands are being loaded, so I am going to keep
    // the code synchronous for simplicity
    return new Promise(res => {
      readdir(dir, (e, cmdFiles) => {
        this.logger(`Loading a total of ${cmdFiles.length} commands.`);
        cmdFiles.forEach(f => {
          if (!f.endsWith(".js")) return;
          this.logger(`Loading Command: ${f}`);
          const response = this.loadCommand(f);
          if (response) console.log(response);
        });
        res();
      });
    });
  }
  loadEvents(dir) {
    return new Promise(res => {
      // Then we load events, which will include our message and ready event.
      readdir(dir, (e, evtFiles) => {
        this.logger(`Loading a total of ${evtFiles.length} events.`);
        evtFiles.forEach(file => {
          const eventName = file.split(".")[0];
          this.logger(`Loading Event: ${eventName}`);
          const event = require(join(dirname(require.main.filename), dir, file));
          // Bind the client to any event, before the existing arguments
          // provided by the discord.js event. 
          // This line is awesome by the way. Just sayin'.
          this.on(eventName, event.bind(null, this));
        });
        res();
      });
    });
  }
};