![playgta4.com](https://i.pinimg.com/736x/c3/27/8c/c3278c78ca8ddff27cfca9aeb5a93855.jpg)

# playgta4.com

GTA IV in the browser, built on Liberty Recompiled with WebAssembly and WebGPU. Still a work in progress.

## Run

Requires Node.js 18+, Git LFS, and a browser with WebGPU and WebAssembly memory64 support.

```sh
git lfs install
git clone https://github.com/luvettee/playgta4.com.git
cd playgta4.com
git lfs pull
node runtime/launch.js
```

Open http://localhost:3001 and click inside the game to enable audio and input. No build step or npm install needed. You can also launch with `./start.sh` on macOS and Linux. Press Ctrl+C to stop the server.

## Controls

WASD to move or drive, mouse to look, F to enter or leave a car, and Alt+Enter for fullscreen.

See [Liberty License.txt](Liberty%20License.txt) for the engine license.
