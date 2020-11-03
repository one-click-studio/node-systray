# node-systray

> SysTray2 library for nodejs using [systray-portable](https://github.com/felixhao28/systray-portable) (a portable version of [the go systray library](https://github.com/getlantern/systray)).


## Install
```sh
npm i systray2
# or
yarn add systray2
```

## Usage

```ts
import SysTray from 'systray2';

const systray = new SysTray({
    menu: {
        // you should use .png icon on macOS/Linux, and .ico format on Windows
        icon: "<base64 image string>",
        title: "标题",
        tooltip: "Tips",
        items: [{
            title: "aa",
            tooltip: "bb",
            // checked is implemented by plain text in linux
            checked: true,
            enabled: true
        }, {
            title: "aa2",
            tooltip: "bb",
            checked: false,
            enabled: true,
            // hidden 
            hidden: true
        }, {
            title: "Exit",
            tooltip: "bb",
            checked: false,
            enabled: true
        }]
    },
    debug: false,
    copyDir: true, // copy go tray binary to outside directory, useful for packing tool like pkg.
});

systray.onClick(action => {
    if (action.seq_id === 0) {
        systray.sendAction({
            type: 'update-item',
            item: {
                ...action.item,
                checked: !action.item.checked,
            },
            seq_id: action.seq_id,
        });
        // show item 1
        systray.sendAction({
            type: 'update-item',
            item: {
                ...action.item,
                hidden: false,
            },
            seq_id: 1,
        });
    } else if (action.seq_id === 1) {
        // open the url
        console.log('open the url', action);
        // and then hide itself
        systray.sendAction({
            type: 'update-item',
            item: {
                ...action.item,
                hidden: true,
            },
            seq_id: 1,
        });
    } else if (action.seq_id === 2) {
        systray.kill();
    }
});

```

To integrate with packing tools like `webpack`, use something like `copy-webpack-plugin` to copy the desired `tray_*_release[.exe]` to the `traybin/` folder of the working directory.

## License
MIT
