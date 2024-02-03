import { Message } from 'discord.js';

let queueMessage: Message | null = null;

export const getQueueMessage = () => queueMessage;

export const setQueueMessage = (message: Message | null) => {
  queueMessage = message;
};
