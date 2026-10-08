import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

export type CommandGroup =
  'Simulation' | 'AI CEO' | 'Go to' | 'Startups' | 'Account' | 'Appearance';

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  /** Extra words the fuzzy search matches on. */
  keywords?: string;
  /** When set, the command is shown disabled with this reason. */
  disabledReason?: string | null;
  run: () => void | Promise<void>;
}

type Sources = Map<string, Command[]>;
const RegistryContext = createContext<{ current: Sources } | null>(null);

/**
 * Commands that only a mounted panel can run (submit the turn with the decisions on screen,
 * ask the AI CEO) are registered by that panel; the palette reads them when it renders.
 */
export function CommandRegistryProvider({ children }: { children: ReactNode }) {
  const sources = useRef<Sources>(new Map());
  return <RegistryContext.Provider value={sources}>{children}</RegistryContext.Provider>;
}

/** Registers the panel's commands, refreshed on every render, removed on unmount. */
export function useCommandSource(source: string, commands: Command[]): void {
  const registry = useContext(RegistryContext);
  useEffect(() => {
    registry?.current.set(source, commands);
  });
  useEffect(() => {
    const sources = registry?.current;
    return () => {
      sources?.delete(source);
    };
  }, [registry, source]);
}

/** Every registered command, by id. */
export function useRegisteredCommands(): () => Map<string, Command> {
  const registry = useContext(RegistryContext);
  return () => {
    const all = new Map<string, Command>();
    registry?.current.forEach((commands) => commands.forEach((c) => all.set(c.id, c)));
    return all;
  };
}
