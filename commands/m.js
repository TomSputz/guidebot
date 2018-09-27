const ytdl = require("ytdl-core");
const {
  MessageEmbed
} = require("discord.js");
const iso8601 = require("duration-iso-8601");
const { MessageAttachment } = require("discord.js");
const { createCanvas, registerFont } = require("canvas");
registerFont("./assets/fonts/Signika/Signika-Regular.ttf", {family: "Signika"});
registerFont("./assets/fonts/Quark-Light.otf", {family: "Quark"});
registerFont("./assets/fonts/DiscordWhitney.ttf", {family: "Whitney"});
registerFont("./assets/fonts/MaterialIcons-Regular.ttf", {family: "Material"});
module.exports = {
  temprun: async (client, message, [action, tag], data, tempData) => {
    client.AudioModule.wakeShard(message.guild.id);
    const playlist = await tempData.Audio.Manager.spotifyURI(message.content.slice(2));
    console.log(await playlist.fetchDetails(0));
    // if (action === "play") {
    //   if (!message.member.voice.channel) message.channel.errorEmbed("You must be in a voice channel");
    //   if (!tempData.Audio.Channels[message.member.voice.channel.id]) await tempData.Audio.connect(message.member.voice.channel);
    //   const Channel = tempData.Audio.Channels[message.member.voice.channel.id];
    //   if (tag && tag.startsWith("spotify:")) Channel.Queue.push(await client.AudioModule.spotifyURI(tag));
    //   const recursePlaylist = async () => {
    //     const Dispatcher = await Channel.playYtId(Channel.Queue[Channel.queueIndex].video.id.videoId);
    //     Channel.queueIndex += 1;
    //     if (Channel.queueIndex >= tempData.Audio.Queue.size()) return;
    //     Dispatcher.on("end", recursePlaylist);
    //   };
    //   recursePlaylist();
    // }
  },
  run: async (client, message, [action, tag, ...args], d, tempData) => {
    client.AudioModule.wakeShard(message.guild.id);
    if (!tempData.audio) tempData.audio = {};
    if (!tempData.audio.queue) tempData.audio.queue = new tempData.Audio.Manager.Queue();
    const summonInfo = async (channel) => {
      let embed;
      const metadata = tempData.audio.queue[0].metadata;
      const song = tempData.audio.queue.get(tempData.audio.currentQueue);
      const regex = /^00:0|^00:|^0/g;
      const streamTimeString = new Date(tempData.audio.dispatcher.streamTime).toTimeString().slice(0, 8).replace(regex, "");
      const durationString = new Date(iso8601.convertToSecond(song.video.contentDetails.duration) * 1000).toTimeString().slice(0, 8).replace(regex, "");
      const percentage = tempData.audio.dispatcher.streamTime / (iso8601.convertToSecond(song.video.contentDetails.duration) * 1000);
      function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
        if (typeof stroke == "undefined") {
          stroke = true;
        }
        if (typeof radius === "undefined") {
          radius = 5;
        }
        if (typeof radius === "number") {
          radius = {tl: radius, tr: radius, br: radius, bl: radius};
        } else {
          var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
          for (var side in defaultRadius) {
            radius[side] = radius[side] || defaultRadius[side];
          }
        }
        ctx.beginPath();
        ctx.moveTo(x + radius.tl, y);
        ctx.lineTo(x + width - radius.tr, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        ctx.lineTo(x + width, y + height - radius.br);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        ctx.lineTo(x + radius.bl, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        ctx.lineTo(x, y + radius.tl);
        ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        ctx.closePath();
        if (fill) {
          ctx.fill();
        }
        if (stroke) {
          ctx.stroke();
        }
      
      }
      const canvas = createCanvas(400, 14);
      const ctx = canvas.getContext("2d");
      // ctx.fillStyle = "blue";
      // ctx.fillRect(0,0,1000,1000);
      ctx.font = "18px Whitney";
      ctx.fillStyle = ctx.strokeStyle = "rgb(200,205,210)";
      ctx.fillText(streamTimeString, 0, 13);
      ctx.fillText(durationString, 400 - ctx.measureText(durationString).width, 13);
      const streamTimeStringWidth = ctx.measureText(streamTimeString).width;
      const durationStringWidth = ctx.measureText(durationString).width;
      ctx.font = "18px Material";
      if (tempData.audio.loopQueue) {
        ctx.fillText("repeat", streamTimeStringWidth + 10, 16);
      } else if (tempData.audio.loopSong) {
        ctx.fillText("repeat_one", streamTimeStringWidth + 10, 16);
      } else {
        ctx.fillStyle = ctx.strokeStyle = "rgb(100,100,100)";
        ctx.fillText("repeat", streamTimeStringWidth + 10, 16);
      }
      ctx.fillStyle = ctx.strokeStyle = "rgb(100,100,100)";
      
      ctx.fillRect(40 + streamTimeStringWidth, 6, 350 - streamTimeStringWidth - durationStringWidth, 2);
      ctx.fillStyle = "#7289da";
      ctx.strokeStyle = "#7289da";
      ctx.fillRect(40 + streamTimeStringWidth, 6, (350 - streamTimeStringWidth - durationStringWidth) * percentage, 2);
      const imageMsg = await client.users.get(client.config.ownerID).send("", new MessageAttachment(canvas.toBuffer(),"image.png"));
      const imageUrl = imageMsg.attachments.values().next().value.url;
      if (tempData.audio.queue[0] && tempData.audio.queue[0].length - tempData.audio.currentQueue > 0) {
        embed = new MessageEmbed({
          author: {
            name: `${tempData.audio.connection.status === 0 ? (tempData.audio.dispatcher.paused ? "Paused in " : "Playing in ") + tempData.audio.connection.channel.name : "Music offline"}`,
            icon_url: client.user.avatarURL()
          },
          description: `<@!255340004618797056> Playing ${tempData.audio.currentQueue + 1} of ${tempData.audio.queue.size()}:\n` +
                (song.track.external_urls ? `[${song.track.name.replace(/ *\([^)]*\) *|-.*/g, "").trim()}](${Object.values(song.track.external_urls)[0]})` : song.track.name.replace(/ *\([^)]*\) *|-.*/g, "").trim()) +
                ` - [\\▶](https://www.youtube.com/watch?v=${song.video.id.videoId}) from [${song.track.album ? song.track.album.name.replace(/ *\([^)]*\) *|-.*/g, "").trim() : metadata.name.replace(/ *\([^)]*\) *|-.*/g, "").trim()}](${song.track.album ? Object.values(song.track.album.external_urls)[0] : Object.values(metadata.external_urls)[0]})`,
          color: 0x7289DA,
          thumbnail: {
            url: song.track.album && song.track.album.images ? song.track.album.images[0].url : metadata.images ? metadata.images[0].url : ""
          },
          image: {
            url: imageUrl
          },
          footer: {
            text: `${new Date(Date.now()).toLocaleTimeString().slice(0,5).replace(/^0/, "")} | By ${song.track.artists ? song.track.artists[0].name : metadata.artists[0].name}`
          }
        });
      } else {
        embed = new MessageEmbed({
          title: "Music offline",
          description: `${tempData.audio.loopQueue ? "Queue looping \\✔\n" : ""}${tempData.audio.loopSong ? "Song looping \\✔\n" : ""}`,
          color: 0x7289DA
        });
      }
      if (tempData.audio.message && tempData.audio.message.deletable) {
        if (Array.from(tempData.audio.message.channel.messages.values()).slice(-6).map(i => i.id).includes(tempData.audio.message.id)) {
          return tempData.audio.message.edit(embed).then(async m => {
            tempData.audio.message = m;
          });
        }
        tempData.audio.message.delete();
      }
      channel.send(embed).then(async m => {
        tempData.audio.message = m;
        m.reactives = [];
        const onCollect = async (reaction, user) => {
          if (reaction.emoji.name === "ℹ") {
            if (!user.dmChannel) {
              const channel = await user.createDM();
              await channel.messages.fetch({
                limit: 5
              });
            }
            if (!Array.from(user.dmChannel.messages.values()).slice(-6).map(i => i.author.id).includes(client.user.id)) user.send(new MessageEmbed({
              title: "Music Help"
            }));
            summonInfo(reaction.message.channel);
          } else if (reaction.emoji.name === "⏯") {
            if (!tempData.audio.dispatcher) return;
            if (tempData.audio.dispatcher.paused) {
              tempData.audio.dispatcher.resume();
            } else {
              tempData.audio.dispatcher.pause(true);
            }
            summonInfo(reaction.message.channel);
          } else if (reaction.emoji.name === "🔄") {
            if (tempData.audio.loopQueue) {
              tempData.audio.loopSong = true;
              tempData.audio.loopQueue = false;
            } else if (tempData.audio.loopSong) {
              tempData.audio.loopSong = false;
            } else {
              tempData.audio.loopQueue = true;
            }
            summonInfo(reaction.message.channel);
          } else if (reaction.emoji.name === "⏭") {
            tempData.audio.connection.nextTrack();
          } else if (reaction.emoji.name === "⏮") {
            tempData.audio.currentQueue = Math.max(tempData.audio.currentQueue - 2, -1);
            tempData.audio.connection.nextTrack();
          }
        };
        const collector = m.createReactionCollector((reaction, user) => !user.bot && reaction.message.reactives.includes(reaction), {
          dispose: true
        });
        collector.on("collect", onCollect);
        collector.on("remove", onCollect);
        await m.react("ℹ").then(r => r.message.reactives.push(r)).catch(() => NaN);
        await m.react("🔄").then(r => r.message.reactives.push(r)).catch(() => NaN);
        if (tempData.audio.queue.size() - tempData.audio.currentQueue > 0) {
          await m.react("⏮").then(r => r.message.reactives.push(r)).catch(() => NaN);
          await m.react("⏯").then(r => r.message.reactives.push(r)).catch(() => NaN);
          await m.react("⏭").then(r => r.message.reactives.push(r)).catch(() => NaN);
        }
      });
    };
    const startPlaying = channel => channel.join().then(connection => {
      tempData.audio.connection = connection;
      tempData.audio.currentQueue = typeof tempData.audio.currentQueue !== "undefined" ? tempData.audio.currentQueue : tempData.audio.loopSong ? 0 : -1;
      connection.nextTrack = () => {
        if (!tempData.audio) return;
        tempData.audio.currentQueue += 1;
        if (tempData.audio.loopSong) tempData.audio.currentQueue -= 1;
        if (tempData.audio.loopQueue && tempData.audio.currentQueue > tempData.audio.queue.size() - 1) tempData.audio.currentQueue = 0;
        if (tempData.audio.currentQueue > tempData.audio.queue.size() - 1) {
          connection.disconnect();
          return tempData.audio.queue = new tempData.Audio.Manager.Queue();
        }
        const dispatcher = tempData.audio.dispatcher = connection.play(ytdl("http://youtube.com/watch?v=" + tempData.audio.queue.get(tempData.audio.currentQueue).video.id.videoId, {
          filter: "audioonly"
        })).on("end", () => tempData.audio.connection.status === 0 && tempData.audio.dispatcher === dispatcher ? connection.nextTrack() : NaN);
        if (tempData.audio.prevQueue !== tempData.audio.currentQueue) summonInfo(message.channel);
        tempData.audio.prevQueue = tempData.audio.currentQueue;
      };
      if (!tempData.audio.dispatcher || tempData.audio.dispatcher.destroyed) connection.nextTrack();
    });

    if (action === "play") {
      if (tag && tag.startsWith("spotify:")) tempData.audio.queue.push(await tempData.Audio.Manager.spotifyURI(tag));
      await Promise.all(tempData.audio.queue[0].map(v => v.getVideo()));
      await tempData.audio.queue[0].fetchDetails(0, tempData);
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
      delete tempData.audio.queue;
      delete tempData.audio.currentQueue;
    } else if (action == "queue") {
      if (tempData.audio.message && tempData.audio.message.deletable) tempData.audio.message.delete();
      const getdesc = () => {
        let string = "";
        let addstring = "";
        let songid = parseInt(tag) ? parseInt(tag) - 1 : tempData.audio.currentQueue;
        let songno = songid;
        let mapid = 0;
        while (tempData.audio.queue[mapid].length - 1 < songid) {
          songid -= tempData.audio.queue[mapid].length;
          mapid += 1;
        }
        while (string.length + addstring.length < 2048) {
          string += addstring;
          if (!tempData.audio.queue[mapid]) return string;
          const song = tempData.audio.queue[mapid][songid];
          addstring = `${songno + 1}. [${song.track.name}](https://www.youtube.com/watch?v=${song.video.id.videoId})\n`;
          songno += 1;
          songid += 1;
          if (tempData.audio.queue[mapid].size < songid + 1) {
            songid = 0;
            mapid += 1;
          }
          if (!tempData.audio.queue[mapid][songid]) return string + addstring;
        }
        return string;
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