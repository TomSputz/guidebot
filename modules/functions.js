const Discord = require("discord.js");
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
  /**
   * Sends an embed with parameters to the given channel.
   * @constructor
   * @param {Channel} channel The channel which the Embed should be sent to
   * @param {String} title The title for the Embed
   * @param {String} description The description for the Embed
   * @param {Color} color The color for the Embed
   * @returns {Promise} Resolves to the sent message
   */
  client.coloredEmbed = (channel, title, description, color) => {
    return new Promise((resolve, reject) => {
      channel.send(new Discord.MessageEmbed({
        type: "rich",
        title: title,
        description: description,
        color: color
      })).then(resolve).catch(reject);
    });
  };
  /**
   * Sends an Embed to the given Channel describing a success - Has title 'Success' and uses discord's Online color
   * @constructor
   * @param {Channel} channel The channel which the Embed should be sent to
   * @param {String} description The description for the Embed
   * @returns {Promise} Resolves to the sent message
   */
  client.successEmbed = (channel, description) => client.coloredEmbed(channel, "Success", description, 0x43B581);
  /**
   * Sends an Embed to the given Channel describing an error - Has title 'Error' and uses discord's DND color
   * @constructor
   * @param {Channel} channel The channel which the Embed should be sent to
   * @param {String} description The description for the Embed
   * @returns {Promise} Resolves to the sent message
   */
  client.errorEmbed = (channel, description) => client.coloredEmbed(channel, "Error", description, 0xF04747);
  /**
   * Prompts user to choose string from array using reactions
   * @constructor
   * @param {Channel|Message} context The channel to send the question to. If message is passed and no subject is defined, the author will be used as subject
   * @param {String[]} options An array of strings representing the choices for the user
   * @param {(Embed|String)} [description] Used as message to send to channel, will be given reactions up to the number of strings in [options]. Should explain what each option mean
   * @param {Number} [timeout=60000] How long to wait for a response in milliseconds
   * @param {(User|String)} [subject] Only allow this user to respond to the prompt
   * @returns {Promise.<String|Error>} Resolves to the string the user chose
   */
  // TODO: Switch 'subject' parameters in these functions to a filter, allowing more specific sets of users to respond
  client.multiplePrompt = (context, options, description = 0, timeout = 60000, subject) => {
    return new Promise((resolve, reject) => {
      if (context.constructor.name === "Message") {
        if (!(subject)) subject = context.author;
        context = context.channel;
      }
      if (options.length == 0) return reject(new Error("No options"));
      if (options.length == 1) return resolve(options[0]);
      if (options.length > 9) return reject(new Error("Too many options"));
      context.send(["Embed", "String"].includes(description.constructor.name) ? description : new Discord.MessageEmbed({
        type: "rich",
        title: "Multiple Choice",
        description: "React to this message to choose.\n\n" + options.map(i => client.toEmojiString(options.indexOf(i) + 1) + " " + i).join("\n")
      })).then(async (prompt) => {
        prompt.reactives = [];
        const collector = prompt.createReactionCollector((reaction, user) => !(user.bot) && reaction.message.reactives.includes(reaction) && (subject ? [subject, subject.id].includes(user.id) : true), {
          maxEmojis: 1,
          time: timeout
        });
        collector.on("collect", r => {
          if (r.deletable) r.message.delete();
          if (r.emoji.name == "❌") return reject(new Error("User rejected"));
          resolve(options[parseInt(r.emoji.identifier.charAt(0)) - 1]);
        });
        collector.on("end", (messages, reason) => (prompt.deletable && prompt.delete()) || (reason == "time" && reject(new Error(reason))));
        await prompt.react("❌").then(r => r.message.reactives.push(r)).catch(() => NaN);
        for (let i = 0; i < options.length; i++) await prompt.react((i + 1) + "%E2%83%A3").then(r => r.message.reactives.push(r)).catch(() => NaN);
      });
    });
  };
  /**
   * A simple way to grab a single reply, from the user that initiated
   * the command. Useful to get "precisions" on certain things...
   * @constructor
   * @param {Channel|Message} context The channel to send the question to. If message is passed and no subject is defined, the author will be used as subject
   * @param {Embed|String} question The question to send to the channel
   * @param {Number} [timeout=60000] How long to wait for a response in milliseconds
   * @param {User} [subject] If non-falsy, only allow this user to respond to the given question
   * @returns {Promise.<String|Array.<String,User>|Error>} Resolves to user's answer. If no subject is defined, resolves to array containing response as string and author
   */
  client.textPrompt = (context, question, timeout = 60000, subject) => {
    return new Promise((resolve, reject) => {
      if (context.constructor.name === "Message") {
        if (!(subject)) subject = context.author;
        context = context.channel;
      }
      context.send(question).then(prompt => {
        const collector = context.createMessageCollector(m => !(m.author.bot) && (subject ? [m.author, m.author.id].includes(subject) : true), {
          maxMatches: 1,
          time: timeout
        });
        collector.on("collect", response => resolve(subject ? response.content : [response.content, response.author]));
        collector.on("end", (messages, reason) => (prompt.deletable && prompt.delete()) || (reason == "time" && reject(new Error(reason))));
      });
    });
  };
  /**
   * Prompt the user to react yes/no to a question
   * @constructor
   * @param {Channel|Message} context The channel to send the question to
   * @param {Embed|String} question The question to send to the channel
   * @param {Number} [timeout=60000] How long the question should stay alive
   * @param {User} [subject] The user who is allowed to respond to the question
   * @param {Array.<EmojiResolvable>} reacts The emojis used to respond with [False, True]
   * @returns {Promise.<Boolean|Array.<Boolean,User>|Error} Resolves to user's answer. If no subject is defined, resolves to array containing response as string and author. If the question times out, it will throw a 'time' error
   */
  // TODO: If we find a good way to extend the Discord classes, make this Channel.awaitBooleanReply
  client.booleanPrompt = (context, question, timeout = 60000, subject, reacts = ["❌", "✅"]) => {
    return new Promise((resolve, reject) => {
      if (context.constructor.name === "Message") {
        if (!(subject)) subject = context.author;
        context = context.channel;
      }
      context.send(question).then(prompt => {
        prompt.reactives = [];
        const collector = prompt.createReactionCollector((reaction, user) => !(user.bot) && reaction.message.reactives.includes(reaction) && (subject ? [subject, subject.id].includes(user.id) : true), {
          maxEmojis: 1,
          time: timeout
        });
        collector.on("collect", (reaction, user) => resolve(subject ? Boolean(reacts.indexOf(reaction.identifier)) : [Boolean(reacts.indexOf(reaction.identifier)), user]));
        collector.on("end", (reacts, reason) => (prompt.deletable && prompt.delete()) || (reason == "time" && reject(new Error(reason))));
        prompt.react(reacts[1]).then(r => {
          prompt.reactives.unshift(r);
          prompt.react(reacts[0]).then(r => prompt.reactives.unshift(r)).catch(() => NaN);
        }).catch(() => NaN);
      });
    });
  };
  /**
   * Gets user's nickname given a context - if a nickname is not set, the username wil be returned
   * @constructor
   * @param {Guild|Message|TextChannel|VoiceChannel|MessageReaction} context The context to check the nickname in
   * @param {User} [user=client.user] The user who's name to check
   * @returns {String} The nickname of the user in the given context
   */
  client.getNickname = (context, user = client.user) => {
    if (context.constructor.name == "MessageReaction") context = context.message;
    if (context.constructor.name == "Message" || "TextChannel" || "VoiceChannel") context = context.guild;
    context = context.members.get(user.id).nickname;
    return context ? context : user.username;
  };
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