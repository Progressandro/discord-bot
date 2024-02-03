import { useQueue } from 'discord-player';
import { isInVoiceChannel } from '../utils/voicechannel';
import { setQueueMessage } from '../utils/stateHandler';

export const name = 'stop';
export const description = 'Stop all songs in the queue!';
export async function execute(interaction: any) {
  const inVoiceChannel = isInVoiceChannel(interaction);
  if (!inVoiceChannel) {
    return;
  }

  await interaction.deferReply();
  const queue = useQueue(interaction.guild.id);
  if (!queue || !queue.currentTrack)
    return void interaction.followUp({
      content: '❌ | No music is being played!'
    });
  setQueueMessage(null);
  queue.node.stop();

  return void interaction.followUp({ content: '🛑 | Stopped the player!' });
}
