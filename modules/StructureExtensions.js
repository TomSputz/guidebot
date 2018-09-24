module.exports = (Discord) => {
  const Structures = Discord.Structures;
  const MessageEmbed = Discord.MessageEmbed;

  Structures.extend("Guild", OldGuild => {
    return class Guild extends OldGuild {
      /**
       * This function merges the default settings (from config.defaultSettings) with any
       * guild override you might have for particular guild. If no overrides are present,
       * the default settings are used.
       * @constructor
       * @param {String} guildid The id of the guild to fetch settings for
       * @returns {Object} Parsed settings for the guild
       */
      getSettings() {
        const defaults = this.client.config.defaultSettings || {};
        if (!this.client.guildData.has(this.id)) return defaults;
        const guildData = this.client.guildData.get(this.id).settings;
        const returnObject = {};
        Object.keys(defaults).forEach((key) => returnObject[key] = guildData[key] ? guildData[key] : defaults[key]);
        return returnObject;
      }
    };
  });
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
          this.send(["MessageEmbed", "String"].includes(description.constructor.name) ? description : new MessageEmbed({
            type: "rich",
            title: "Multiple Choice",
            description: "React to this message to choose.\n\n" + options.map(i => this.client.toEmojiString(options.indexOf(i) + 1) + " " + i).join("\n")
          })).then(async (prompt) => {
            prompt.reactives = [];
            const collector = prompt.createReactionCollector((reaction, user) => !(user.bot) && reaction.message.reactives.includes(reaction) && (filter ? filter(user, reaction) : true), {
              max: 1,
              time: timeout
            });
            collector.on("collect", (reaction, user) => (reaction.emoji.name == "❌" && reject(new Error("User rejected"))) || resolve([options[parseInt(reaction.emoji.identifier.charAt(0)) - 1], user, reaction]));
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
            const collector = this.createMessageCollector(message => !(message.author.bot) && (filter ? filter(message) : true), {
              max: 1,
              time: timeout
            });
            collector.on("collect", response => resolve([response.content, response]));
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
            const collector = prompt.createReactionCollector((reaction, user) => !(user.bot) && reaction.message.reactives.includes(reaction) && (filter ? filter(user, reaction) : true), {
              max: 1,
              time: timeout
            });
            collector.on("collect", (reaction, user) => resolve([Boolean(reacts.indexOf(reaction.emoji.name)), user, reaction]));
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
          this.channel.send(["MessageEmbed", "String"].includes(description.constructor.name) ? description : new MessageEmbed({
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
};