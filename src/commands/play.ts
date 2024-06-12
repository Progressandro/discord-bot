import { ApplicationCommandOptionType } from 'discord.js';
import { useMainPlayer, useQueue } from 'discord-player';
import { isInVoiceChannel } from '../utils/voicechannel';
import ytdl from 'ytdl-core';
import yts from 'yt-search';

export const name = 'play';
export const description = 'Play a song in your channel!';
export const options = [
  {
    name: 'query',
    type: ApplicationCommandOptionType.String,
    description: 'The song you want to play',
    required: true
  }
];

export async function execute(interaction: any) {
  try {
    const inVoiceChannel = isInVoiceChannel(interaction);
    if (!inVoiceChannel) return;

    await interaction.deferReply();

    const player = useMainPlayer();
    const query = interaction.options.getString('query');

    // Check if the query is a valid youtube url
    const isYoutubeUrl = ytdl.validateURL(query);

    if (!isYoutubeUrl) {
      // If the query is not a valid url, assume it is a youtube search
      const { videos } = await yts(query);

      // Check if search results are available
      if (!videos || videos.length === 0) {
        return void interaction.followUp({ content: 'No results were found' });
      }

      // Display search results to the user
      const searchMessage = `**Search Results:**\n${videos
        .slice(0, 10)
        .map(
          (video: { title: any }, index: number) =>
            `${index + 1}. ${video.title}`
        )
        .join('\n')}`;
      await interaction.followUp({ content: searchMessage });

      // Wait for the user to select a video
      const filter = (m: any) =>
        m.author.id === interaction.user.id &&
        !isNaN(m.content) &&
        parseInt(m.content) <= videos.length &&
        parseInt(m.content) >= 1;
      const response = await interaction.channel.awaitMessages({
        filter,
        max: 1,
        time: 60000,
        errors: ['time']
      });

      const selectedVideoIndex = parseInt(response.first()?.content!) - 1;
      const selectedVideo = videos[selectedVideoIndex];

      await player?.play(
        interaction.member.voice.channel.id,
        selectedVideo.url,
        {
          nodeOptions: {
            metadata: {
              channel: interaction.channel,
              client: interaction.guild?.members.me,
              requestedBy: interaction.user.username
            },
            leaveOnEmptyCooldown: 100000,
            leaveOnEmpty: true,
            leaveOnEnd: false,
            bufferingTimeout: 0,
            volume: 30,
            defaultFFmpegFilters: ['normalizer']
            // defaultFFmpegFilters: ['lofi', 'bassboost', 'normalizer']
          }
        }
      );
    } else {
      // Play the youtube url directly
      await player?.play(interaction.member.voice.channel.id, query, {
        nodeOptions: {
          metadata: {
            channel: interaction.channel,
            client: interaction.guild?.members.me,
            requestedBy: interaction.user.username
          },
          leaveOnEmptyCooldown: 100000,
          leaveOnEmpty: true,
          leaveOnEnd: false,
          bufferingTimeout: 0,
          volume: 30,
          defaultFFmpegFilters: ['normalizer']
          // defaultFFmpegFilters: ['lofi', 'bassboost', 'normalizer']
        }
      });
    }

    const loadingMessage = await interaction.followUp({
      content: `⏱ | Loading your track...`
    });

    const queue = useQueue(interaction.guild.id);

    if (!queue || !queue.currentTrack) {
      return void interaction.followUp({
        content: 'No music is being played'
      });
    }

    const progress = queue.node.createProgressBar();
    const perc = queue.node.getTimestamp();

    const playerMessage = await interaction.followUp({
      embeds: [
        {
          title: 'Now Playing',
          description: `🎶 | **${queue.currentTrack.title}**! (\`${
            perc?.progress ?? '0'
          }%\`)`,
          fields: [
            {
              name: '\u200b',
              value: progress
            }
          ],
          color: 0xffffff
        }
      ]
    });

    function updatePlayerMessage() {
      if (!queue || !queue.currentTrack) {
        clearInterval(interval);
        return void interaction.followUp({
          content: 'No music is being played'
        });
      }
      const progress = queue.node.createProgressBar();
      const perc = queue.node.getTimestamp();
      playerMessage.edit({
        embeds: [
          {
            title: 'Now Playing',
            description: `🎶 | **${
              queue?.currentTrack && queue?.currentTrack.title
            }**! (\`${perc?.progress ?? '0'}%\`)`,
            fields: [
              {
                name: '\u200b',
                value: progress
              }
            ],
            color: 0xffffff
          }
        ]
      });
    }

    const interval = setInterval(updatePlayerMessage, 1000);

    setTimeout(async () => {
      await loadingMessage.delete();
    }, 5000);
  } catch (error) {
    await interaction.editReply({
      content: 'An error has occurred!'
    });
    console.error(error);
  }
}
