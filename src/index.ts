import dotenv from 'dotenv';
dotenv.config();
import Client from './client/Client.js';
import activityJson from '../config.json' with { type: 'json' };
import { Collection, Status } from 'discord.js';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

import customPreview from './utils/embedPreview';
import config from '../config.json';
import dotenv from 'dotenv';

dotenv.config();

// Interface for Client commands
interface CustomClient extends Client {
  commands?: Collection<string, any>;
}

// Initialize Discord client
const client = new Client();
client.commands = new Collection();

const __dirname = dirname(import.meta.url).replace('file://', '');

const commandsDir = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsDir).filter((file) =>
  file.endsWith('.js')
);
console.log(commandFiles);

for (const file of commandFiles) {
  const filePath = join(commandsDir, file);
  const command = await import(`${filePath}`);
  console.log(command);

  client.commands.set(command.name, command);
}

console.log(`Loaded ${client.commands.size} commands`);

// Initialize Discord player
const player = new Player(client);
player.extractors
  .loadDefault()
  .then((r) => console.log('Extractors loaded successfully'));

// Event listeners for player events
let queueMessage: Message | null = null;

player.events.on('audioTrackAdd', (queue, song) => {
  const channel = queue.metadata.channel;

  if (channel) {
    if (!queueMessage) {
      channel
        .send({
          embeds: [customPreview('NEW SONG ADDED TO THE QUEUE', song.title)]
        })
        .then((message: Message) => (queueMessage = message))
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
        .catch((error: string) =>
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

player.events.on('audioTracksAdd', (queue, track) => {
  queue.metadata.channel.send(`🎶 | Tracks have been queued!`);
});

player.events.on('disconnect', (queue) =>
  queue.metadata.channel.send(
    '❌ | I was manually disconnected from the voice channel, clearing queue!'
  )
);

player.events.on('emptyChannel', (queue: any) => {
  const channel = queue.metadata.channel;
  if (channel) {
    channel
      .send('Nobody is in the voice channel, leaving...')
      .then((message: Message) => {
        setTimeout(() => {
          message.delete();
        }, 30000);
      });
  } else {
    console.error('Queue metadata does not contain channel information');
  }
});

player.events.on('emptyQueue', (queue) =>
  queue.metadata.channel.send('✅ | Queue finished!')
);

player.events.on('error', (queue, error) =>
  console.log(
    `[${queue.guild.name}] Error emitted from the connection: ${error.message}`
  )
);

// For debugging
// player.on('debug', async message => {
//   console.log(`General player debug event: ${message}`);
// });

// player.events.on('debug', async (queue, message) => {
//   console.log(`Player debug event: ${message}`);
// });

// player.events.on('playerError', (queue, error) => {
//   console.log(`Player error event: ${error.message}`);
//   console.log(error);
// });

// event listener for client ready
client.on('ready', () => {
  console.log('Bot is ready!');
  try {
    client.user.presence.set({
      activities: [{ name: activity, type: Number(activityType) }],
      status: Status.Ready
    });
  } catch (error) {
    console.error(error.message);
  }
});

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
      await message.guild.commands.set(client.commands);
      message.reply('Deployed!');
    } catch (error: any) {
      console.error('Something went wrong:', error.message);
      message.reply(
        'Clould not deploy commands! Make sure the bot has the application.commands permission!'
      );
    }
  }
});

// Event listener for interaction - Interactions
client.on('interactionCreate', async (interaction: any) => {
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
