// tslint:disable: no-floating-promises
import * as os from 'os'
import * as path from 'path'
import * as assert from 'assert'
import SysTray from './index'
const menu = require('./menu.js')
const pkg = require('./package.json')

menu.icon = os.platform() === 'win32' ? './logo_s.ico' : './logo_s.png'

describe('test', function () {
  this.timeout(1000 * 24 * 3600)

  it('systray release is ok', async () => {
    const systray = new SysTray({ menu, debug: false })
    await systray.onClick(async action => {
      if (action.seq_id === 0) {
        await systray.sendAction({
          type: 'update-item',
          item: {
            ...(action.item),
            checked: !action.item.checked
          }
        })
      } else if (action.seq_id === 2) {
        await systray.kill()
      }
      console.log('action', action)
    })
    await systray.ready()
    systray.process.stderr?.on('data', (chunk) => {
      console.log(chunk.toString())
    })
    console.log('Exit the tray in 1000ms...')
    const exitInfo = new Promise<{ code: number | null; signal: string | null }>(resolve => systray.onExit((code, signal) => resolve({ code, signal })))
    await new Promise<void>((resolve, reject) => {
      setTimeout(async () => {
        await systray.kill(false)
        resolve()
      }, 1000)
    })
    const { code, signal } = await exitInfo
    console.log('code', code, 'signal', signal)
    assert.strictEqual(code, 0)
    assert.strictEqual(signal, null)
  })

  it('systray copyDir is ok', async () => {
    const debug = false
    const systray = new SysTray({ menu, debug, copyDir: true })
    const binName = ({
      win32: `tray_windows${debug ? '' : '_release'}.exe`,
      darwin: `tray_darwin${debug ? '' : '_release'}`,
      linux: `tray_linux${debug ? '' : '_release'}`
    })[process.platform]
    await systray.ready()
    assert.strictEqual(systray.binPath, path.resolve(`${os.homedir()}/.cache/node-systray/`, pkg.version, binName))
    await systray.onClick(async action => {
      if (action.seq_id === 0) {
        await systray.sendAction({
          type: 'update-item',
          item: {
            ...(action.item),
            checked: !action.item.checked
          }
        })
      } else if (action.seq_id === 2) {
        await systray.kill()
      }
      console.log('action', action)
    })
    console.log('Exit the tray in 1000ms...')
    const exitInfo = new Promise<{ code: number | null; signal: string | null }>(resolve => systray.onExit((code, signal) => resolve({ code, signal })))
    await new Promise<void>((resolve, reject) => {
      setTimeout(async () => {
        await systray.kill(false)
        resolve()
      }, 1000)
    })
    const { code, signal } = await exitInfo
    console.log('code', code, 'signal', signal)
    assert.strictEqual(code, 0)
  })
})
