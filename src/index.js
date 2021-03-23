const { Client, Intents } = require('discord.js');
const { NoSubscriberBehavior, StreamType, createAudioPlayer, createAudioResource, entersState, AudioPlayerStatus, VoiceConnectionStatus, joinVoiceChannel } = require('@discordjs/voice');
const { createRecorder } = require('./Recorder');
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

const args = yargs(hideBin(process.argv))
  .option('config', {
    alias: 'c',
    description: 'configuration file path',
    type: 'string',
    default: '../data/config.json'
  }).argv

const config = require(args.config);
console.log(config);

const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Play,
    maxMissedFrames: Math.round(config.maxTransmissionGap / 20)
  }
});

player.on('stateChange', (oldState, newState) => {
  if (oldState.status === AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Playing) {
    console.log('Playing audio output on audio player');
  } else if (newState.status === AudioPlayerStatus.Idle) {
    console.log('Playback has stopped. Attempting to restart.');
    setTimeout(() => attachRecorder(), 3e3);
  }
});

async function attachRecorder() {
  const resource = createAudioResource(createRecorder(config.device, config.type), {
    inputType: StreamType.OggOpus,
  });
  player.play(resource);
}

async function connectToChannel(channel) {
  const connection = joinVoiceChannel(channel);
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30e3);
    return connection;
  } catch (error) {
    connection.destroy();
    throw error;
  }
}

const client = new Client({
  ws: { intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] },
});

void client.login(config.token);

client.on('ready', async () => {
  console.log('Discord.js client is ready!');
  try {
    await attachRecorder();
		const channel = client.channels.cache.get(config.channelId);
    if (!channel) return console.error("The channel does not exist!");
    const connection = await connectToChannel(channel);
    connection.subscribe(player);
    // Yay, it worked!
    console.log("Successfully connected.");
  } catch (error) {
    console.error(error);
  }
});

client.on('message', async (message) => {
  if (!message.guild) return;
  if (message.content === '-join') {
    const channel = message.member?.voice.channel;
    if (channel) {
      try {
        const connection = await connectToChannel(channel);
        connection.subscribe(player);
        await message.reply('Playing now!');
      } catch (error) {
        console.error(error);
      }
    } else {
      void message.reply('Join a voice channel then try again!');
    }
  }
});
