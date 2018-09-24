module.exports = {
  run: (client, message) => message.channel.successEmbed("Bot is shutting down.").then(() => {
    Object.keys(client.commands).forEach(cmd => client.unloadCommand(cmd));
    process.exit(1);
  }),
  
  conf: {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: "Bot Admin"
  },

  help: {
    category: "System",
    description: "Shuts down the bot. If running under PM2, bot will restart automatically.",
    usage: "reboot"
  }
};