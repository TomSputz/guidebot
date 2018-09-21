// This event executes when a new guild (server) is left.

module.exports = (client, guild) => {
  client.logger.cmd(`[GUILD LEAVE] ${guild.name} (${guild.id}) removed the bot.`);

  // If the settings Enmap contains any guild data, remove it.
  // No use keeping stale data!
  if (client.guildData.has(guild.id)) client.guildData.delete(guild.id);
};
