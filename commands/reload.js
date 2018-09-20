module.exports = {
  run: (client, message, args) => {
    if (!args || args.length < 1) return client.errorEmbed(message.channel, "Must provide a command to reload. Derp.");

    client.unloadCommand(args[0]).then(cmd => {
      if (cmd instanceof Error) return client.errorEmbed(message.channel, `Error Unloading: ${cmd.message}`);
      const res = client.loadCommand(cmd);
      if (res instanceof Error) return client.errorEmbed(message.channel, `Error Loading: ${res.message}`);
      client.successEmbed(message.channel, `The command \`${cmd}\` has been reloaded`);
    });
  },

  conf: {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: "Bot Admin"
  },

  help: {
    name: "reload",
    category: "System",
    description: "Reloads a command that\"s been modified.",
    usage: "reload [command]"
  }
};