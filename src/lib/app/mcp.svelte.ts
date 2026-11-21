import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { message } from '@tauri-apps/plugin-dialog';
import { L } from '#lib/i18n';
import type { Doc } from '#lib/document/doc.svelte';
import { handle } from './mcp';
import { render } from './render';

/** Plume › MCP Server: off by default, remembered per machine (localStorage), desktop app only.
 *  When on, the Rust shell listens on 127.0.0.1 for `Plume --mcp` relays and sends each request here (`mcp-call`). */
export class McpServer {
  running = $state(false);
  readonly available = isTauri();
  #listening = false;

  constructor(private doc: Doc) {}

  /** At launch: back on if it was on when Plume quit. */
  async restore() {
    let on = false;
    try { on = localStorage.getItem('mcp') === 'on'; } catch { /* stays off */ }
    if (on) await this.toggle();
  }

  async toggle() {
    if (!this.available) return;
    if (!this.#listening) {
      this.#listening = true;
      await listen<{ id: number; message: Parameters<typeof handle>[1] }>('mcp-call', async ({ payload }) => {
        const response = await handle(this.doc, payload.message, (f, scale) => render(f, 'png', scale));
        await invoke('mcp_reply', { id: payload.id, response: JSON.stringify(response) });
      });
    }
    try {
      await invoke(this.running ? 'mcp_stop' : 'mcp_start');
      this.running = !this.running;
    } catch (e) {
      this.running = false;
      await message(String(e), { title: L('Could not start the MCP server.'), kind: 'error' });
    }
    try { localStorage.setItem('mcp', this.running ? 'on' : 'off'); } catch { /* not remembered */ }
  }
}
