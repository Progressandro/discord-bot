import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Message,
  PresenceUpdateStatus,
  EmbedBuilder
} from 'discord.js';
import { Player } from 'discord-player';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import { getQueueMessage, setQueueMessage } from './utils/stateHandler';
import { execute as nowPlayingCommandExecute } from './commands/nowplaying';

import customPreview from './utils/embedPreview';
import config from '../config.json';
import dotenv from 'dotenv';
import { monitorUsage } from './utils/monitorUsage';

dotenv.config();

// Interface for Client commands
interface CustomClient extends Client {
  commands?: Collection<string, any>;
}

// Initialize Discord client
const client: CustomClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Load commands
client.commands = new Collection();

const __dirname = dirname(import.meta.url).replace('file://', '');

const commandsDir = join(__dirname, 'commands');

try {
  const commandFiles: string[] = readdirSync(commandsDir).filter((file) =>
    file.endsWith('.ts')
  );

  for (const file of commandFiles) {
    const filePath = join(commandsDir, file);
    import(`${filePath}`)
      .then((module) => {
        const command = module;
        // console.log(command);
        if (client.commands) {
          client.commands.set(command.name, command);
          // console.log(`Loaded ${client.commands.size} commands`, '0 commands');
        } else {
          console.error('client.commands is undefined');
        }
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
} catch (error) {
  console.error('Error loading commands:', error);
}

// Load client
client.on(Events.ClientReady, (readyClient) => {
  console.log(`${readyClient.user.tag} is ready!`);
  monitorUsage(process.pid);

  try {
    //Set presence
    client.user?.presence.set({
      activities: [
        { name: config.activity, type: Number(config.activityType) }
      ],
      status: PresenceUpdateStatus.Online
    });
  } catch (error) {
    console.error('Something went wrong:', error);
  }
});

// Initialize Discord player
const player = new Player(client);
player.extractors.loadDefault();
console.log('Extractors loaded successfully');

// Event listeners for player events
let queueMessage = getQueueMessage();

/*
 * Bot connection State
 * Disconnect when they're not users in the channel
 */
client.on('voiceStateUpdate', (oldState, newState) => {
  // Get the bot's voice connection
  const botMember = newState.guild.members.me;

  // Check if the bot is connected to a voice channel
  if (botMember?.voice.channel) {
    const voiceChannel = botMember.voice.channel;

    // Check if the bot is alone in the voice channel
    if (voiceChannel.members.size === 1) {
      setTimeout(() => {
        botMember.guild.members.me?.voice.disconnect();
      }, 3000);
    }
  }
});

player.events.on('disconnect', (queue) => {
  console.log(queue.connection?.eventNames);

  queue.metadata.channel.send(
    '❌ | I was disconnected from the voice channel because no users were using me. Clearing queue!'
  );
});

// No tocar la queue.metadata.channel;
player.events.on('audioTrackAdd', (queue, song) => {
  if (!queue.metadata.channel) {
    console.error('Queue metadata does not contain channel information');
    return;
  }
  const channel = queue.metadata.channel;

  if (channel) {
    if (!queueMessage) {
      channel
        .send({
          embeds: [customPreview('NEW SONG ADDED TO THE QUEUE', song.title)]
        })
        .then((message: Message) => setQueueMessage(message))
        .catch((error: string) =>
          console.error(
            'Something went wrong trying to add a new song to the queue:',
            error
          )
        );
      console.log(queueMessage);
    } else {
      queueMessage
        .edit({
          embeds: [customPreview('NEW SONG ADDED TO THE QUEUE', song.title)]
        })
        .catch((error) =>
          console.error(
            'Something went wrong trying to edit the queue message:',
            error
          )
        );
      console.log(queueMessage);
    }
  } else {
    console.error('Queue metadata does not contain channel information');
  }
});

player.events.on('playerStart', async (queue, track) => {
  queue.metadata.channel.send(`▶ | Started playing: **${track.title}**!`);
});

player.events.on('audioTracksAdd', (queue, _track) => {
  queue.metadata.channel.send(`🎶 | Tracks have been queued!`);
});

player.events.on('emptyQueue', (queue) =>
  queue.metadata.channel.send('✅ | Queue finished!')
);

player.events.on('error', (queue, error) =>
  console.log(
    `[${queue.guild.name}] Error emitted from the connection: ${error.message}`
  )
);

// Event listeners for client reconnection and disconnection
client.once('reconnecting', () => console.log('Reconnecting!'));
client.once('disconnect', () => console.log('Disconnect!'));

// Event listener for message interactions
client.on('messageCreate', async (message: Message) => {
  if (message.author.bot || !message.guild) return;
  if (!client.application?.owner) await client.application?.fetch();

  if (
    message.content === '!deploy' &&
    message.author.id === client.application?.owner?.id
  ) {
    try {
      // TODO - change this ts-ignore
      //@ts-ignore
      await message.guild.commands.set(client.commands);
      message.reply('Deployed!');
    } catch (error) {
      console.error('Something went wrong:', error.message);
      message.reply(
        'Clould not deploy commands! Make sure the bot has the application.commands permission!'
      );
    }
  }
});

// Event listener for interaction - Interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (!client.commands) return;

  const command = client.commands.get(interaction.commandName.toLowerCase());
  if (!command) return;

  try {
    if (['ban', 'userinfo'].includes(interaction.commandName)) {
      command.execute(interaction, client);
    } else {
      command.execute(interaction);
    }
  } catch (error: any) {
    console.error(error.message);
    await interaction.followUp({
      content: 'There was an error trying to execute that command!'
    });
  }
});

client.login(process.env.DISCORD_TOKEN);

// ### Be humble ###
