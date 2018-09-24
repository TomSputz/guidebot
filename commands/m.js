const ytdl = require("ytdl-core");
const {
  MessageEmbed
} = require("discord.js");
const iso8601 = require("duration-iso-8601");
module.exports = {
  run: async (client, message, [action, tag, ...args], data, tempData) => {
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
      let embed;
      if (tempData.audio.queue[0]) {
        const metadata = tempData.audio.queue[0].metadata;
        const song = tempData.audio.queue.getSong(tempData.audio.currentQueue);
        const streamTimeString = new Date(tempData.audio.dispatcher.streamTime).toTimeString().slice(0, 8).replace(/00:/g, "");
        const durationString = new Date(iso8601.convertToSecond(song.video.contentDetails.duration) * 1000).toTimeString().slice(0, 8).replace(/00:/g, "");
        const percentage = tempData.audio.dispatcher.streamTime / (iso8601.convertToSecond(song.video.contentDetails.duration) * 1000);
        embed = new MessageEmbed(metadata.type === "youtube" ? {} : {
          title: `${new Date(Date.now()).toLocaleTimeString()} | ${tempData.audio.connection.status === 0 ? (tempData.audio.dispatcher.paused ? "Paused in " : "Playing in ") + tempData.audio.connection.channel.name : "Music offline"}`,
          description: `Listening to ${tempData.audio.currentQueue + 1} of ${tempData.audio.queue.songLength()}\n${tempData.audio.loopQueue ? "Queue looping \\✔\n" : ""}${tempData.audio.loopSong ? "Song looping \\✔\n" : ""}`,
          color: 0x7289DA,
          thumbnail: {
            url: song.track.images ? song.track.images[0].url : metadata.images ? metadata.images[0].url : ""
          },
          fields: [{
            name: "Current Song",
            value: (song.track.external_urls ? `[${song.track.name}](${Object.values(song.track.external_urls)[0]})` : song.track.name) + ` - [\\▶](https://www.youtube.com/watch?v=${song.video.id.videoId}) from [${song.track.album ? song.track.album.name : metadata.name}](${song.track.album ? Object.values(song.track.album.external_urls)[0] : Object.values(metadata.external_urls)[0]})\n${streamTimeString}|-${"█".repeat(Math.max(Math.ceil(percentage * 10) - 1, 0))}${["▒", "▓"][Math.max(Math.ceil((percentage * 100 % 10) * 0.2) - 1, 0)]}${"░".repeat(10 - Math.ceil(percentage * 10))}-|${durationString}`
          }],
          footer: {
            text: `By ${song.track.artists ? song.track.artists[0].name : metadata.artists[0].name}`
          }
        });
      } else {
        embed = new MessageEmbed({
          title: "Music offline",
          description: `${tempData.audio.loopQueue ? "Queue looping \\✔\n" : ""}${tempData.audio.loopSong ? "Song looping \\✔\n" : ""}`,
          color: 0x7289DA
        });
      }
      channel.send(embed).then(async m => {
        tempData.audio.message = m;
        m.reactives = [];
        const onCollect = (reaction, user) => {
          if (reaction.emoji.name === "ℹ") {
            user.send(new MessageEmbed({
              title: "Music Help"
            }));
          } else if (reaction.emoji.name === "⏯") {
            if (!tempData.audio.dispatcher) return;
            if (tempData.audio.dispatcher.paused) {
              tempData.audio.dispatcher.resume();
            } else {
              tempData.audio.dispatcher.pause(true);
            }
            summonInfo(message.channel);
          } else if (reaction.emoji.name === "🔄") {
            if (tempData.audio.loopQueue) {
              tempData.audio.loopSong = true;
              tempData.audio.loopQueue = false;
            } else if (tempData.audio.loopSong) {
              tempData.audio.loopSong = false;
            } else {
              tempData.audio.loopQueue = true;
            }
            summonInfo(message.channel);
          } else if (reaction.emoji.name === "⏭") {
            tempData.audio.connection.nextTrack();
          } else if (reaction.emoji.name === "⏮") {
            tempData.audio.currentQueue = Math.max(tempData.audio.currentQueue - 2, -1);
            tempData.audio.connection.nextTrack();
          }
        };
        const collector = m.createReactionCollector((reaction, user) => !user.bot && reaction.message.reactives.includes(reaction));
        collector.on("collect", onCollect);
        collector.on("dispose", onCollect);
        await m.react("ℹ").then(r => r.message.reactives.push(r)).catch(() => NaN);
        await m.react("⏯").then(r => r.message.reactives.push(r)).catch(() => NaN);
        await m.react("🔄").then(r => r.message.reactives.push(r)).catch(() => NaN);
        await m.react("⏭").then(r => r.message.reactives.push(r)).catch(() => NaN);
        await m.react("⏮").then(r => r.message.reactives.push(r)).catch(() => NaN);
      });
    };
    const startPlaying = channel => channel.join().then(connection => {
      tempData.audio.connection = connection;
      tempData.audio.currentQueue = tempData.audio.currentQueue ? tempData.audio.currentQueue : tempData.audio.loopSong ? 0 : -1;
      connection.nextTrack = () => {
        if (!tempData.audio) return;
        tempData.audio.currentQueue += 1;
        if (tempData.audio.loopSong) tempData.audio.currentQueue -= 1;
        if (tempData.audio.loopQueue && tempData.audio.currentQueue > tempData.audio.queue.songLength() - 1) tempData.audio.currentQueue = 0;
        if (tempData.audio.currentQueue > tempData.audio.queue.songLength() - 1) return message.channel.successEmbed("All songs in queue finished.");
        const dispatcher = tempData.audio.dispatcher = connection.play(ytdl("http://youtube.com/watch?v=" + tempData.audio.queue.getSong(tempData.audio.currentQueue).video.id.videoId, {
          filter: "audioonly"
        })).on("end", () => tempData.audio.connection.status === 0 && tempData.audio.dispatcher === dispatcher ? connection.nextTrack() : NaN);
        if (tempData.audio.prevQueue !== tempData.audio.currentQueue) summonInfo(message.channel);
        tempData.audio.prevQueue = tempData.audio.currentQueue;
      };
      if (!tempData.audio.dispatcher || tempData.audio.dispatcher.destroyed) connection.nextTrack();
    });

    if (action === "play") {
      if (tag && tag.startsWith("spotify:")) tempData.audio.queue.push(await client.audio.spotifyURI(tag));
      startPlaying(message.member.voice.channel);
    } else if (action === "skip") {
      if (tempData.audio && tempData.audio.connection && tempData.audio.connection.nextTrack) {
        if (!tag) return tempData.audio.connection.nextTrack();
        if (tag == "to") {
          if (!parseInt(args[0])) return;
          tempData.audio.currentQueue = parseInt(args[0]) - 2;
          return tempData.audio.connection.nextTrack();
        }
        if (!parseInt(tag)) return;
        tempData.audio.currentQueue += parseInt(tag[0]) - 1;
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
    } else if (action == "queue") {
      if (tempData.audio.message && tempData.audio.message.deletable) tempData.audio.message.delete();
      const getdesc = () => {
        let string = "";
        let addstring = "";
        let songid = parseInt(tag) ? parseInt(tag) - 1 : tempData.audio.currentQueue;
        let songno = songid;
        let mapid = 0;
        while (tempData.audio.queue[mapid] && string.length + addstring.length < 2048) {
          string += addstring;
          const song = Array.from(tempData.audio.queue[mapid].values())[songid];
          songno += 1;
          songid += 1;
          if (tempData.audio.queue[mapid].size < songid + 1) {
            songid = 0;
            mapid += 1;
          }
          addstring = `${songno}. [${song.track.name}](https://www.youtube.com/watch?v=${song.video.id.videoId})\n`;
        }
        return string;
        // return tempData.audio.queue.reduce((str, map) => {
        // const tracknames = Array.from(map.values()).map(song => {
        //   songno += 1;
        //   return songno + `. [${song.track.name}](https://www.youtube.com/watch?v=${song.video.id.videoId})`;
        // }).join("\n");
        // while (tracknames.length + )
        // str += tracknames;
        //   return str;
        // },"")
      };
      const embed = new MessageEmbed({
        title: "Queue",
        color: 0x7289DA,
        description: getdesc()
      });
      message.channel.send(embed).then(m => tempData.audio.message = m);
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