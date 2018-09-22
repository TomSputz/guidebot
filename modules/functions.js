const { Structures, MessageEmbed } = require("discord.js");
module.exports = (client) => {
  /**
   * This is a very basic permission system for commands which uses "levels"
   * "spaces" are intentionally left black so you can add them if you want.
   * @constructor
   * @param {User|GuildMember} User The message to check for permlevel
   * @returns {Number} The permission level the
   */
  client.permlevel = User => {
    let permlvl = 0;
    const isGuildMember = Boolean(User.constructor.name === "GuildMember");
    const permOrder = client.config.permLevels.slice(0).sort((p, c) => p.level > c.level ? 1 : -1);

    while (permOrder.length) {
      const currentLevel = permOrder.shift();
      if (!(isGuildMember) && currentLevel.guildMemberOnly) continue;
      if (currentLevel.check(User)) permlvl = currentLevel.level;
    }
    return permlvl;
  };
  /**
   * This function merges the default settings (from config.defaultSettings) with any
   * guild override you might have for particular guild. If no overrides are present,
   * the default settings are used.
   * @constructor
   * @param {String} guildid The id of the guild to fetch settings for
   * @returns {Object} Parsed settings for the guild
   */
  client.getSettings = guildid => {
    const defaults = client.config.defaultSettings || {};
    if (!guildid) return defaults;
    const guildData = client.guildData.get(guildid).settings || {};
    const returnObject = {};
    Object.keys(defaults).forEach((key) => returnObject[key] = guildData[key] ? guildData[key] : defaults[key]);
    return returnObject;
  };
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
  client.toEmojiString = (input) => {
    if (input.toString()) input = input.toString();
    if (client.config.emojiConvertReference && client.config.emojiConvertReference[input]) return client.config.emojiConvertReference[input];
    if (input.length > 1) return new Error("Input too long");
    if (parseInt(input)) return [":zero:", ":one:", ":two:", ":three:", ":four:", ":five:", ":six:", ":seven:", ":eight:", ":nine:"][input];
    if (/[a-z|A-Z]/.test(input)) return input.replace(/[a-z|A-Z]/, i => `:regional_indicator_${i.toLowerCase()}:`);
    return input;
  };
  Structures.extend("TextChannel", OldTextChannel => {
    class TextChannel extends OldTextChannel {
      /**
       * Sends an embed with parameters to the this channel.
       * @constructor
       * @param {String} title The title for the Embed
       * @param {String} description The description for the Embed
       * @param {Color} color The color for the Embed
       * @returns {Promise} Resolves to the sent message
       */
      coloredEmbed(title, description, color) {
        return new Promise((resolve, reject) => {
          this.send(new MessageEmbed({
            type: "rich",
            title: title,
            description: description,
            color: color
          })).then(resolve).catch(reject);
        });
      }
      /**
       * Sends an Embed to the given Channel describing a success - Has title 'Success' and uses discord's Online color
       * @constructor
       * @param {String} description The description for the Embed
       * @returns {Promise} Resolves to the sent message
       */
      successEmbed(description) {
        this.coloredEmbed("Success", description, 0x43B581);
      }
      /**
       * Sends an Embed to the given Channel describing an error - Has title 'Error' and uses discord's DND color
       * @constructor
       * @param {String} description The description for the Embed
       * @returns {Promise} Resolves to the sent message
       */
      errorEmbed(description) {
        this.coloredEmbed("Error", description, 0xF04747);
      }
      /**
       * Prompts user to choose string from array using reactions
       * @constructor
       * @param {String[]} options An array of strings representing the choices for the user
       * @param {Function} [filter] Filter for who is allowed to respond to prompt. Should return true if user is allowed. If not given, anyone can respond
       * @param {(Embed|String)} [description] Used as message to send to channel, will be given reactions up to the number of strings in [options]. Should explain what each option mean
       * @param {Number} [timeout=60000] How long to wait for a response in milliseconds
       * @returns {Promise.<Array.<String,User>|Error>} resolves to array containing response as string and author
       */
      multiplePrompt(options, filter, description = 0, timeout = 60000) {
        return new Promise((resolve, reject) => {
          if (options.length == 0) return reject(new Error("No options"));
          if (options.length == 1) return resolve(options[0]);
          if (options.length > 9) return reject(new Error("Too many options"));
          this.send(["Embed", "String"].includes(description.constructor.name) ? description : new Discord.MessageEmbed({
            type: "rich",
            title: "Multiple Choice",
            description: "React to this message to choose.\n\n" + options.map(i => this.client.toEmojiString(options.indexOf(i) + 1) + " " + i).join("\n")
          })).then(async (prompt) => {
            prompt.reactives = [];
            const collector = prompt.createReactionCollector((reaction, user) => !(user.bot) && reaction.message.reactives.includes(reaction) && (filter ? filter(user) : true), {
              max: 1,
              time: timeout
            });
            collector.on("collect", (reaction, user) => (reaction.emoji.name == "❌" && reject(new Error("User rejected"))) || resolve([options[parseInt(reaction.emoji.identifier.charAt(0)) - 1], user]));
            collector.on("end", (messages, reason) => {
              if (prompt.deletable) prompt.delete();
              if (reason == "time") reject(new Error(reason));
            });
            await prompt.react("❌").then(r => r.message.reactives.push(r)).catch(() => NaN);
            for (let i = 0; i < options.length; i++) await prompt.react((i + 1) + "%E2%83%A3").then(r => r.message.reactives.push(r)).catch(() => NaN);
          });
        });
      }
      /**
       * A simple way to grab a single reply, from the user that initiated
       * the command. Useful to get "precisions" on certain things...
       * @constructor
       * @param {Embed|String} question The question to send to the channel
       * @param {Number} [timeout=60000] How long to wait for a response in milliseconds
       * @param {Function} [filter] Filter for who is allowed to respond to prompt. Should return true if user is allowed. If not given, anyone can respond
       * @returns {Promise.<String|Array.<String,User>|Error>} Resolves to user's answer. If no filter is defined, resolves to array containing response as string and author
       */
      textPrompt(question, filter, timeout = 60000) {
        return new Promise((resolve, reject) => {
          this.send(question).then(prompt => {
            const collector = this.createMessageCollector(message => !(message.author.bot) && (filter ? filter(message.author) : true), {
              max: 1,
              time: timeout
            });
            collector.on("collect", response => resolve([response.content, response.author]));
            collector.on("end", (messages, reason) => {
              if (prompt.deletable) prompt.delete();
              if (reason == "time") reject(new Error(reason));
            });
          });
        });
      }
      /**
       * Prompt the user to react yes/no to a question
       * @constructor
       * @param {Embed|String} question The question to send to the channel
       * @param {Function} [filter] Filter for who is allowed to respond to prompt. Should return true if user is allowed. If not given, anyone can respond
       * @param {Array.<EmojiResolvable>} reacts The emojis used to respond with in order [False, True]
       * @param {Number} [timeout=60000] How long the question should stay alive
       * @returns {Promise.<Boolean|Array.<Boolean,User>|Error} Resolves to user's answer. If no subject is defined, resolves to array containing response as string and author. If the question times out, it will throw a 'time' error
       */
      booleanPrompt(question, filter, reacts = ["❌", "✅"], timeout = 60000) {
        return new Promise((resolve, reject) => {
          this.send(question).then(prompt => {
            prompt.reactives = [];
            const collector = prompt.createReactionCollector((reaction, user) => !(user.bot) && reaction.message.reactives.includes(reaction) && (filter ? filter(user) : true), {
              max: 1,
              time: timeout
            });
            collector.on("collect", (reaction, user) => resolve([Boolean(reacts.indexOf(reaction.emoji.name)), user]));
            collector.on("end", (messages, reason) => {
              if (prompt.deletable) prompt.delete();
              if (reason == "time") reject(new Error(reason));
            });
            prompt.react(reacts[1]).then(r => {
              prompt.reactives.unshift(r);
              prompt.react(reacts[0]).then(r => prompt.reactives.unshift(r)).catch(() => NaN);
            }).catch(() => NaN);
          });
        });
      }
      /**
       * Gets user's nickname
       * @constructor
       * @param {User} [user=client.user] The user who's name to check
       * @returns {String} The nickname of the user relating to this message
       */
      getNickname(user = this.client.user) {
        if (!this.guild) return user.username;
        const nickname = this.guild.members.get(user.id).nickname;
        if (nickname) return nickname;
        return user.username;
      }
    }
    return TextChannel;
  });
  Structures.extend("Message", OldMessage => {
    class Message extends OldMessage {
      /**
       * Prompts user to choose string from array using reactions
       * @constructor
       * @param {String[]} options An array of strings representing the choices for the user
       * @param {(Embed|String)} [description] Used as message to send to channel, will be given reactions up to the number of strings in [options]. Should explain what each option mean
       * @param {Number} [timeout=60000] How long to wait for a response in milliseconds
       * @returns {Promise.<String|Error>} Resolves to the string the user chose
       */
      multiplePrompt(options, description = 0, timeout = 60000) {
        return new Promise((resolve, reject) => {
          if (options.length == 0) return reject(new Error("No options"));
          if (options.length == 1) return resolve(options[0]);
          if (options.length > 9) return reject(new Error("Too many options"));
          this.channel.send(["Embed", "String"].includes(description.constructor.name) ? description : new Discord.MessageEmbed({
            type: "rich",
            title: "Multiple Choice",
            description: "React to this message to choose.\n\n" + options.map(i => this.client.toEmojiString(options.indexOf(i) + 1) + " " + i).join("\n")
          })).then(async (prompt) => {
            prompt.reactives = [];
            const collector = prompt.createReactionCollector((reaction, user) => !(user.bot) && reaction.message.reactives.includes(reaction) && this.author == user, {
              maxEmojis: 1,
              time: timeout
            });
            collector.on("collect", reaction => (reaction.emoji.name == "❌" && reject(new Error("User rejected"))) || resolve(options[parseInt(reaction.emoji.identifier.charAt(0)) - 1]));
            collector.on("end", (messages, reason) => {
              if (prompt.deletable) prompt.delete();
              if (reason == "time") reject(new Error(reason));
            });
            await prompt.react("❌").then(r => r.message.reactives.push(r)).catch(() => NaN);
            for (let i = 0; i < options.length; i++) await prompt.react((i + 1) + "%E2%83%A3").then(r => r.message.reactives.push(r)).catch(() => NaN);
          });
        });
      }
      /**
       * A simple way to grab a single reply, from the user that initiated
       * the command. Useful to get "precisions" on certain things...
       * @constructor
       * @param {Embed|String} question The question to ask the author
       * @param {Number} [timeout=60000] How long to wait for a response in milliseconds
       * @returns {Promise.<String|Error>} Resolves to user's answer.
       */
      textPrompt(question, timeout = 60000) {
        return new Promise((resolve, reject) => {
          this.channel.send(question).then(prompt => {
            const collector = this.channel.createMessageCollector(m => m.author == this.author, {
              max: 1,
              time: timeout
            });
            collector.on("collect", response => resolve(response.content));
            collector.on("end", (messages, reason) => {
              if (prompt.deletable) prompt.delete();
              if (reason == "time") reject(new Error(reason));
            });
          });
        });
      }
      /**
       * Prompt the user to react yes/no to a question
       * @constructor
       * @param {Embed|String} question The question to send to the channel
       * @param {Array.<EmojiResolvable>} reacts The emojis used to respond with in order [False, True]
       * @param {Number} [timeout=60000] How long the question should stay alive
       * @returns {Promise.<Boolean|Error} Resolves to user's answer.
       */
      booleanPrompt(question, reacts = ["❌", "✅"], timeout = 60000) {
        return new Promise((resolve, reject) => {
          this.channel.send(question).then(prompt => {
            prompt.reactives = [];
            const collector = prompt.createReactionCollector((reaction, user) => this.author == user && reaction.message.reactives.includes(reaction), {
              max: 1,
              time: timeout
            });
            collector.on("collect", reaction => resolve(Boolean(reacts.indexOf(reaction.emoji.name))));
            collector.on("end", (messages, reason) => {
              if (prompt.deletable) prompt.delete();
              if (reason == "time") reject(new Error(reason));
            });
            prompt.react(reacts[1]).then(r => {
              prompt.reactives.unshift(r);
              prompt.react(reacts[0]).then(r => prompt.reactives.unshift(r)).catch(() => NaN);
            }).catch(() => NaN);
          });
        });
      }
      /**
       * Gets user's nickname
       * @constructor
       * @param {User} [user=client.user] The user who's name to check
       * @returns {String} The nickname of the user relating to this message
       */
      getNickname(user = this.client.user) {
        if (!this.guild) return user.username;
        const nickname = this.guild.members.get(user.id).nickname;
        if (nickname) return nickname;
        return user.username;
      }
    }
    return Message;
  });
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
  client.clean = async (client, text) => {
    if (text && text.constructor.name == "Promise")
      text = await text;
    if (typeof text !== "string")
      text = require("util").inspect(text, {
        depth: 1
      });

    text = text
      .replace(/`/g, "`" + String.fromCharCode(8203))
      .replace(/@/g, "@" + String.fromCharCode(8203))
      .replace(client.token, "mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0");

    return text;
  };
  /**
   * Loads command using file name. Command file format is demonstrated in ./commands/ping.js
   * @constructor
   * @param {String} commandName Name of the js file to load, minus '.js'
   * @returns {String} false if command loaded, Describes error if not
   */
  client.loadCommand = (commandName) => {
    try {
      const props = require(`../commands/${commandName}`);
      if (props.init) props.init(client);
      client.commands.set(props.help.name, props);
      props.conf.aliases.forEach(alias => client.aliases.set(alias, props.help.name));
    } catch (e) {
      return e;
    }
  };
  /**
   * Unloads command using alias / command name.
   * @constructor
   * @param {String} commandName The name of the command to unload
   * @return {String} Name of unloaded command - can be used to [client.loadCommand] in the case that an alias was passed
   */
  client.unloadCommand = async (commandName) => {
    if (client.aliases.has(commandName)) commandName = client.aliases.get(commandName);
    const command = client.commands.get(commandName);
    if (!command) return new Error("The command `" + commandName + "` doesn't seem to exist, nor is it an alias. Try again!");
    if (command.shutdown) await command.shutdown(client);
    client.commands.delete(commandName);
    const mod = require.cache[require.resolve(`../commands/${commandName}`)];
    delete require.cache[require.resolve(`../commands/${commandName}.js`)];
    mod.parent.children.some((child, index) => child === mod ? mod.parent.children.splice(index, 1) : false);
    return commandName;
  };

  /* MISCELANEOUS NON-CRITICAL FUNCTIONS */

  // EXTENDING NATIVE TYPES IS BAD PRACTICE. Why? Because if JavaScript adds this
  // later, this conflicts with native code. Also, if some other lib you use does
  // this, a conflict also occurs. KNOWING THIS however, the following 2 methods
  // are, we feel, very useful in code. 

  /**
   * {String}.toProperCase will return a string with every word capitalised
   * @constructor
   * @return {String} The proper case string ("Mary had a little lamb".toProperCase() returns "Mary Had A Little Lamb")
   */
  Object.defineProperty(String.prototype, "toProperCase", {
    value: function() {
      return this.replace(/([^\W_]+[^\s-]*) */g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }
  });

  // <Array>.random() returns a single random element from an array
  // [1, 2, 3, 4, 5].random() can return 1, 2, 3, 4 or 5.
  /**
   * {Array}.random will return a random element in an array
   * @constructor
   * @return {*} The chosen element ([1, 2, 3, 4, 5].random() can return 1, 2, 3, 4 or 5)
   */
  Object.defineProperty(Array.prototype, "random", {
    value: function() {
      return this[Math.floor(Math.random() * this.length)];
    }
  });

  // TODO: Look into why these haven't just been left default
  // These 2 process methods will catch exceptions and give *more details* about the error and stack trace.
  process.on("uncaughtException", (err) => {
    const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
    client.logger.error(`Uncaught Exception: ${errorMsg}`);
    // Always best practice to let the code crash on uncaught exceptions. 
    // Because you should be catching them anyway.
    process.exit(1);
  });

  process.on("unhandledRejection", err => {
    client.logger.error(`Unhandled rejection: ${err}`);
  });
};