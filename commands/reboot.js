module.exports = {
  run: (client, message) => client.successEmbed(message.channel, "Bot is shutting down.").then(() => {
    client.commands.keyArray().forEach(cmd => client.unloadCommand(cmd));
    process.exit(1);
  }),
  
  conf: {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: "Bot Admin"
  },

  help: {
    name: "reboot",
    category: "System",
    description: "Shuts down the bot. If running under PM2, bot will restart automatically.",
    usage: "reboot"
  }
};