import { ChatInputCommandInteraction } from 'discord.js';

export const name = 'purge';
export const description = 'Delete the last messages in all chats.';
export const options = [
  {
    name: 'num',
    type: 4, //'INTEGER' Type
    description: 'The number of messages you want to delete. (max 100)',
    required: true
  }
];
export async function execute(interaction: ChatInputCommandInteraction) {
  const deleteCount = interaction.options.get('num')?.value;
  if (!deleteCount || typeof deleteCount === 'boolean') {
    return void interaction.reply({
      content: `Please provide a number between 2 and 100 for the number of messages to delete`,
      ephemeral: true
    });
  }
  const parsedDeleteCount =
    typeof deleteCount === 'string' ? parseInt(deleteCount) : deleteCount;
  if (parsedDeleteCount < 2 || parsedDeleteCount > 100) {
    return void interaction.reply({
      content: `Please provide a number between 2 and 100 for the number of messages to delete`,
      ephemeral: true
    });
  }

  const fetched = await interaction.channel?.messages.fetch({
    limit: parsedDeleteCount
  });

  interaction.channel
    // @ts-expect-error TODO: Fix type
    ?.bulkDelete(fetched)
    .then(() => {
      interaction.reply({
        content: `Succesfully deleted messages`,
        ephemeral: true
      });
    })
    .catch((error: any) => {
      interaction.reply({
        content: `Couldn't delete messages because of: ${error}`,
        ephemeral: true
      });
    });
}
