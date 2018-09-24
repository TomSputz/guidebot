const ytdl = require("ytdl-core");
const {
  MessageEmbed
} = require("discord.js");
module.exports = {
  run: async (client, message, [action, tag], data, tempData) => {
    if (!tempData.audio) tempData.audio = {};
    if (!tempData.audio.queue) {
      tempData.audio.queue = new Array();
      tempData.audio.queue.getSong = place => {
        const remainingMaps = tempData.audio.queue.slice();
        while (place > remainingMaps[0].size - 1) {
          place -= remainingMaps[0].size;
          remainingMaps.shift();
        }
        return Array.from(remainingMaps[0].values())[place];
      };
      tempData.audio.queue.songLength = () => {
        let len = 0;
        for (let i = 0; i < tempData.audio.queue.length; i++) {
          len += tempData.audio.queue[i].size;
        }
        return len;
      };
    }
    const summonInfo = (channel) => {
      if (tempData.audio.message && tempData.audio.message.deletable) tempData.audio.message.delete();
      const metadata = tempData.audio.queue[0].metadata;
      const song = tempData.audio.queue.getSong(tempData.audio.currentQueue);
      const embed = new MessageEmbed(metadata.type === "youtube" ? {} : {
        title: tempData.audio.connection.status === 0 ? (tempData.audio.dispatcher.paused ? "Paused in " : "Playing in ") + tempData.audio.connection.channel.name : "Music offline",
        description: `Listening to ${tempData.audio.currentQueue + 1} of ${tempData.audio.queue.songLength()}\n${tempData.audio.loopQueue ? "Queue looping \\✔\n" : ""}${tempData.audio.loopSong ? "Song looping \\✔\n" : ""}`,
        color: 0x7289DA,
        thumbnail: {
          url: song.track.images ? song.track.images[0].url : metadata.images[0].url
        },
        fields: [{
          name: "Current Song",
          value: (song.track.external_urls ? `[${song.track.name}](${Object.values(song.track.external_urls)[0]})` : song.track.name) + ` - [\\▶](https://www.youtube.com/watch?v=${song.video.id.videoId}) from [${song.track.album ? song.track.album.name : metadata.name}](${song.track.album ? Object.values(song.track.album.external_urls)[0] : Object.values(metadata.external_urls)[0]})`
        }],
        footer: {
          text: `By ${song.track.artists ? song.track.artists[0].name : metadata.artists[0].name}`
        }
      });
      channel.send(embed).then(m => tempData.audio.message = m);
    };
    const startPlaying = channel => channel.join().then(connection => {
      tempData.audio.connection = connection;
      tempData.audio.currentQueue = tempData.audio.currentQueue ? tempData.audio.currentQueue : tempData.audio.loopSong ? 0 : -1;
      connection.nextTrack = () => {
        if (!tempData.audio) return;
        tempData.audio.currentQueue += 1;
        if (tempData.audio.loopSong) tempData.audio.currentQueue -= 1;
        if (tempData.audio.loopQueue && tempData.audio.currentQueue > tempData.audio.queue.size - 1) tempData.audio.currentQueue = 0;
        if (tempData.audio.currentQueue > tempData.audio.queue.songLength() - 1) return message.channel.successEmbed("All songs in queue finished.");
        const dispatcher = tempData.audio.dispatcher = connection.play(ytdl("http://youtube.com/watch?v=" + tempData.audio.queue.getSong(tempData.audio.currentQueue).video.id.videoId, {
          filter: "audioonly"
        })).on("end", () => tempData.audio.connection.status === 0 && tempData.audio.dispatcher === dispatcher ? connection.nextTrack() : NaN);
        summonInfo(message.channel);
      };
      if (!tempData.audio.dispatcher || tempData.audio.dispatcher.destroyed) connection.nextTrack();
    });

    if (action === "play") {
      if (tag && tag.startsWith("spotify:")) tempData.audio.queue.push(await client.audio.spotifyURI(tag));
      startPlaying(message.member.voice.channel);
      summonInfo(message.channel);
    } else if (action === "skip") {
      if (tempData.audio && tempData.audio.connection && tempData.audio.connection.nextTrack) {
        if (!tag) return tempData.audio.connection.nextTrack();
        if (!parseInt(tag)) return;
        tempData.audio.currentQueue = parseInt(tag) - 2;
        tempData.audio.connection.nextTrack();
      }
    } else if (action === "loop") {
      if (tag === "queue") {
        tempData.audio.loopQueue = Boolean(!tempData.audio.loopQueue);
        return summonInfo(message.channel);
      }
      tempData.audio.loopSong = Boolean(!tempData.audio.loopSong);
      summonInfo(message.channel);
    } else if (action === "pause") {
      if (!tempData.audio.dispatcher) return;
      if (tempData.audio.dispatcher.paused) {
        tempData.audio.dispatcher.resume();
      } else {
        tempData.audio.dispatcher.pause(true);
      }
      summonInfo(message.channel);
    } else if (action === "resume") {
      if (!tempData.audio.dispatcher) return;
      if (tempData.audio.dispatcher.paused) tempData.audio.dispatcher.resume();
      if (tempData.audio.connection.status === 4) startPlaying(message.member.voice.channel);
      summonInfo(message.channel);
    } else if (action === "info") {
      summonInfo(message.channel);
    } else if (["leave", "stop"].includes(action)) {
      tempData.audio.connection.disconnect();
    } else {
      summonInfo(message.channel);
    }
  },
  conf: {
    permLevel: "User"
  },
  help: {
    category: "Entertainment"
  }
};