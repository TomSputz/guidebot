function accessToken(clientId, clientSecret) {
  return new Promise(resolve => {
    const req = require("https").request({
      hostname: "accounts.spotify.com",
      path: "/api/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${require("base-64").encode(clientId + ":" + clientSecret)}`
      }
    }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(JSON.parse(data).access_token));
    });
    req.write("grant_type=client_credentials");
    req.end();
  });
}

function spotifyApi(endpoint, accessToken) {
  return new Promise(resolve => {
    require("https").request({
      hostname: "api.spotify.com",
      path: endpoint,
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    }, response => {
      let data = "";
      response.on("data", chunk => data += chunk);
      response.on("end", () => resolve(JSON.parse(data)));
    }).end();
  });
}
const ytdl = require("ytdl-core");
const {
  MessageEmbed
} = require("discord.js");
module.exports = {
  run: async (client, message, [tag, tag2, ...args], data, tempData) => {
    const token = await accessToken(client.config.clientId, client.config.clientSecret);
    await message.channel.successEmbed("Loading...");
    // This uses logarithm to get the 'length' of the number
    if (!tempData.playlists) {
      tempData.playlists = new Map();
    }
    let playlist;
    if (tag.includes("playlist")) playlist = await client.audio.fetchPlaylist(tag.split(":").slice(-1)[0]);
    if (tag.includes("album")) playlist = await client.audio.fetchAlbum(tag.split(":").slice(-1)[0]);
    const ytIds = Array.from(playlist.values()).map(i => i.video.id.videoId);
    return message.member.voice.channel.join().then(connection => {
      const nextTrack = () => {
        connection.play(ytdl("http://youtube.com/watch?v=" + ytIds.splice(0,1)[0], {
          filter: "audioonly"
        })).on("end", nextTrack);
      };
      nextTrack();
    });
    if (!(tracks && tracks[0])) return message.channel.errorEmbed("No tracks found");
    if (!message.member.voice.channel) return message.channel.errorEmbed("You must be in a voice channel");
    message.member.voice.channel.join().then(connection => {
      const nextQuestion = async () => {
        if (!tracks[0]) return;
        const track = tracks.splice(0, 1)[0];
        connection.play(track.preview_url);
        // This regex remove everything inside parenthesis, after hyphens, extra spaces and trailing whitespace. It might be overkill.
        const trackname = track.name.replace(/ *\([^)]*\) *|-.*/g, "").replace(/\s{2,}/g, " ").trim(); // eslint-disable-line no-useless-escape
        const response = await message.channel.textPrompt(new MessageEmbed({
          title: "Pop quiz!",
          description: "What is the name of this song?",
          fields: [{
            name: "Artist",
            value: track.artists[0].name
          },
          {
            name: "Album",
            value: track.album.name
          },
          {
            name: "Partial name", // [.,\/#!$%\^&\*;:{}=\-_`~()]
            value: trackname.split(" ").map(word => word.split("").reduce((word, char) => {
              // If first letter, after a space, or punctuation, leave intact
              if (!word.length || /[.,\/#!$%\^&\*;:{}=\-_`'~ ()]/g.test(char)) return word + char;
              return word + "\\_";
            }, "")).join(" ")
          },
          {
            name: "Full name",
            value: track.name
          }
          ],
          thumbnail: {
            url: track.album.images[0].url
          }
        }), message => {
          if (!/^A:/.test(message.content)) return false;
          return message.content.slice(2).trim().toUpperCase().includes(trackname.toUpperCase());
        }, 180000);
        console.log(response);
        return nextQuestion();
      };
      nextQuestion();
    });
  },
  old: async () => {
    const {
      playlists
    } = await spotifyApi("/v1/browse/categories/toplists/playlists", token);
    const playlist = await spotifyApi(`/v1/playlists/${playlists.items[0].id}/tracks`, token);
    const seeds = playlist.items.slice(0, 5).map(track => track.track.id);
    const seededplaylist = await spotifyApi("/v1/recommendations?seed_genres=pop&min_popularity=90&limit=100", token);

    const nextQuestion = async () => {
      if (!seededplaylist.tracks[0]) return;
      const track = seededplaylist.tracks.splice(0, 1)[0];
      const response = await message.channel.textPrompt(new MessageEmbed({
        title: "Pop quiz!",
        description: "What is the name of this song?",
        fields: [{
          name: "Artist",
          value: track.artists[0].name
        },
        {
          name: "Album",
          value: track.album.name
        },
        {
          name: "Partial name",
          value: track.name.replace(/ *\([^)]*\) */g, "").split(" ").map(word => word[0] + "\\_".repeat(word.length - 1)).join(" ")
        }
        ],
        thumbnail: {
          url: track.album.images[0].url
        }
      }), message => {
        if (!/^A:/.test(message.content)) return false;
        return message.content.slice(2).trim().toUpperCase === track.name.replace(/ *\([^)]*\) */g, "").toUpperCase();
      }, 180000);
      console.log(response);
      return nextQuestion();
    };
    //nextQuestion();
    const songs = await spotifyApi("/v1/search?q=year:1990-1999&type=track", token);
    console.log();
  },
  conf: {
    permLevel: "Player"
  },

  help: {
    category: "Game"
  }
};
// if (args[0]) {
//   const {
//     genres
//   } = await spotifyApi("/v1/recommendations/available-genre-seeds", token);
//   const ranGenres = genres.sort(() => .5 - Math.random()).slice(0, 9);
//   const keyGenres = ranGenres.reduce((obj, genre) => {
//     obj[genre.replace(/-/g, " ").toProperCase()] = genre;
//     return obj;
//   }, {});
//   message.multiplePrompt(Object.keys(keyGenres)).then(async choice => {
//     const {
//       tracks
//     } = await spotifyApi("/v1/recommendations?seed_genres=" + keyGenres[choice], token);
//     const song = tracks[0];
//     message.channel.send(new MessageEmbed({
//       title: choice + " quiz!",
//       description: "What is the name of this song?",
//       fields: [{
//         name: "Artist",
//         value: song.artists[0].name
//       },
//       {
//         name: "Album",
//         value: song.album.name
//       },
//       {
//         name: "Partial name",
//         value: song.name.replace(/ *\([^)]*\) */g, "").split(" ").map(word => word[0] + "\\_".repeat(word.length - 1)).join(" ")
//       }
//       ],
//       thumbnail: {
//         url: song.album.images[0].url
//       }
//     }));
//     const collector = message.channel.createMessageCollector(m => /^A:/.test(m.content));
//     collector.on("collect", m => {
//       const ans = m.content.slice(2).trim();
//       if (ans.toUpperCase() == song.name.replace(/ *\([^)]*\) */g, "").toUpperCase()) m.reply("correct");
//       console.log(song.name);
//       console.log(m);
//     });

//   });
// }