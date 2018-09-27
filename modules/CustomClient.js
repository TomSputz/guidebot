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
  constructor(Track, Video, ytapi) {
    this.youtubeAPI = ytapi;
    if (Track) this.track = Track;
    if (typeof Video === "object") this.video = Video;
    if (typeof Video === "string") this.getVideo(Video);
    if (this.track && !this.video) this.getVideo;
  }
  getVideo(term) {
    return new Promise(res => {
      this.youtubeAPI.search.list({
        part: "id, snippet",
        q: term ? term : `${this.track.artists[0].name} ${this.track.name}`,
        type: "video",
        safeSearch: "none"
      }).then(results => res(this.video = results.data.items[0]));
    });
  }
  // Ids should be an array of extra Ids to evaluate. Maximum 50 including this video (50 for youtube api - 1 for this video)
  getVideoDetails(Ids) {
    let included = false;
    if (!Ids.includes(this.video.id.videoId)) {
      Ids.push(this.video.id.videoId);
      included = true;
    }
    if (Ids.length > 50) return new Error("Too many Ids");
    if (!this.video) return new Error("This song has no video");
    return new Promise(res => {
      this.youtubeAPI.videos.list({
        part: "contentDetails",
        id: Ids.join(",")
      }).then(response => {
        this.video.contentDetails = response.find(i => i.video.id.videoId === this.video.id.videoId);
        if (!included) Ids.pop();
        res(response.data.items.map(i => i.contentDetails));
      });
    });
  }
}
class Queue extends Array {
  // SongGroup objects are maps containing any amount of Song objects, this class
  // just adds a few methods to make interacting with that easier
  constructor(...args) {
    super(...args);
  }
  list() {
    let list = [];
    if (!this[0]) return list;
    const maps = this.slice();
    while (maps[0]) {
      const map = maps.shift();
      list = list.concat(Array.from(map.values()));
    }
    return list;
  }
  get(index) {
    const maps = this.slice();
    if (!maps[0]) throw new Error("No songs in list");
    while (index > maps[0].length - 1) {
      index -= maps[0].length;
      maps.shift();
    }
    return Array.from(maps[0])[index];
  }
  size() {
    let count = 0;
    this.forEach(i => count += i.length);
    return count;
  }
}
class QueuedConnection {
  constructor(VoiceConnection, AudioShard) {
    this.Connection = VoiceConnection;
    this.Manager = AudioShard;
    this.Queue = new Queue();
    this.queueIndex = 0;
    this.Panels = {
      activePanel: {

      },
      Types: {
        control: {
          generator: () => {
            return new Discord.MessageEmbed({
              title: "Generated embed with " + this.guildId
            });
          },
          callback: (message) => {
            message.react("ℹ");
          }
        }
      }
    };
  }
  playYtId(Id) {
    return new Promise(res => {
      this.Connection.play(this.AudioShard.AudioModule.ytdl(`http://youtube.com/watch?v=${Id}`, {
        filter: "audioonly"
      })).then(res);
    });
  }
  panelType(id, generator, callback) {
    // Use this method to assign panelTypes in case we want to do checks at any point
    this.Panels.Types[id] = {
      generator: generator,
      callback: callback
    };
  }
  summonPanel(channel, type = "control") {
    if (this.Panels.activePanel.deletable) this.Panels.activePanel.delete();
    if (!this.Panels.Types[type]) return new Error("Invalid panel type");
    channel.send(this.Panels.Types[type].generator()).then(m => {
      this.Panels.activePanel = m;
      this.Panels.Types[type].callback(m);
    });
  }
}
class AudioShard {
  constructor(AudioModule, guildId) {
    this.Manager = AudioModule;
    this.GuildId = guildId;
    this.Channels = {};
  }
  connect(VoiceChannel) {
    return new Promise(res => {
      VoiceChannel.join().then(Connection => {
        this.Channels[VoiceChannel.id] = new QueuedConnection(Connection, this);
        res(this.Channels[VoiceChannel.id]);
      });
    });
  }
}
class AudioModule {
  constructor(client) {
    this.client = client;
    this.AudioModuleShard = AudioShard;
    this.Queue = Queue;
    this.Shards = new Map();
    this.youtubeAPI = require("googleapis").google.youtube({
      version: "v3",
      auth: this.client.config.youtubeClientToken,
    });
    this.ytdl = require("ytdl-core");
    this.refreshSpotifyAccessToken();
  }
  refreshSpotifyAccessToken() {
    return new Promise(resolve => {
      const req = require("https").request({
        hostname: "accounts.spotify.com",
        path: "/api/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(this.client.config.spotifyClientId + ":" + this.client.config.spotifyClientSecret).toString("base64")}`
        }
      }, res => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          this.client.config.spotifyAccessToken = JSON.parse(data).access_token;
          resolve(true);
        });
      });
      req.write("grant_type=client_credentials");
      req.end();
    });
  }
  spotifyApi(endpoint) {
    return new Promise(resolve => {
      require("https").request({
        hostname: "api.spotify.com",
        path: endpoint,
        headers: {
          "Authorization": `Bearer ${this.client.config.spotifyAccessToken}`
        }
      }, response => {
        let data = "";
        response.on("data", chunk => data += chunk);
        response.on("end", () => resolve(JSON.parse(data)));
      }).end();
    });
  }
  spotifyURI(tag) {
    return new Promise(res => {
      tag = tag.replace(/spotify:|user:/g, "");
      tag = tag.split(":").slice(-2);
      const type = tag[0].trim();
      const id = tag[1].trim();
      this.spotifyApi(`/v1/${type}s/${id}`).then(async response => {
        while (type === "playlist" && response.tracks.next) {
          const res2 = await this.spotifyApi(response.tracks.next.slice(23));
          response.tracks.items = response.tracks.items.concat(res2.items);
          response.tracks.next = res2.next;
        }
        let TrackList;
        const returnObj = [];
        if (type === "track") {
          TrackList = [response];
          returnObj.metadata = {
            type: "track"
          };
        } else {
          // This else statement is actually only considering 'playlist' and 'album' types
          TrackList = type === "album" ? response.tracks.items : response.tracks.items.map(i => i.track);
          delete response.tracks.items;
          returnObj.metadata = response;
        }
        for (let i = 0; i < TrackList.length; i++) {
          returnObj.push(new Song(TrackList[i], `${type === "album" ? returnObj.metadata.name : TrackList[i].artists[0].name} ${TrackList[i].name}`, this.youtubeAPI));
        }
        returnObj.fetchDetails = function(index, tempData) {
          if (!this[index]) return new Error("Song does not exist");
          return new Promise(async res => {
            let items = [];
            while (items.length < this.length) {
              const startindex = Math.max(0, index - 10);
              const videos = this.slice(startindex, startindex + 50);
              await tempData.Audio.Manager.youtubeAPI.videos.list({
                part: "contentDetails",
                id: videos.map(i => i.video.id.videoId).join(",")
              }).then(response => items = items.concat(response.data.items));
            }
            for (let i = 0; i < this.length; i++) {
              this[i].video.contentDetails = items[i].contentDetails;
            }
            res(this);

          });
        };
        res(returnObj);
      });
    });
  }
  wakeShard(guildId) {
    const Shard = this.Shards.has(guildId) ? this.Shards.get(guildId) : this.Shards.set(guildId, new AudioShard(this, guildId)).get(guildId);
    this.client.tempGuildData.get(guildId).Audio = Shard;
    return Shard;
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
    this.tempGuildData = new Map();

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

    this.AudioModule = new AudioModule(this);
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