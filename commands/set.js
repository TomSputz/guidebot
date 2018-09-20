// This command is to modify/edit guild configuration. Perm Level 3 for admins
// and owners only. Used for changing prefixes and role names and such.

// Note that there's no "checks" in this basic version - no config "types" like
// Role, String, Int, etc... It's basic, to be extended with your deft hands!

module.exports = {
  // Note the **destructuring** here. instead of `args` we have :
  // [action, key, ...value]
  // This gives us the equivalent of either:
  // const action = args[0]; const key = args[1]; const value = args.slice(2);
  // OR the same as:
  // const [action, key, ...value] = args;
  run: (client, message, [action, key, ...value], data) => {

    // Retrieve current guild settings (merged) and overrides only.
    const settings = message.settings;
    const defaults = client.config.defaultSettings;
    // If the guild does not have any overrides, initialize it.
    const overrides = data.settings ? data.settings : data.settings = {};

    // Edit an existing key value
    if (action === "edit") {
      // User must specify a key.
      if (!key) return client.errorEmbed(message.channel, "Please specify a key to edit");
      // User must specify a key that actually exists!
      if (!defaults[key]) return client.errorEmbed(message.channel, "This key does not exist in the settings");
      const joinedValue = value.join(" ");
      // User must specify a value to change.
      if (joinedValue.length < 1) return client.errorEmbed(message.channel, "Please specify a new value");
      // User must specify a different value than the current one.
      if (joinedValue === settings[key]) return client.errorEmbed(message.channel, "This setting already has that value!");

      overrides[key] = joinedValue;

      // Modify the guild overrides directly.
      client.guildData.set(message.guild.id, overrides, "settings");

      // Confirm everything is fine!
      client.successEmbed(message.channel, `${key} successfully edited to ${joinedValue}`);
    } else

    // Resets a key to the default value
    if (action === "del" || action === "reset") {
      if (!key) return client.errorEmbed(message.channel, "Please specify a key to reset.");
      if (!defaults[key]) return client.errorEmbed(message.channel, "This key does not exist in the settings");
      if (!overrides[key]) return client.errorEmbed(message.channel, "This key does not have an override and is already using defaults.");

      // Good demonstration of the custom booleanPrompt method in `./modules/functions.js` !
      client.booleanPrompt(message, `Are you sure you want to reset ${key} to the default value?`).then((Ans) => {
        if (Ans) {
          delete overrides[key];
          client.guildData.set(message.guild.id, overrides, "settings");
          client.successEmbed(message.channel, key + " was reset.");
        }
      });
    } else

    if (action === "get") {
      if (!key) {
        const longestKey = Object.keys(settings).reduce((long, str) => Math.max(long, str.length), 0);
        return message.channel.send("= Current Guild Settings =\n" + Object.entries(settings).map(([key, value]) => `${key}${" ".repeat(longestKey - key.length)} ::  ${value}`).join("\n"), {
          code: "asciidoc"
        });
      }
      if (!defaults[key]) return message.reply("This key does not exist in the settings");
      client.coloredEmbed(message.channel, key, (overrides[key] ? "Custom: " : "Default: ") + settings[key], 0x7289DA);
    } else {
      // Otherwise, the default action is to return the whole configuration;
      // When making a proper subcommand system, make this a synonym for 'set get'
      const longestKey = Object.keys(settings).reduce((long, str) => Math.max(long, str.length), 0);
      message.channel.send("= Current Guild Settings =\n" + Object.entries(settings).map(([key, value]) => `${key}${" ".repeat(longestKey - key.length)} ::  ${value}`).join("\n"), {
        code: "asciidoc"
      });
    }
  },

  conf: {
    enabled: true,
    guildOnly: true,
    aliases: ["setting", "settings", "conf"],
    permLevel: "Administrator"
  },
  
  help: {
    name: "set",
    category: "System",
    description: "View or change settings for your server.",
    usage: "set <view/get/edit> <key> <value>"
  }
};