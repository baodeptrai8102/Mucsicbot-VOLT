import { Collection } from "discord.js";
import type { Command } from "./types";
import { playCommand } from "./play";
import { pauseCommand } from "./pause";
import { resumeCommand } from "./resume";
import { skipCommand } from "./skip";
import { stopCommand } from "./stop";
import { queueCommand } from "./queue";
import { nowPlayingCommand } from "./nowplaying";
import { shuffleCommand } from "./shuffle";
import { loopCommand } from "./loop";
import { autoplayCommand } from "./autoplay";
import { volumeCommand } from "./volume";
import { helpCommand } from "./help";

export const commands = new Collection<string, Command>();
export const aliases = new Collection<string, string>();

const allCommands: Command[] = [
  playCommand,
  pauseCommand,
  resumeCommand,
  skipCommand,
  stopCommand,
  queueCommand,
  nowPlayingCommand,
  shuffleCommand,
  loopCommand,
  autoplayCommand,
  volumeCommand,
  helpCommand
];

for (const cmd of allCommands) {
  commands.set(cmd.name, cmd);
  if (cmd.aliases) {
    for (const alias of cmd.aliases) {
      aliases.set(alias, cmd.name);
    }
  }
}

export function getCommand(nameOrAlias: string): Command | undefined {
  const normalized = nameOrAlias.toLowerCase();
  const direct = commands.get(normalized);
  if (direct) return direct;
  const canonicalName = aliases.get(normalized);
  if (canonicalName) return commands.get(canonicalName);
  return undefined;
}
