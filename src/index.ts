import * as child from "child_process";
import * as path from "path";
import * as os from "os";
import * as fs from "fs-extra";
import * as readline from "readline";
const pkg = require('../package.json')

function debug(msgType: string, ...msg: any[]) {
  // console.log(msgType + ":" + msg.map(m => {
  //   let t = typeof (m) === "string" ? m : JSON.stringify(m);
  //   const p = t.indexOf("\"icon\":");
  //   if (p >= 0) {
  //     const e = t.indexOf("\"", p + 8);
  //     t = t.substring(0, p + 8) + "<ICON>" + t.substring(e);
  //   }
  //   const limit = 500;
  //   if (t.length > limit) {
  //     t = t.substring(0, limit / 2) + "..." + t.substring(t.length - limit / 2);
  //   }
  //   return t;
  // }).join(" "));
  return;
}

export interface MenuItem {
  title: string;
  tooltip: string;
  checked?: boolean;
  enabled: boolean;
  hidden?: boolean;
}

export interface Menu {
  icon: string;
  title: string;
  tooltip: string;
  items: MenuItem[];
}

export interface ClickEvent {
  type: "clicked";
  item: MenuItem;
  seq_id: number;
}

export interface ReadyEvent {
  type: "ready";
}

export type Event = ClickEvent | ReadyEvent;

export interface UpdateItemAction {
  type: "update-item";
  item: MenuItem;
  seq_id: number;
}

export interface UpdateMenuAction {
  type: "update-menu";
  menu: Menu;
  seq_id: number;
}

export interface UpdateMenuAndItemAction {
  type: "update-menu-and-item";
  menu: Menu;
  item: MenuItem;
  seq_id: number;
}

export interface ExitAction {
  type: "exit";
}

export type Action = UpdateItemAction | UpdateMenuAction | UpdateMenuAndItemAction | ExitAction;

export interface Conf {
  menu: Menu;
  debug?: boolean;
  copyDir?: boolean | string;
}

const getTrayBinPath = async (debug: boolean = false, copyDir: boolean | string = false) => {
  const binName = ({
    win32: `tray_windows${debug ? "" : "_release"}.exe`,
    darwin: `tray_darwin${debug ? "" : "_release"}`,
    linux: `tray_linux${debug ? "" : "_release"}`,
  })[process.platform];
  const binPath = path.resolve(`./traybin/${binName}`);
  if (copyDir) {
    copyDir = path.join((
      typeof copyDir === "string"
        ? copyDir
        : `${os.homedir()}/.cache/node-systray/`), pkg.version);

    const copyDistPath = path.join(copyDir, binName);
    try {
      await fs.stat(copyDistPath);
    } catch (error) {
      await fs.ensureDir(copyDir);
      await fs.copy(binPath, copyDistPath);
    }

    return copyDistPath;
  }
  return binPath;
};
const CHECK_STR = " (√)";
function updateCheckedInLinux(item: MenuItem) {
  if (process.platform !== "linux") {
    return item;
  }
  if (item.checked) {
    item.title += CHECK_STR;
  } else {
    item.title = (item.title || "").replace(RegExp(CHECK_STR + "$"), "");
  }
  return item;
}

export default class SysTray {
  protected _conf: Conf;
  protected _process: child.ChildProcess;
  protected _rl: readline.ReadLine;
  protected _binPath: string;
  private _ready: Promise<void>;

  constructor(conf: Conf) {
    this._conf = conf;
    this._process = null!;
    this._rl = null!;
    this._binPath = null!;
    this._ready = this.init();
  }

  private async init() {
    const conf = this._conf;
    this._binPath = await getTrayBinPath(conf.debug, conf.copyDir);
    try {
      await fs.chmod(this._binPath, "+x");
    } catch (error) {
      // ignore
    }
    return new Promise<void>((resolve, reject) => {
      this._process = child.spawn(this._binPath, [], {
        windowsHide: true,
      });
      this._rl = readline.createInterface({
        input: this._process.stdout!,
      });
      conf.menu.items = conf.menu.items.map(updateCheckedInLinux);
      this._rl.on("line", data => debug("onLine", data));
      this.onReady(() => {
        this.writeLine(JSON.stringify(conf.menu));
        resolve();
      });
    });
  }

  ready() {
    return this._ready;
  }

  onReady(listener: () => void) {
    this._rl.on("line", (line: string) => {
      const action: Event = JSON.parse(line);
      if (action.type === "ready") {
        listener();
        debug("onReady", action);
      }
    });
    return this;
  }

  async onClick(listener: (action: ClickEvent) => void) {
    await this.ready();
    this._rl.on("line", (line: string) => {
      const action: ClickEvent = JSON.parse(line);
      if (action.type === "clicked") {
        debug("onClick", action);
        listener(action);
      }
    });
    return this;
  }

  private writeLine(line: string) {
    if (line) {
      debug("writeLine", line + "\n", "=====");
      this._process.stdin!.write(line.trim() + "\n");
    }
    return this;
  }

  sendAction(action: Action) {
    switch (action.type) {
      case "update-item":
        action.item = updateCheckedInLinux(action.item);
        break;
      case "update-menu":
        action.menu.items = action.menu.items.map(updateCheckedInLinux);
        break;
      case "update-menu-and-item":
        action.menu.items = action.menu.items.map(updateCheckedInLinux);
        action.item = updateCheckedInLinux(action.item);
        break;
    }
    debug("sendAction", action);
    this.writeLine(JSON.stringify(action));
    return this;
  }
  /**
   * Kill the systray process
   * @param exitNode Exit current node process after systray process is killed, default is true
   */
  async kill(exitNode = true) {
    return new Promise((resolve, reject) => {
      try {
        this.onExit(() => {
          resolve();
          if (exitNode) {
            process.exit(0);
          }
        });
        this.sendAction({
          type: "exit"
        });
        // this._rl.close();
        // this._process.kill();
      } catch (error) {
        reject(error);
      }
    });
  }

  onExit(listener: (code: number | null, signal: string | null) => void) {
    this._process.on("exit", listener);
  }

  onError(listener: (err: Error) => void) {
    this._process.on("error", err => {
      debug("onError", err, "binPath", this.binPath);
      listener(err);
    });
  }

  get killed() {
    return this._process.killed;
  }

  get binPath() {
    return this._binPath;
  }
}
