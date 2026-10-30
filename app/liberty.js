// This code implements the `-sMODULARIZE` settings by taking the generated
// JS program code (INNER_JS_CODE) and wrapping it in a factory function.

// Single threaded MINIMAL_RUNTIME programs do not need access to
// document.currentScript, so a simple export declaration is enough.
var createLibertyModule = (() => {
  // When MODULARIZE this JS may be executed later,
  // after document.currentScript is gone, so we save it.
  // In EXPORT_ES6 mode we can just use 'import.meta.url'.
  var _scriptName = globalThis.document?.currentScript?.src;
  return async function(moduleArg = {}) {
    var Module = moduleArg;
// include: shell.js
// include: minimum_runtime_check.js
// end include: minimum_runtime_check.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).
// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = !!globalThis.window;

var ENVIRONMENT_IS_WORKER = !!globalThis.WorkerGlobalScope;

// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = globalThis.process?.versions?.node && globalThis.process?.type != "renderer";

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() running directly in a worker. (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)
// The way we signal to a worker that it is hosting a pthread is to construct
// it with a specific name.
var ENVIRONMENT_IS_PTHREAD = ENVIRONMENT_IS_WORKER && globalThis.name == "em-pthread";

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// include: /Users/bober/Documents/Projects/GTA 4/LibertyRecomp/web/shell/pre.js
// Prepended to liberty.js (--pre-js). Runs on the page and in every pthread worker.
// On the page it starts the IO worker (io_worker.js) before the runtime starts and hands it the
// shared wasm memory plus the address of the read-request table (web/platform/web_io.cpp).
// SDL3's memory64 helper expects BigInt, but proxied audio EM_ASM callbacks
// can deliver pointer arguments as Numbers. Install before SDL_Init, which
// keeps existing helpers. The build's 16 GB memory limit fits exactly in a
// JavaScript Number, including addresses above 4 GB (avoid bitwise shifts).
Module["SDL3"] = Module["SDL3"] || {};

Module["SDL3"]["CPtrToHeap32Index"] = function(ptr) {
  return Math.floor(Number(ptr) / 4);
};

if (typeof ENVIRONMENT_IS_PTHREAD === "undefined" || !ENVIRONMENT_IS_PTHREAD) {
  if (typeof Module["preRun"] === "function") Module["preRun"] = [ Module["preRun"] ];
  Module["preRun"] = Module["preRun"] || [];
  Module["preRun"].push(function() {
    // Exports and static memory exist here. Hold main until startup audio is cached.
    addRunDependency("startup-audio");
    if (Module["prepareAudioOutput"]) {
      addRunDependency("audio-output");
      Promise.resolve().then(function() {
        return Module["prepareAudioOutput"](Module);
      }).then(function() {
        removeRunDependency("audio-output");
      }).catch(function(error) {
        abort("Audio output preparation failed: " + error.message);
      });
    }
    var io = new Worker("io_worker.js");
    var failed = false;
    function fail(message) {
      if (failed) return;
      failed = true;
      io.terminate();
      abort("Audio preparation failed: " + message);
    }
    io.onerror = function(event) {
      fail(event.message || "IO worker failed");
    };
    io.onmessage = function(event) {
      var info = event.data;
      if (info.startupError) {
        fail(info.startupError);
        return;
      }
      if (info.audioProgress && Module["onAudioProgress"]) Module["onAudioProgress"](info);
      if (info.ready && !failed) {
        if (Module["onIoReady"]) Module["onIoReady"](info);
        removeRunDependency("startup-audio");
      }
    };
    Module["ioWorker"] = io;
    io.postMessage({
      init: true,
      memory: wasmMemory,
      table: Number(Module["_liberty_io_table"]())
    });
  });
}

// end include: /Users/bober/Documents/Projects/GTA 4/LibertyRecomp/web/shell/pre.js
var programArgs = [];

var thisProgram = "./this.program";

var quit_ = (status, toThrow) => {
  throw toThrow;
};

if (ENVIRONMENT_IS_WORKER) {
  _scriptName = self.location.href;
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = "";

function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  try {
    scriptDirectory = new URL(".", _scriptName).href;
  } catch {}
  {
    // include: web_or_worker_shell_read.js
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = url => {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.responseType = "arraybuffer";
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response));
      };
    }
    readAsync = async url => {
      var response = await fetch(url, {
        credentials: "same-origin"
      });
      if (response.ok) {
        return response.arrayBuffer();
      }
      throw new Error(response.status + " : " + response.url);
    };
  }
} else {}

var out = console.log.bind(console);

var err = console.error.bind(console);

// end include: shell.js
// include: preamble.js
// === Preamble library stuff ===
// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html
var wasmBinary;

// Wasm globals
// For sending to workers.
var wasmModule;

//========================================
// Runtime essentials
//========================================
// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// include: runtime_common.js
// include: runtime_exceptions.js
// end include: runtime_exceptions.js
// include: runtime_debug.js
// end include: runtime_debug.js
// Support for growable heap + pthreads, where the buffer may change, so JS views
// must be updated.
function growMemViews() {
  // `updateMemoryViews` updates all the views simultaneously, so it's enough to check any of them.
  if (wasmMemory.buffer != HEAP8.buffer) {
    updateMemoryViews();
  }
}

// include: runtime_pthread.js
// Pthread Web Worker handling code.
// This code runs only on pthread web workers and handles pthread setup
// and communication with the main thread via postMessage.
var startWorker;

if (ENVIRONMENT_IS_PTHREAD) {
  // Thread-local guard variable for one-time init of the JS state
  var initializedJS = false;
  // Turn unhandled rejected promises into errors so that the main thread will be
  // notified about them.
  self.onunhandledrejection = e => {
    throw e.reason || e;
  };
  function handleMessage(e) {
    try {
      var msgData = e.data;
      //dbg('msgData: ' + Object.keys(msgData));
      var cmd = msgData.cmd;
      if (cmd == 1) {
        // Preload command that is called once per worker to parse and load the Emscripten code.
        // Until we initialize the runtime, queue up any further incoming messages.
        let messageQueue = [];
        self.onmessage = e => messageQueue.push(e);
        // And add a callback for when the runtime is initialized.
        startWorker = () => {
          // Notify the main thread that this thread has loaded.
          postMessage({
            cmd: 3
          });
          // Process any messages that were queued before the thread was ready.
          for (let msg of messageQueue) {
            handleMessage(msg);
          }
          // Restore the real message handler.
          self.onmessage = handleMessage;
        };
        // Use `const` here to ensure that the variable is scoped only to
        // that iteration, allowing safe reference from a closure.
        for (const handler of msgData.handlers) {
          // If the main module has a handler for a certain event, but no
          // handler exists on the pthread worker, then proxy that handler
          // back to the main thread.
          if (!Module[handler] || Module[handler].proxy) {
            Module[handler] = (...args) => {
              postMessage({
                cmd: 9,
                handler,
                args
              });
            };
            // Rebind the out / err handlers if needed
            if (handler == "print") out = Module[handler];
            if (handler == "printErr") err = Module[handler];
          }
        }
        wasmMemory = msgData.wasmMemory;
        updateMemoryViews();
        wasmModule = msgData.wasmModule;
        createWasm();
        run();
        startWorker();
      } else if (cmd == 2) {
        // Call inside JS module to set up the stack frame for this pthread in JS module scope.
        // This needs to be the first thing that we do, as we cannot call to any C/C++ functions
        // until the thread stack is initialized.
        establishStackSpace(msgData.pthread_ptr);
        // Pass the thread address to wasm to store it for fast access.
        __emscripten_thread_init(msgData.pthread_ptr, /*is_main=*/ 0, /*is_runtime=*/ 0, /*can_block=*/ 1, 0, 0);
        PThread.receiveOffscreenCanvases(msgData);
        PThread.threadInitTLS();
        // Await mailbox notifications with `Atomics.waitAsync` so we can start
        // using the fast `Atomics.notify` notification path.
        __emscripten_thread_mailbox_await(msgData.pthread_ptr);
        if (!initializedJS) {
          initializedJS = true;
        }
        try {
          invokeEntryPoint(msgData.start_routine, msgData.arg);
        } catch (ex) {
          if (ex != "unwind") {
            // The pthread "crashed".  Do not call `_emscripten_thread_exit` (which
            // would make this thread joinable).  Instead, re-throw the exception
            // and let the top level handler propagate it back to the main thread.
            throw ex;
          }
        }
      } else if (cmd == 4) {
        if (initializedJS) {
          checkMailbox();
        }
      } else if (cmd) {
        // The received message looks like something that should be handled by this message
        // handler, (since there is a cmd field present), but is not one of the
        // recognized commands:
        err(`worker: received unknown command ${cmd}`);
        err(msgData);
      }
    } catch (ex) {
      if (runtimeInitialized) __emscripten_thread_crashed();
      throw ex;
    }
  }
  self.onmessage = handleMessage;
}

// ENVIRONMENT_IS_PTHREAD
// end include: runtime_pthread.js
// Memory management
var runtimeInitialized = false;

var runtimeExited = false;

// When ALLOW_MEMORY_GROWTH is enabled, the conversion from Wasm
// memory to ArrayBuffer requires some additional logic.
function getMemoryBuffer() {
  return wasmMemory.buffer;
}

function updateMemoryViews() {
  // If we already have a heap that is resizeable/growable buffer we don't
  // need to do anything in updateMemoryViews.
  if (HEAP8?.buffer?.growable) return;
  var b = getMemoryBuffer();
  HEAP8 = new Int8Array(b);
  HEAP16 = new Int16Array(b);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
  HEAPU16 = new Uint16Array(b);
  Module["HEAP32"] = HEAP32 = new Int32Array(b);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
  HEAPF32 = new Float32Array(b);
  HEAPF64 = new Float64Array(b);
  HEAP64 = new BigInt64Array(b);
  HEAPU64 = new BigUint64Array(b);
}

// In non-standalone/normal mode, we create the memory here.
// include: runtime_init_memory.js
// Create the wasm memory. (Note: this only applies if IMPORTED_MEMORY is defined)
function initMemory() {
  if ((ENVIRONMENT_IS_PTHREAD)) {
    return;
  }
  {
    var INITIAL_MEMORY = 1073741824;
    /** @suppress {checkTypes} */ wasmMemory = new WebAssembly.Memory({
      "initial": BigInt(INITIAL_MEMORY / 65536),
      // In theory we should not need to emit the maximum if we want "unlimited"
      // or 4GB of memory, but VMs error on that atm, see
      // https://github.com/emscripten-core/emscripten/issues/14130
      // And in the pthreads case we definitely need to emit a maximum. So
      // always emit one.
      "maximum": 262144n,
      "shared": true,
      "address": "i64"
    });
  }
  updateMemoryViews();
}

// end include: runtime_init_memory.js
// include: memoryprofiler.js
// end include: memoryprofiler.js
// end include: runtime_common.js
function preRun() {
  var preRun = Module["preRun"];
  if (preRun) {
    if (typeof preRun === "function") preRun = [ preRun ];
    onPreRuns.push(...preRun);
  }
  // Begin ATPRERUNS hooks
  callRuntimeCallbacks(onPreRuns);
}

function initRuntime() {
  runtimeInitialized = true;
  if (ENVIRONMENT_IS_PTHREAD) return;
  // No ATINITS hooks
  wasmExports["Td"]();
}

function exitRuntime() {
  ___funcs_on_exit();
  // Native atexit() functions
  // Begin ATEXITS hooks
  callRuntimeCallbacks(onExits);
  // End ATEXITS hooks
  PThread.terminateRuntime();
  runtimeExited = true;
}

function postRun() {
  var postRun = Module["postRun"];
  if (postRun) {
    if (typeof postRun === "function") postRun = [ postRun ];
    onPostRuns.push(...postRun);
  }
  // Begin ATPOSTRUNS hooks
  callRuntimeCallbacks(onPostRuns);
}

/**
 * @param {string|number=} what
 */ function abort(what) {
  Module["onAbort"]?.(what);
  what = `Aborted(${what})`;
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);
  ABORT = true;
  what += ". Build with -sASSERTIONS for more info.";
  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.
  // See above, in the meantime, we resort to wasm code for trapping.
  // In case abort() is called before the module is initialized, wasmExports
  // and its exported '__trap' function is not available, in which case we throw
  // a RuntimeError.
  // We trap instead of throwing RuntimeError to prevent infinite-looping in
  // Wasm EH code (because RuntimeError is considered as a foreign exception and
  // caught by 'catch_all'), but in case throwing RuntimeError is fine because
  // the module has not even been instantiated, even less running.
  if (runtimeInitialized) {
    ___trap();
  }
  throw new WebAssembly.RuntimeError(what);
}

var wasmBinaryFile;

function findWasmBinary() {
  return locateFile("liberty.wasm");
}

function getBinarySync(file) {
  if (readBinary) {
    return readBinary(file);
  }
  // Throwing a plain string here, even though it not normally advisable since
  // this gets turning into an `abort` in instantiateArrayBuffer.
  throw "both async and sync fetching of the wasm failed";
}

async function getWasmBinary(binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {}
  }
  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary) {
    try {
      var response = fetch(binaryFile, {
        credentials: "same-origin"
      });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err("falling back to ArrayBuffer instantiation");
    }
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  assignWasmImports();
  // prepare imports
  var imports = {
    "a": wasmImports
  };
  return imports;
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  function receiveInstance(instance, module) {
    wasmExports = instance.exports;
    wasmExports = applySignatureConversions(wasmExports);
    registerTLSInit(wasmExports["Be"]);
    assignWasmExports(wasmExports);
    // We now have the Wasm module loaded up, keep a reference to the compiled module so we can post it to the workers.
    wasmModule = module;
    return wasmExports;
  }
  // Prefer streaming instantiation if available.
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    return receiveInstance(result["instance"], result["module"]);
  }
  var info = getWasmImports();
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  var instantiateWasm = Module["instantiateWasm"];
  if (instantiateWasm) {
    return new Promise(resolve => {
      instantiateWasm(info, (inst, mod) => resolve(receiveInstance(inst, mod)));
    });
  }
  if ((ENVIRONMENT_IS_PTHREAD)) {
    // Instantiate from the module that was received via postMessage from
    // the main thread. We can just use sync instantiation in the worker.
    var instance = new WebAssembly.Instance(wasmModule, getWasmImports());
    return receiveInstance(instance, wasmModule);
  }
  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  var exports = receiveInstantiationResult(result);
  return exports;
}

// end include: preamble.js
// Begin JS library code
class ExitStatus {
  name="ExitStatus";
  constructor(status) {
    this.message = `Program terminated with exit(${status})`;
    this.status = status;
  }
}

/** @type {!Int8Array} */ var HEAP8;

var terminateWorker = worker => {
  worker.terminate();
  // terminate() can be asynchronous, so in theory the worker can continue
  // to run for some amount of time after termination.  However from our POV
  // the worker is now dead and we don't want to hear from it again, so we stub
  // out its message handler here.  This avoids having to check in each of
  // the onmessage handlers if the message was coming from a valid worker.
  worker.onmessage = e => {};
};

var cleanupThread = pthread_ptr => {
  var worker = PThread.pthreads[pthread_ptr];
  PThread.returnWorkerToPool(worker);
};

var callRuntimeCallbacks = callbacks => {
  while (callbacks.length > 0) {
    // Pass the module as the first argument.
    callbacks.shift()(Module);
  }
};

var onPreRuns = [];

var addOnPreRun = cb => onPreRuns.push(cb);

var dependenciesPromise = null;

var resolveRunDependencies = async () => dependenciesPromise;

var runDependencies = 0;

var dependenciesPromiseResolve = null;

var removeRunDependency = id => {
  runDependencies--;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (!runDependencies) {
    dependenciesPromiseResolve();
  }
};

var addRunDependency = id => {
  if (!runDependencies) {
    dependenciesPromise = new Promise(resolve => dependenciesPromiseResolve = resolve);
  }
  runDependencies++;
  Module["monitorRunDependencies"]?.(runDependencies);
};

var spawnThread = threadParams => {
  var worker = PThread.getNewWorker();
  if (!worker) {
    // No available workers in the PThread pool.
    return 6;
  }
  // Add to pthreads map
  PThread.pthreads[threadParams.pthread_ptr] = worker;
  worker.pthread_ptr = threadParams.pthread_ptr;
  var msg = {
    cmd: 2,
    start_routine: threadParams.startRoutine,
    arg: threadParams.arg,
    pthread_ptr: threadParams.pthread_ptr
  };
  // Note that we do not need to quote these names because they are only used
  // in this file, and not from the external worker.js.
  msg.moduleCanvasId = threadParams.moduleCanvasId;
  msg.offscreenCanvases = threadParams.offscreenCanvases;
  // Ask the worker to start executing its pthread entry point function.
  worker.postMessage(msg, threadParams.transferList);
  return 0;
};

var runtimeKeepaliveCounter = 0;

var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

var stackSave = () => _emscripten_stack_get_current();

var stackRestore = val => __emscripten_stack_restore(val);

var stackAlloc = sz => __emscripten_stack_alloc(sz);

/** @type {!Float64Array} */ var HEAPF64;

/** not-@type {!BigInt64Array} */ var HEAP64;

/** @type{function(number, (number|boolean), ...number)} */ var proxyToMainThread = (funcIndex, emAsmAddr, proxyMode, ...callArgs) => {
  // EM_ASM proxying is done by passing a pointer to the address of the EM_ASM
  // content as `emAsmAddr`.  JS library proxying is done by passing an index
  // into `proxiedJSCallArgs` as `funcIndex`. If `emAsmAddr` is non-zero then
  // `funcIndex` will be ignored.
  // Additional arguments are passed after the first three are the actual
  // function arguments.
  // The serialization buffer contains the number of call params, and then
  // all the args here.
  // We also pass 'proxyMode' to C separately, since C needs to look at it.
  // Allocate a buffer (on the stack), which will be copied if necessary by
  // the C code.
  // First passed parameter specifies the number of arguments to the function.
  // When BigInt support is enabled, we must handle types in a more complex
  // way, detecting at runtime if a value is a BigInt or not (as we have no
  // type info here). To do that, add a "prefix" before each value that
  // indicates if it is a BigInt, which effectively doubles the number of
  // values we serialize for proxying. TODO: pack this?
  var bufSize = 8 * callArgs.length * 2;
  var sp = stackSave();
  var args = stackAlloc(bufSize);
  var b = ((args) / 8);
  for (var arg of callArgs) {
    if (typeof arg === "bigint") {
      // The prefix is non-zero to indicate a bigint.
      (growMemViews(), HEAP64)[b++] = 1n;
      (growMemViews(), HEAP64)[b++] = arg;
    } else {
      // The prefix is zero to indicate a JS Number.
      (growMemViews(), HEAP64)[b++] = 0n;
      (growMemViews(), HEAPF64)[b++] = arg;
    }
  }
  var rtn = __emscripten_run_js_on_main_thread(funcIndex, emAsmAddr, bufSize, args, proxyMode);
  stackRestore(sp);
  return rtn;
};

function _proc_exit(code) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(0, 0, 1, code);
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    PThread.terminateAllThreads();
    Module["onExit"]?.(code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
}

var runtimeKeepalivePop = () => {
  runtimeKeepaliveCounter -= 1;
};

function exitOnMainThread(returnCode) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(1, 0, 0, returnCode);
  runtimeKeepalivePop();
  _exit(returnCode);
}

/** @param {boolean|number=} implicit */ var exitJS = (status, implicit) => {
  EXITSTATUS = status;
  if (ENVIRONMENT_IS_PTHREAD) {
    // implicit exit can never happen on a pthread
    // When running in a pthread we propagate the exit back to the main thread
    // where it can decide if the whole process should be shut down or not.
    // The pthread may have decided not to exit its own runtime, for example
    // because it runs a main loop, but that doesn't affect the main thread.
    exitOnMainThread(status);
    throw "unwind";
  }
  if (!keepRuntimeAlive()) {
    exitRuntime();
  }
  _proc_exit(status);
};

var _exit = exitJS;

var waitAsyncPolyfilled = (!Atomics.waitAsync || (globalThis.navigator?.userAgent && Number((navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./) || [])[2]) < 91));

/** @type {!Int32Array} */ var HEAP32;

var PThread = {
  unusedWorkers: [],
  tlsInitFunctions: [],
  pthreads: {},
  init() {
    if ((!(ENVIRONMENT_IS_PTHREAD))) {
      PThread.initMainThread();
    }
  },
  initMainThread() {
    var pthreadPoolSize = 24;
    // Start loading up the Worker pool, if requested.
    while (pthreadPoolSize--) {
      PThread.allocateUnusedWorker();
    }
    // MINIMAL_RUNTIME takes care of calling loadWasmModuleToAllWorkers
    // in postamble_minimal.js
    addOnPreRun(async () => {
      var pthreadPoolReady = PThread.loadWasmModuleToAllWorkers();
      addRunDependency("loading-workers");
      await pthreadPoolReady;
      removeRunDependency("loading-workers");
    });
  },
  terminateAllThreads: () => {
    // Attempt to kill all workers.  Sadly (at least on the web) there is no
    // way to terminate a worker synchronously, or to be notified when a
    // worker is actually terminated.  This means there is some risk that
    // pthreads will continue to be executing after `worker.terminate` has
    // returned.  For this reason, we don't call `returnWorkerToPool` here or
    // free the underlying pthread data structures.
    for (var worker of Object.values(PThread.pthreads)) {
      terminateWorker(worker);
    }
    for (var worker of PThread.unusedWorkers) {
      terminateWorker(worker);
    }
    PThread.unusedWorkers = [];
    PThread.pthreads = {};
  },
  clearMailboxAwait: pthread_ptr => {
    if (!waitAsyncPolyfilled) {
      Atomics.notify((growMemViews(), HEAP32), ((pthread_ptr) / 4));
    }
  },
  terminateRuntime: () => {
    PThread.terminateAllThreads();
    var pthread_ptr = _pthread_self();
    ___set_thread_state(0, 0, 0, 1);
    PThread.clearMailboxAwait(pthread_ptr);
  },
  returnWorkerToPool: worker => {
    // We don't want to run main thread queued calls here, since we are doing
    // some operations that leave the worker queue in an invalid state until
    // we are completely done (it would be bad if free() ends up calling a
    // queued pthread_create which looks at the global data structures we are
    // modifying). To achieve that, defer the free() until the very end, when
    // we are all done.
    var pthread_ptr = worker.pthread_ptr;
    delete PThread.pthreads[pthread_ptr];
    // Note: worker is intentionally not terminated so the pool can
    // dynamically grow.
    PThread.unusedWorkers.push(worker);
    // Not a running Worker anymore
    // Detach the worker from the pthread object, and return it to the
    // worker pool as an unused worker.
    worker.pthread_ptr = 0;
    // Clear any pending waitAsync waiter armed on this thread's struct
    // BEFORE freeing the memory so that memory recycled by malloc in another
    // thread will not have a window where a stale async waiter is still active.
    PThread.clearMailboxAwait(pthread_ptr);
    // Finally, free the underlying (and now-unused) pthread structure in
    // linear memory.
    __emscripten_thread_free_data(pthread_ptr);
  },
  receiveOffscreenCanvases(data) {
    if (typeof GL !== "undefined") {
      Object.assign(GL.offscreenCanvases, data.offscreenCanvases);
      if (!Module["canvas"] && data.moduleCanvasId && GL.offscreenCanvases[data.moduleCanvasId]) {
        Module["canvas"] = GL.offscreenCanvases[data.moduleCanvasId].offscreenCanvas;
        Module["canvas"].id = data.moduleCanvasId;
      }
    }
  },
  threadInitTLS() {
    // Call thread init functions (these are the _emscripten_tls_init for each
    // module loaded.
    PThread.tlsInitFunctions.forEach(f => f());
  },
  loadWasmModuleToWorker: worker => new Promise(onFinishedLoading => {
    worker.onmessage = e => {
      var d = e.data;
      var cmd = d.cmd;
      // If this message is intended to a recipient that is not the main
      // thread, forward it to the target thread. This is currently only
      // used by `CMD_CHECK_MAILBOX`.
      if (d.targetThread && d.targetThread != _pthread_self()) {
        var targetWorker = PThread.pthreads[d.targetThread];
        targetWorker?.postMessage(d);
        return;
      }
      if (d === "setimmediate" || d === "_si") {
        // Worker wants to postMessage() to itself to implement setImmediate()
        // emulation.
        worker.postMessage(d);
        return;
      }
      switch (cmd) {
       case 4:
        checkMailbox();
        break;

       case 5:
        spawnThread(d);
        break;

       case 6:
        // cleanupThread needs to be run via callUserCallback since it calls
        // back into user code to free thread data. Without this it's possible
        // the unwind or ExitStatus exception could escape here.
        callUserCallback(() => cleanupThread(d.thread));
        break;

       case 3:
        onFinishedLoading(worker);
        break;

       case 9:
        Module[d.handler](...d.args);
        break;

       default:
        // The received message looks like something that should be handled by this message
        // handler, (since there is a e.data.cmd field present), but is not one of the
        // recognized commands:
        if (cmd) err(`worker sent an unknown command ${cmd}`);
      }
    };
    worker.onerror = e => {
      var message = "worker sent an error!";
      err(`${message} ${e.filename}:${e.lineno}: ${e.message}`);
      throw e;
    };
    // When running on a pthread, none of the incoming parameters on the module
    // object are present. Proxy known handlers back to the main thread if specified.
    var handlers = [];
    var knownHandlers = [ "onExit", "onAbort", "print", "printErr" ];
    for (var handler of knownHandlers) {
      if (Module.propertyIsEnumerable(handler)) {
        handlers.push(handler);
      }
    }
    // Ask the new worker to load up the Emscripten-compiled page. This is a heavy operation.
    worker.postMessage({
      cmd: 1,
      handlers,
      wasmMemory,
      wasmModule
    });
  }),
  async loadWasmModuleToAllWorkers() {
    // Instantiation is synchronous in pthreads.
    if (ENVIRONMENT_IS_PTHREAD) {
      return;
    }
    let pthreadPoolReady = Promise.all(PThread.unusedWorkers.map(PThread.loadWasmModuleToWorker));
    return pthreadPoolReady;
  },
  allocateUnusedWorker() {
    var worker;
    var pthreadMainJs = _scriptName;
    worker = new Worker(pthreadMainJs, {
      // This is the way that we signal to the Web Worker that it is hosting
      // a pthread.
      "name": "em-pthread"
    });
    PThread.unusedWorkers.push(worker);
    return worker;
  },
  getNewWorker() {
    if (PThread.unusedWorkers.length == 0) {
      // PTHREAD_POOL_SIZE_STRICT should show a warning and, if set to level `2`, return from the function.
      var newWorker = PThread.allocateUnusedWorker();
      PThread.loadWasmModuleToWorker(newWorker);
    }
    return PThread.unusedWorkers.pop();
  }
};

var onPostRuns = [];

/** not-@type {!BigUint64Array} */ var HEAPU64;

function establishStackSpace(pthread_ptr) {
  var stackHigh = Number((growMemViews(), HEAPU64)[(((pthread_ptr) + (80)) / 8)]);
  var stackSize = Number((growMemViews(), HEAPU64)[(((pthread_ptr) + (88)) / 8)]);
  var stackLow = stackHigh - stackSize;
  // Set stack limits used by `emscripten/stack.h` function.  These limits are
  // cached in wasm-side globals to make checks as fast as possible.
  _emscripten_stack_set_limits(stackHigh, stackLow);
  // Call inside wasm module to set up the stack frame for this pthread in wasm module scope
  stackRestore(stackHigh);
}

var wasmTableMirror = [];

var getWasmTableEntry = funcPtr => {
  // Function pointers should show up as numbers, even under wasm64, but
  // we still have some places where bigint values can flow here.
  // https://github.com/emscripten-core/emscripten/issues/18200
  funcPtr = Number(funcPtr);
  var func = wasmTableMirror[funcPtr];
  if (!func) {
    /** @suppress {checkTypes} */ wasmTableMirror[funcPtr] = func = wasmTable.get(BigInt(funcPtr));
  }
  return func;
};

var invokeEntryPoint = (ptr, arg) => {
  // An old thread on this worker may have been canceled without returning the
  // `runtimeKeepaliveCounter` to zero. Reset it now so the new thread won't
  // be affected.
  runtimeKeepaliveCounter = 0;
  // Same for noExitRuntime.  The default for pthreads should always be false
  // otherwise pthreads would never complete and attempts to pthread_join to
  // them would block forever.
  // pthreads can still choose to set `noExitRuntime` explicitly, or
  // call emscripten_unwind_to_js_event_loop to extend their lifetime beyond
  // their main function.  See comment in src/runtime_pthread.js for more.
  noExitRuntime = 0;
  // pthread entry points are always of signature 'void *ThreadMain(void *arg)'
  // Native codebases sometimes spawn threads with other thread entry point
  // signatures, such as void ThreadMain(void *arg), void *ThreadMain(), or
  // void ThreadMain().  That is not acceptable per C/C++ specification, but
  // x86 compiler ABI extensions enable that to work. If you find the
  // following line to crash, either change the signature to "proper" void
  // *ThreadMain(void *arg) form, or try linking with the Emscripten linker
  // flag -sEMULATE_FUNCTION_POINTER_CASTS to add in emulation for this x86
  // ABI extension.
  var result = ((a1 => Number(getWasmTableEntry(ptr).call(null, BigInt(a1)))))(arg);
  function finish(result) {
    // In MINIMAL_RUNTIME the noExitRuntime concept does not apply to
    // pthreads. To exit a pthread with live runtime, use the function
    // emscripten_unwind_to_js_event_loop() in the pthread body.
    if (keepRuntimeAlive()) {
      EXITSTATUS = result;
      return;
    }
    __emscripten_thread_exit(result);
  }
  finish(result);
};

var noExitRuntime = false;

var registerTLSInit = tlsInitFunc => PThread.tlsInitFunctions.push(tlsInitFunc);

var runtimeKeepalivePush = () => {
  runtimeKeepaliveCounter += 1;
};

var wasmMemory;

var INT53_MAX = 9007199254740992;

var INT53_MIN = -9007199254740992;

var bigintToI53Checked = num => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);

var UTF8Decoder = globalThis.TextDecoder && new TextDecoder;

/**
   * heapOrArray is either a regular array, or a JavaScript typed array view.
   * @param {number} idx
   * @param {number=} maxBytesToRead
   * @param {boolean=} ignoreNul
   * @return {number}
   */ var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
  var maxIdx = idx + maxBytesToRead;
  if (ignoreNul) return maxIdx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on
  // null terminator by itself.
  // As a tiny code save trick, compare idx against maxIdx using a negation,
  // so that maxBytesToRead=undefined/NaN means Infinity.
  while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
  return idx;
};

/**
   * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
   * array that contains uint8 values, returns a copy of that string as a
   * Javascript String object.
   * heapOrArray is either a regular array, or a JavaScript typed array view.
   * @param {number=} idx
   * @param {number=} maxBytesToRead
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */ var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
  // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.buffer instanceof ArrayBuffer ? heapOrArray.subarray(idx, endPtr) : heapOrArray.slice(idx, endPtr));
  }
  var str = "";
  while (idx < endPtr) {
    // For UTF8 byte structure, see:
    // http://en.wikipedia.org/wiki/UTF-8#Description
    // https://www.ietf.org/rfc/rfc2279.txt
    // https://tools.ietf.org/html/rfc3629
    var u0 = heapOrArray[idx++];
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue;
    }
    var u1 = heapOrArray[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    var u2 = heapOrArray[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
};

/** @type {!Uint8Array} */ var HEAPU8;

/**
   * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
   * emscripten HEAP, returns a copy of that string as a Javascript String object.
   *
   * @param {number} ptr
   * @param {number=} maxBytesToRead - An optional length that specifies the
   *   maximum number of bytes to read. You can omit this parameter to scan the
   *   string until the first 0 byte. If maxBytesToRead is passed, and the string
   *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
   *   string will cut short at that byte index.
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */ var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => ptr ? UTF8ArrayToString((growMemViews(), 
HEAPU8), ptr, maxBytesToRead, ignoreNul) : "";

function ___assert_fail(condition, filename, line, func) {
  condition = bigintToI53Checked(condition);
  filename = bigintToI53Checked(filename);
  func = bigintToI53Checked(func);
  return abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [ filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function" ]);
}

function ___call_sighandler(fp, sig) {
  fp = bigintToI53Checked(fp);
  return getWasmTableEntry(fp)(sig);
}

function pthreadCreateProxied(pthread_ptr, attr, startRoutine, arg) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(2, 0, 1, pthread_ptr, attr, startRoutine, arg);
  return ___pthread_create_js(pthread_ptr, attr, startRoutine, arg);
}

var _emscripten_has_threading_support = () => !!globalThis.SharedArrayBuffer;

function ___pthread_create_js(pthread_ptr, attr, startRoutine, arg) {
  pthread_ptr = bigintToI53Checked(pthread_ptr);
  attr = bigintToI53Checked(attr);
  startRoutine = bigintToI53Checked(startRoutine);
  arg = bigintToI53Checked(arg);
  if (!_emscripten_has_threading_support()) {
    return 6;
  }
  // List of JS objects that will transfer ownership to the Worker hosting the thread
  var transferList = [];
  var error = 0;
  // Deduce which WebGL canvases (HTMLCanvasElements or OffscreenCanvases) should be passed over to the
  // Worker that hosts the spawned pthread.
  // Comma-delimited list of CSS selectors that must identify canvases by IDs: "#canvas1, #canvas2, ..."
  var transferredCanvasNames = attr ? Number((growMemViews(), HEAPU64)[(((attr) + (80)) / 8)]) : 0;
  // Proxied canvases string pointer -1/MAX_PTR is used as a special token to
  // fetch whatever canvases were passed to build in
  // -sOFFSCREENCANVASES_TO_PTHREAD= command line.
  if (transferredCanvasNames == 0x10000000000000000) {
    transferredCanvasNames = "#canvas";
  } else {
    transferredCanvasNames = UTF8ToString(transferredCanvasNames).trim();
  }
  transferredCanvasNames = transferredCanvasNames ? transferredCanvasNames.split(",") : [];
  var offscreenCanvases = {};
  // Dictionary of OffscreenCanvas objects we'll transfer to the created thread to own
  var moduleCanvasId = Module["canvas"]?.id ?? "";
  // Note that transferredCanvasNames might be null (so we cannot do a for-of loop).
  for (var name of transferredCanvasNames) {
    name = name.trim();
    var offscreenCanvasInfo;
    try {
      if (name == "#canvas") {
        if (!Module["canvas"]) {
          err(`pthread_create: could not find canvas with ID "${name}" to transfer to thread!`);
          error = 28;
          break;
        }
        name = Module["canvas"].id;
      }
      if (GL.offscreenCanvases[name]) {
        offscreenCanvasInfo = GL.offscreenCanvases[name];
        GL.offscreenCanvases[name] = null;
        // This thread no longer owns this canvas.
        if (Module["canvas"] instanceof OffscreenCanvas && name === Module["canvas"].id) Module["canvas"] = null;
      } else if (!ENVIRONMENT_IS_PTHREAD) {
        var canvas = (Module["canvas"] && Module["canvas"].id === name) ? Module["canvas"] : document.querySelector(name);
        if (!canvas) {
          err(`pthread_create: could not find canvas with ID "${name}" to transfer to thread!`);
          error = 28;
          break;
        }
        if (canvas.controlTransferredOffscreen) {
          err(`pthread_create: cannot transfer canvas with ID "${name}" to thread, since the current thread does not have control over it!`);
          error = 63;
          // Operation not permitted, some other thread is accessing the canvas.
          break;
        }
        if (canvas.transferControlToOffscreen) {
          // Create a shared information block in heap so that we can control
          // the canvas size from any thread.
          if (!canvas.canvasSharedPtr) {
            canvas.canvasSharedPtr = _malloc(16);
            (growMemViews(), HEAP32)[((canvas.canvasSharedPtr) / 4)] = canvas.width;
            (growMemViews(), HEAP32)[(((canvas.canvasSharedPtr) + (4)) / 4)] = canvas.height;
            (growMemViews(), HEAPU64)[(((canvas.canvasSharedPtr) + (8)) / 8)] = 0n;
          }
          offscreenCanvasInfo = {
            offscreenCanvas: canvas.transferControlToOffscreen(),
            canvasSharedPtr: canvas.canvasSharedPtr,
            id: canvas.id
          };
          // After calling canvas.transferControlToOffscreen(), it is no
          // longer possible to access certain operations on the canvas, such
          // as resizing it or obtaining GL contexts via it.
          // Use this field to remember that we have permanently converted
          // this Canvas to be controlled via an OffscreenCanvas (there is no
          // way to undo this in the spec)
          canvas.controlTransferredOffscreen = true;
        } else {
          err(`pthread_create: cannot transfer control of canvas "${name}" to pthread, because current browser does not support OffscreenCanvas!`);
          // If building with OFFSCREEN_FRAMEBUFFER=1 mode, we don't need to
          // be able to transfer control to offscreen, but WebGL can be
          // proxied from worker to main thread.
          err("pthread_create: Build with -sOFFSCREEN_FRAMEBUFFER to enable fallback proxying of GL commands from pthread to main thread.");
          return 52;
        }
      }
      if (offscreenCanvasInfo) {
        transferList.push(offscreenCanvasInfo.offscreenCanvas);
        offscreenCanvases[offscreenCanvasInfo.id] = offscreenCanvasInfo;
      }
    } catch (e) {
      err(`pthread_create: failed to transfer control of canvas "${name}" to OffscreenCanvas! Error: ${e}`);
      return 28;
    }
  }
  // Synchronously proxy the thread creation to main thread if possible. If we
  // need to transfer ownership of objects, then proxy asynchronously via
  // postMessage.
  if (ENVIRONMENT_IS_PTHREAD && (!transferList.length || error)) {
    return pthreadCreateProxied(pthread_ptr, attr, startRoutine, arg);
  }
  // If on the main thread, and accessing Canvas/OffscreenCanvas failed, abort
  // with the detected error.
  if (error) return error;
  // Register for each of the transferred canvases that the new thread now
  // owns the OffscreenCanvas.
  for (var canvas of Object.values(offscreenCanvases)) {
    // pthread ptr to the thread that owns this canvas.
    (growMemViews(), HEAPU64)[(((canvas.canvasSharedPtr) + (8)) / 8)] = BigInt(pthread_ptr);
  }
  var threadParams = {
    startRoutine,
    pthread_ptr,
    arg,
    moduleCanvasId,
    offscreenCanvases,
    transferList
  };
  if (ENVIRONMENT_IS_PTHREAD) {
    // The prepopulated pool of web workers that can host pthreads is stored
    // in the main JS thread. Therefore if a pthread is attempting to spawn a
    // new thread, the thread creation must be deferred to the main JS thread.
    threadParams.cmd = 5;
    postMessage(threadParams, transferList);
    // When we defer thread creation this way, we have no way to detect thread
    // creation synchronously today, so we have to assume success and return 0.
    return 0;
  }
  // We are the main thread, so we have the pthread warmup pool in this
  // thread and can fire off JS thread creation directly ourselves.
  return spawnThread(threadParams);
}

var ___syscall_getuid32 = () => 0;

var __abort_js = () => abort("");

function __emscripten_init_main_thread_js(tb) {
  tb = bigintToI53Checked(tb);
  var can_block = !ENVIRONMENT_IS_WEB;
  // Feature detect whether the main thread can block.
  try {
    Atomics.wait((growMemViews(), HEAP32), 0, 0, 0);
    can_block = true;
  } catch (e) {}
  // Pass the thread address to the native code where they are stored in wasm
  // globals which act as a form of TLS. Global constructors trying
  // to access this value will read the wrong value, but that is UB anyway.
  __emscripten_thread_init(tb, /*is_main=*/ !ENVIRONMENT_IS_WORKER, /*is_runtime=*/ 1, can_block, /*default_stacksize=*/ 4194304, /*start_profiling=*/ false);
  PThread.threadInitTLS();
}

var jsStackTrace = () => (new Error).stack.toString();

/** @param {number=} flags */ var getCallstack = flags => {
  var callstack = jsStackTrace();
  // Process all lines:
  var lines = callstack.split("\n");
  callstack = "";
  // Extract components of form:
  // '       Object._main@http://server.com:4324:12'
  var firefoxRe = new RegExp("\\s*(.*?)@(.*?):([0-9]+):([0-9]+)");
  // Extract components of form:
  // '    at Object._main (http://server.com/file.html:4324:12)'
  var chromeRe = new RegExp("\\s*at (.*?) \\((.*):(.*):(.*)\\)");
  for (var line of lines) {
    var symbolName = "";
    var file = "";
    var lineno = 0;
    var column = 0;
    var parts = chromeRe.exec(line);
    if (parts?.length == 5) {
      symbolName = parts[1];
      file = parts[2];
      lineno = parts[3];
      column = parts[4];
    } else {
      parts = firefoxRe.exec(line);
      if (parts?.length >= 4) {
        symbolName = parts[1];
        file = parts[2];
        lineno = parts[3];
        // Old Firefox doesn't carry column information, but in new FF30, it
        // is present. See https://bugzil.la/762556
        column = parts[4] | 0;
      } else {
        // Was not able to extract this line for demangling/sourcemapping
        // purposes. Output it as-is.
        callstack += line + "\n";
        continue;
      }
    }
    // Find the symbols in the callstack that corresponds to the functions that
    // report callstack information, and remove everything up to these from the
    // output.
    if (symbolName == "_emscripten_log" || symbolName == "_emscripten_get_callstack") {
      callstack = "";
      continue;
    }
    if ((flags & 24)) {
      if (flags & 64) {
        file = file.substring(file.replace(/\\/g, "/").lastIndexOf("/") + 1);
      }
      callstack += `    at ${symbolName} (${file}:${lineno}:${column})\n`;
    }
  }
  // Trim extra whitespace at the end of the output.
  callstack = callstack.replace(/\s+$/, "");
  return callstack;
};

function __emscripten_log_formatted(flags, str) {
  str = bigintToI53Checked(str);
  str = UTF8ToString(str);
  if (flags & 24) {
    str = str.replace(/\s+$/, "");
    // Ensure the message and the callstack are joined cleanly with exactly one newline.
    str += (str.length > 0 ? "\n" : "") + getCallstack(flags);
  }
  if (flags & 1) {
    if (flags & 4) {
      console.error(str);
    } else if (flags & 2) {
      console.warn(str);
    } else if (flags & 512) {
      console.info(str);
    } else if (flags & 256) {
      console.debug(str);
    } else {
      console.log(str);
    }
  } else if (flags & 6) {
    err(str);
  } else {
    out(str);
  }
}

var handleException = e => {
  // Certain exception types we do not treat as errors since they are used for
  // internal control flow.
  // 1. ExitStatus, which is thrown by exit()
  // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
  //    that wish to return to JS event loop.
  if (e instanceof ExitStatus || e == "unwind") {
    return EXITSTATUS;
  }
  quit_(1, e);
};

var maybeExit = () => {
  if (runtimeExited) {
    return;
  }
  if (!keepRuntimeAlive()) {
    try {
      if (ENVIRONMENT_IS_PTHREAD) {
        // exit the current thread, but only if there is one active.
        // TODO(https://github.com/emscripten-core/emscripten/issues/25076):
        // Unify this check with the runtimeExited check above
        if (_pthread_self()) __emscripten_thread_exit(EXITSTATUS);
        return;
      }
      _exit(EXITSTATUS);
    } catch (e) {
      handleException(e);
    }
  }
};

var callUserCallback = (func, ...args) => {
  if (runtimeExited || ABORT) {
    return;
  }
  try {
    return func(...args);
  } catch (e) {
    handleException(e);
  } finally {
    maybeExit();
  }
};

function __emscripten_thread_mailbox_await(pthread_ptr) {
  pthread_ptr = bigintToI53Checked(pthread_ptr);
  if (!waitAsyncPolyfilled) {
    // Wait on the pthread's initial self-pointer field because it is easy and
    // safe to access from sending threads that need to notify the waiting
    // thread.
    // Note: Under wasm64 only the low 32-bit of the pthread_ptr are
    // read/compared here, but we don't actually care about the exact values
    // here as long as they match.
    var wait = Atomics.waitAsync((growMemViews(), HEAP32), ((pthread_ptr) / 4), pthread_ptr);
    wait.value.then(checkMailbox);
    var waitingAsync = pthread_ptr + 204;
    Atomics.store((growMemViews(), HEAP32), ((waitingAsync) / 4), 1);
  }
}

var checkMailbox = () => {
  // checkMailbox can be called after the pthread has shut down. See
  // Pthread.terminateRuntime().
  // In this case we return silently without re-registering using waitAsync.
  // Perhaps there is a more universal way we can detect runtime has exited.
  // TODO(https://github.com/emscripten-core/emscripten/issues/25076)
  var pthread_ptr = _pthread_self();
  if (!pthread_ptr) return;
  callUserCallback(() => {
    // If we are using Atomics.waitAsync as our notification mechanism, wait
    // for a notification before processing the mailbox to avoid missing any
    // work that could otherwise arrive after we've finished processing the
    // mailbox and before we're ready for the next notification.
    __emscripten_thread_mailbox_await(pthread_ptr);
    __emscripten_check_mailbox();
  });
};

function __emscripten_notify_mailbox_postmessage(targetThread, currThreadId) {
  targetThread = bigintToI53Checked(targetThread);
  currThreadId = bigintToI53Checked(currThreadId);
  if (targetThread == currThreadId) {
    setTimeout(checkMailbox);
  } else if (ENVIRONMENT_IS_PTHREAD) {
    postMessage({
      targetThread,
      cmd: 4
    });
  } else {
    var worker = PThread.pthreads[targetThread];
    if (!worker) {
      return;
    }
    worker.postMessage({
      cmd: 4
    });
  }
}

var proxiedJSCallArgs = [];

function __emscripten_receive_on_main_thread_js(funcIndex, emAsmAddr, callingThread, bufSize, args, ctx, ctxArgs) {
  emAsmAddr = bigintToI53Checked(emAsmAddr);
  callingThread = bigintToI53Checked(callingThread);
  args = bigintToI53Checked(args);
  ctx = bigintToI53Checked(ctx);
  ctxArgs = bigintToI53Checked(ctxArgs);
  // Sometimes we need to backproxy events to the calling thread (e.g.
  // HTML5 DOM events handlers such as
  // emscripten_set_mousemove_callback()), so keep track in a globally
  // accessible variable about the thread that initiated the proxying.
  proxiedJSCallArgs.length = 0;
  var b = ((args) / 8);
  var end = ((args + bufSize) / 8);
  while (b < end) {
    var arg;
    if ((growMemViews(), HEAP64)[b++]) {
      // It's a BigInt.
      arg = (growMemViews(), HEAP64)[b++];
    } else {
      // It's a Number.
      arg = (growMemViews(), HEAPF64)[b++];
    }
    proxiedJSCallArgs.push(arg);
  }
  // Proxied JS library funcs use funcIndex and EM_ASM functions use emAsmAddr
  var func = emAsmAddr ? ASM_CONSTS[emAsmAddr] : proxiedFunctionTable[funcIndex];
  PThread.currentProxiedOperationCallerThread = callingThread;
  var rtn = func(...proxiedJSCallArgs);
  PThread.currentProxiedOperationCallerThread = 0;
  if (ctx) {
    // A PROXY_SYNC_ASYNC function may complete synchronously with a plain value.
    Promise.resolve(rtn).then(rtn => __emscripten_run_js_on_main_thread_done(ctx, ctxArgs, rtn));
    return;
  }
  // In memory64 mode some proxied functions return bigint/pointer but
  // our return type is i53/double.
  if (typeof rtn === "bigint") {
    rtn = bigintToI53Checked(rtn);
  }
  return rtn;
}

var __emscripten_runtime_keepalive_clear = () => {
  noExitRuntime = false;
  runtimeKeepaliveCounter = 0;
};

function __emscripten_thread_cleanup(thread) {
  thread = bigintToI53Checked(thread);
  // Called when a thread needs to be cleaned up so it can be reused.
  // A thread is considered reusable when it either returns from its
  // entry point, calls pthread_exit, or acts upon a cancellation.
  // Detached threads are responsible for calling this themselves,
  // otherwise pthread_join is responsible for calling this.
  if (!ENVIRONMENT_IS_PTHREAD) cleanupThread(thread); else postMessage({
    cmd: 6,
    thread
  });
}

function __emscripten_thread_set_strongref(thread) {
  thread = bigintToI53Checked(thread);
}

function __gmtime_js(time, tmPtr) {
  time = bigintToI53Checked(time);
  tmPtr = bigintToI53Checked(tmPtr);
  var date = new Date(time * 1e3);
  if (isNaN(date.getTime())) {
    return 1;
  }
  (growMemViews(), HEAP32)[((tmPtr) / 4)] = date.getUTCSeconds();
  (growMemViews(), HEAP32)[(((tmPtr) + (4)) / 4)] = date.getUTCMinutes();
  (growMemViews(), HEAP32)[(((tmPtr) + (8)) / 4)] = date.getUTCHours();
  (growMemViews(), HEAP32)[(((tmPtr) + (12)) / 4)] = date.getUTCDate();
  (growMemViews(), HEAP32)[(((tmPtr) + (16)) / 4)] = date.getUTCMonth();
  (growMemViews(), HEAP32)[(((tmPtr) + (20)) / 4)] = date.getUTCFullYear() - 1900;
  (growMemViews(), HEAP32)[(((tmPtr) + (24)) / 4)] = date.getUTCDay();
  var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  var yday = ((date.getTime() - start) / (1e3 * 60 * 60 * 24)) | 0;
  (growMemViews(), HEAP32)[(((tmPtr) + (28)) / 4)] = yday;
  return 0;
}

var isLeapYear = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

var MONTH_DAYS_LEAP_CUMULATIVE = [ 0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335 ];

var MONTH_DAYS_REGULAR_CUMULATIVE = [ 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334 ];

var ydayFromDate = date => {
  var leap = isLeapYear(date.getFullYear());
  var monthDaysCumulative = (leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE);
  var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1;
  // -1 since it's days since Jan 1
  return yday;
};

function __localtime_js(time, tmPtr) {
  time = bigintToI53Checked(time);
  tmPtr = bigintToI53Checked(tmPtr);
  var date = new Date(time * 1e3);
  if (isNaN(date.getTime())) {
    return 1;
  }
  (growMemViews(), HEAP32)[((tmPtr) / 4)] = date.getSeconds();
  (growMemViews(), HEAP32)[(((tmPtr) + (4)) / 4)] = date.getMinutes();
  (growMemViews(), HEAP32)[(((tmPtr) + (8)) / 4)] = date.getHours();
  (growMemViews(), HEAP32)[(((tmPtr) + (12)) / 4)] = date.getDate();
  (growMemViews(), HEAP32)[(((tmPtr) + (16)) / 4)] = date.getMonth();
  (growMemViews(), HEAP32)[(((tmPtr) + (20)) / 4)] = date.getFullYear() - 1900;
  (growMemViews(), HEAP32)[(((tmPtr) + (24)) / 4)] = date.getDay();
  var yday = ydayFromDate(date) | 0;
  (growMemViews(), HEAP32)[(((tmPtr) + (28)) / 4)] = yday;
  (growMemViews(), HEAP64)[(((tmPtr) + (40)) / 8)] = BigInt(-(date.getTimezoneOffset() * 60));
  // Attention: DST is in December in South, and some regions don't have DST at all.
  var start = new Date(date.getFullYear(), 0, 1);
  var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  var winterOffset = start.getTimezoneOffset();
  var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
  (growMemViews(), HEAP32)[(((tmPtr) + (32)) / 4)] = dst;
  return 0;
}

var __timegm_js = function(tmPtr) {
  tmPtr = bigintToI53Checked(tmPtr);
  var ret = ((() => {
    var time = Date.UTC((growMemViews(), HEAP32)[(((tmPtr) + (20)) / 4)] + 1900, (growMemViews(), 
    HEAP32)[(((tmPtr) + (16)) / 4)], (growMemViews(), HEAP32)[(((tmPtr) + (12)) / 4)], (growMemViews(), 
    HEAP32)[(((tmPtr) + (8)) / 4)], (growMemViews(), HEAP32)[(((tmPtr) + (4)) / 4)], (growMemViews(), 
    HEAP32)[((tmPtr) / 4)], 0);
    var date = new Date(time);
    if (isNaN(date.getTime())) {
      return -1;
    }
    (growMemViews(), HEAP32)[(((tmPtr) + (24)) / 4)] = date.getUTCDay();
    var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
    var yday = ((date.getTime() - start) / (1e3 * 60 * 60 * 24)) | 0;
    (growMemViews(), HEAP32)[(((tmPtr) + (28)) / 4)] = yday;
    return date.getTime() / 1e3;
  }))();
  return BigInt(ret);
};

var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
  // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
  // undefined and false each don't write out any bytes.
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
    // and https://www.ietf.org/rfc/rfc2279.txt
    // and https://tools.ietf.org/html/rfc3629
    var u = str.codePointAt(i);
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 192 | (u >> 6);
      heap[outIdx++] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 224 | (u >> 12);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      heap[outIdx++] = 240 | (u >> 18);
      heap[outIdx++] = 128 | ((u >> 12) & 63);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
      // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
      // We need to manually skip over the second code unit for correct iteration.
      i++;
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
};

var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, (growMemViews(), 
HEAPU8), outPtr, maxBytesToWrite);

var __tzset_js = function(timezone, daylight, std_name, dst_name) {
  timezone = bigintToI53Checked(timezone);
  daylight = bigintToI53Checked(daylight);
  std_name = bigintToI53Checked(std_name);
  dst_name = bigintToI53Checked(dst_name);
  // TODO: Use (malleable) environment variables instead of system settings.
  var currentYear = (new Date).getFullYear();
  var winter = new Date(currentYear, 0, 1);
  var summer = new Date(currentYear, 6, 1);
  var winterOffset = winter.getTimezoneOffset();
  var summerOffset = summer.getTimezoneOffset();
  // Local standard timezone offset. Local standard time is not adjusted for
  // daylight savings.  This code uses the fact that getTimezoneOffset returns
  // a greater value during Standard Time versus Daylight Saving Time (DST).
  // Thus it determines the expected output during Standard Time, and it
  // compares whether the output of the given date the same (Standard) or less
  // (DST).
  var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
  // timezone is specified as seconds west of UTC ("The external variable
  // `timezone` shall be set to the difference, in seconds, between
  // Coordinated Universal Time (UTC) and local standard time."), the same
  // as returned by stdTimezoneOffset.
  // See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
  (growMemViews(), HEAPU64)[((timezone) / 8)] = BigInt(stdTimezoneOffset * 60);
  (growMemViews(), HEAP32)[((daylight) / 4)] = Number(winterOffset != summerOffset);
  var extractZone = timezoneOffset => {
    // Why inverse sign?
    // Read here https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
    var sign = timezoneOffset >= 0 ? "-" : "+";
    var absOffset = Math.abs(timezoneOffset);
    var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
    var minutes = String(absOffset % 60).padStart(2, "0");
    return `UTC${sign}${hours}${minutes}`;
  };
  var winterName = extractZone(winterOffset);
  var summerName = extractZone(summerOffset);
  if (summerOffset < winterOffset) {
    // Northern hemisphere
    stringToUTF8(winterName, std_name, 17);
    stringToUTF8(summerName, dst_name, 17);
  } else {
    stringToUTF8(winterName, dst_name, 17);
    stringToUTF8(summerName, std_name, 17);
  }
};

function __wasmfs_copy_preloaded_file_data(index, buffer) {
  buffer = bigintToI53Checked(buffer);
  return (growMemViews(), HEAPU8).set(wasmFSPreloadedFiles[index].fileData, buffer);
}

var wasmFSPreloadedDirs = [];

var __wasmfs_get_num_preloaded_dirs = () => wasmFSPreloadedDirs.length;

var wasmFSPreloadedFiles = [];

var wasmFSPreloadingFlushed = false;

var __wasmfs_get_num_preloaded_files = () => {
  // When this method is called from WasmFS it means that we are about to
  // flush all the preloaded data, so mark that. (There is no call that
  // occurs at the end of that flushing, which would be more natural, but it
  // is fine to mark the flushing here as during the flushing itself no user
  // code can run, so nothing will check whether we have flushed or not.)
  wasmFSPreloadingFlushed = true;
  return wasmFSPreloadedFiles.length;
};

function __wasmfs_get_preloaded_child_path(index, childNameBuffer) {
  childNameBuffer = bigintToI53Checked(childNameBuffer);
  var s = wasmFSPreloadedDirs[index].childName;
  var len = lengthBytesUTF8(s) + 1;
  stringToUTF8(s, childNameBuffer, len);
}

var __wasmfs_get_preloaded_file_mode = index => wasmFSPreloadedFiles[index].mode;

var __wasmfs_get_preloaded_file_size = index => BigInt(wasmFSPreloadedFiles[index].fileData.length);

function __wasmfs_get_preloaded_parent_path(index, parentPathBuffer) {
  parentPathBuffer = bigintToI53Checked(parentPathBuffer);
  var s = wasmFSPreloadedDirs[index].parentPath;
  var len = lengthBytesUTF8(s) + 1;
  stringToUTF8(s, parentPathBuffer, len);
}

var lengthBytesUTF8 = str => {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
    // unit, not a Unicode code point of the character! So decode
    // UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var c = str.charCodeAt(i);
    // possibly a lead surrogate
    if (c <= 127) {
      len++;
    } else if (c <= 2047) {
      len += 2;
    } else if (c >= 55296 && c <= 57343) {
      len += 4;
      ++i;
    } else {
      len += 3;
    }
  }
  return len;
};

function __wasmfs_get_preloaded_path_name(index, fileNameBuffer) {
  fileNameBuffer = bigintToI53Checked(fileNameBuffer);
  var s = wasmFSPreloadedFiles[index].pathName;
  var len = lengthBytesUTF8(s) + 1;
  stringToUTF8(s, fileNameBuffer, len);
}

function __wasmfs_jsimpl_alloc_file(backend, file) {
  backend = bigintToI53Checked(backend);
  file = bigintToI53Checked(file);
  return wasmFS$backends[backend].allocFile(file);
}

function __wasmfs_jsimpl_free_file(backend, file) {
  backend = bigintToI53Checked(backend);
  file = bigintToI53Checked(file);
  return wasmFS$backends[backend].freeFile(file);
}

function __wasmfs_jsimpl_get_size(backend, file) {
  backend = bigintToI53Checked(backend);
  file = bigintToI53Checked(file);
  return wasmFS$backends[backend].getSize(file);
}

function __wasmfs_jsimpl_read(backend, file, buffer, length, offset) {
  backend = bigintToI53Checked(backend);
  file = bigintToI53Checked(file);
  buffer = bigintToI53Checked(buffer);
  length = bigintToI53Checked(length);
  offset = bigintToI53Checked(offset);
  if (!wasmFS$backends[backend].read) {
    return -28;
  }
  return wasmFS$backends[backend].read(file, buffer, length, offset);
}

function __wasmfs_jsimpl_set_size(backend, file, size) {
  backend = bigintToI53Checked(backend);
  file = bigintToI53Checked(file);
  size = bigintToI53Checked(size);
  return wasmFS$backends[backend].setSize(file, size);
}

function __wasmfs_jsimpl_write(backend, file, buffer, length, offset) {
  backend = bigintToI53Checked(backend);
  file = bigintToI53Checked(file);
  buffer = bigintToI53Checked(buffer);
  length = bigintToI53Checked(length);
  offset = bigintToI53Checked(offset);
  if (!wasmFS$backends[backend].write) {
    return -28;
  }
  return wasmFS$backends[backend].write(file, buffer, length, offset);
}

var FS_stdin_getChar_buffer = [];

/** @type {function(string, boolean=, number=)} */ var intArrayFromString = (stringy, dontAddNull, length) => {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
};

var FS_stdin_getChar = () => {
  if (!FS_stdin_getChar_buffer.length) {
    var result = null;
    if (globalThis.window?.prompt) {
      // Browser.
      result = window.prompt("Input: ");
      // returns null on cancel
      if (result !== null) {
        result += "\n";
      }
    } else {}
    if (!result) {
      return null;
    }
    FS_stdin_getChar_buffer = intArrayFromString(result, true);
  }
  return FS_stdin_getChar_buffer.shift();
};

var __wasmfs_stdin_get_char = () => {
  // Return the read character, or -1 to indicate EOF.
  var c = FS_stdin_getChar();
  if (typeof c === "number") {
    return c;
  }
  return -1;
};

var _emscripten_get_now = () => performance.timeOrigin + performance.now();

var _emscripten_date_now = () => Date.now();

var nowIsMonotonic = 1;

var checkWasiClock = clock_id => clock_id >= 0 && clock_id <= 3;

function _clock_time_get(clk_id, ignored_precision, ptime) {
  ignored_precision = bigintToI53Checked(ignored_precision);
  ptime = bigintToI53Checked(ptime);
  if (!checkWasiClock(clk_id)) {
    return 28;
  }
  var now;
  // all wasi clocks but realtime are monotonic
  if (clk_id === 0) {
    now = _emscripten_date_now();
  } else if (nowIsMonotonic) {
    now = _emscripten_get_now();
  } else {
    return 52;
  }
  // "now" is in ms, and wasi times are in ns.
  var nsec = Math.round(now * 1e6);
  (growMemViews(), HEAP64)[((ptime) / 8)] = BigInt(nsec);
  return 0;
}

var readEmAsmArgsArray = [];

var readEmAsmArgs = (sigPtr, buf) => {
  readEmAsmArgsArray.length = 0;
  var ch;
  // Most arguments are i32s, so shift the buffer pointer so it is a plain
  // index into HEAP32.
  while (ch = (growMemViews(), HEAPU8)[sigPtr++]) {
    // Floats are always passed as doubles, so all types except for 'i'
    // are 8 bytes and require alignment.
    var wide = (ch != 105);
    buf += wide && (buf % 8) ? 4 : 0;
    readEmAsmArgsArray.push(// Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
    ch == 112 ? Number((growMemViews(), HEAPU64)[((buf) / 8)]) : ch == 106 ? (growMemViews(), 
    HEAP64)[((buf) / 8)] : ch == 105 ? (growMemViews(), HEAP32)[((buf) / 4)] : (growMemViews(), 
    HEAPF64)[((buf) / 8)]);
    buf += wide ? 8 : 4;
  }
  return readEmAsmArgsArray;
};

var runMainThreadEmAsm = (emAsmAddr, sigPtr, argbuf, sync) => {
  var args = readEmAsmArgs(sigPtr, argbuf);
  if (ENVIRONMENT_IS_PTHREAD) {
    // EM_ASM functions are variadic, receiving the actual arguments as a buffer
    // in memory. the last parameter (argBuf) points to that data. We need to
    // always un-variadify that, *before proxying*, as in the async case this
    // is a stack allocation that LLVM made, which may go away before the main
    // thread gets the message. For that reason we handle proxying *after* the
    // call to readEmAsmArgs, and therefore we do that manually here instead
    // of using __proxy. (And for simplicity, do the same in the sync
    // case as well, even though it's not strictly necessary, to keep the two
    // code paths as similar as possible on both sides.)
    return proxyToMainThread(0, emAsmAddr, sync, ...args);
  }
  return ASM_CONSTS[emAsmAddr](...args);
};

function _emscripten_asm_const_async_on_main_thread(emAsmAddr, sigPtr, argbuf) {
  emAsmAddr = bigintToI53Checked(emAsmAddr);
  sigPtr = bigintToI53Checked(sigPtr);
  argbuf = bigintToI53Checked(argbuf);
  return runMainThreadEmAsm(emAsmAddr, sigPtr, argbuf, 0);
}

function _emscripten_asm_const_int_sync_on_main_thread(emAsmAddr, sigPtr, argbuf) {
  emAsmAddr = bigintToI53Checked(emAsmAddr);
  sigPtr = bigintToI53Checked(sigPtr);
  argbuf = bigintToI53Checked(argbuf);
  return runMainThreadEmAsm(emAsmAddr, sigPtr, argbuf, 1);
}

function _emscripten_asm_const_double_sync_on_main_thread(a1, a2, a3) {
  a1 = bigintToI53Checked(a1);
  a2 = bigintToI53Checked(a2);
  a3 = bigintToI53Checked(a3);
  return _emscripten_asm_const_int_sync_on_main_thread(a1, a2, a3);
}

var runEmAsmFunction = (code, sigPtr, argbuf) => {
  var args = readEmAsmArgs(sigPtr, argbuf);
  return ASM_CONSTS[code](...args);
};

function _emscripten_asm_const_int(code, sigPtr, argbuf) {
  code = bigintToI53Checked(code);
  sigPtr = bigintToI53Checked(sigPtr);
  argbuf = bigintToI53Checked(argbuf);
  return runEmAsmFunction(code, sigPtr, argbuf);
}

var _emscripten_asm_const_ptr_sync_on_main_thread = (emAsmAddr, sigPtr, argbuf) => {
  emAsmAddr = bigintToI53Checked(emAsmAddr);
  sigPtr = bigintToI53Checked(sigPtr);
  argbuf = bigintToI53Checked(argbuf);
  return BigInt(runMainThreadEmAsm(emAsmAddr, sigPtr, argbuf, 1));
};

var _emscripten_check_blocking_allowed = () => {};

/** @param {number=} timeout */ var safeSetTimeout = (func, timeout) => {
  runtimeKeepalivePush();
  var id = safeSetTimeout.nextId++;
  safeSetTimeout.pending.set(id, setTimeout(() => {
    safeSetTimeout.pending.delete(id);
    runtimeKeepalivePop();
    callUserCallback(func);
  }, timeout));
  return id;
};

var safeClearTimeout = id => {
  var handle = safeSetTimeout.pending.get(id);
  if (!handle) return;
  safeSetTimeout.pending.delete(id);
  clearTimeout(handle);
  runtimeKeepalivePop();
};

var _emscripten_clear_timeout = safeClearTimeout;

function _emscripten_err(str) {
  str = bigintToI53Checked(str);
  return err(UTF8ToString(str));
}

var onExits = [];

var addOnExit = cb => onExits.push(cb);

var JSEvents = {
  removeAllEventListeners() {
    while (JSEvents.eventHandlers.length) {
      JSEvents._removeHandler(JSEvents.eventHandlers.length - 1);
    }
    JSEvents.deferredCalls = [];
  },
  registerRemoveEventListeners() {
    if (!JSEvents.removeEventListenersRegistered) {
      addOnExit(JSEvents.removeAllEventListeners);
      JSEvents.removeEventListenersRegistered = true;
    }
  },
  inEventHandler: 0,
  deferredCalls: [],
  deferCall(targetFunction, precedence, argsList) {
    function arraysHaveEqualContent(arrA, arrB) {
      if (arrA.length != arrB.length) return false;
      for (var i = 0; i < arrA.length; i++) {
        if (arrA[i] != arrB[i]) return false;
      }
      return true;
    }
    // Test if the given call was already queued, and if so, don't add it again.
    for (var call of JSEvents.deferredCalls) {
      if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
        return;
      }
    }
    JSEvents.deferredCalls.push({
      targetFunction,
      precedence,
      argsList
    });
    JSEvents.deferredCalls.sort((x, y) => x.precedence - y.precedence);
  },
  removeDeferredCalls(targetFunction) {
    JSEvents.deferredCalls = JSEvents.deferredCalls.filter(call => call.targetFunction != targetFunction);
  },
  canPerformEventHandlerRequests() {
    // Browsers that support navigator.userActivation.isActive: https://developer.mozilla.org/en-US/docs/Web/API/UserActivation/isActive
    // We are targeting modern browsers where navigator.userActivation.isActive is unconditionally supported.
    return navigator.userActivation.isActive;
  },
  runDeferredCalls() {
    if (!JSEvents.canPerformEventHandlerRequests()) {
      return;
    }
    var deferredCalls = JSEvents.deferredCalls;
    JSEvents.deferredCalls = [];
    for (var call of deferredCalls) {
      call.targetFunction(...call.argsList);
    }
  },
  eventHandlers: [],
  removeAllHandlersOnTarget: (target, eventTypeString) => {
    for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
      if (JSEvents.eventHandlers[i].target == target && (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
        JSEvents._removeHandler(i--);
      }
    }
  },
  _removeHandler(i) {
    var h = JSEvents.eventHandlers[i];
    h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
    JSEvents.eventHandlers.splice(i, 1);
  },
  registerOrRemoveHandler(eventHandler) {
    if (!eventHandler.target) {
      return -4;
    }
    if (eventHandler.callbackfunc) {
      eventHandler.eventListenerFunc = function(event) {
        // Increment nesting count for the event handler.
        ++JSEvents.inEventHandler;
        JSEvents.currentEventHandler = eventHandler;
        // Process any old deferred calls the user has placed.
        JSEvents.runDeferredCalls();
        // Process the actual event, calls back to user C code handler.
        eventHandler.handlerFunc(event);
        // Process any new deferred calls that were placed right now from this event handler.
        JSEvents.runDeferredCalls();
        // Out of event handler - restore nesting count.
        --JSEvents.inEventHandler;
      };
      eventHandler.target.addEventListener(eventHandler.eventTypeString, eventHandler.eventListenerFunc, eventHandler.useCapture);
      JSEvents.eventHandlers.push(eventHandler);
      JSEvents.registerRemoveEventListeners();
    } else {
      for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
        if (JSEvents.eventHandlers[i].target == eventHandler.target && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
          JSEvents._removeHandler(i--);
        }
      }
    }
    return 0;
  },
  removeSingleHandler(eventHandler) {
    let success = false;
    for (let i = 0; i < JSEvents.eventHandlers.length; ++i) {
      const handler = JSEvents.eventHandlers[i];
      if (handler.target === eventHandler.target && handler.eventTypeId === eventHandler.eventTypeId && handler.callbackfunc === eventHandler.callbackfunc && handler.userData === eventHandler.userData) {
        // in some very rare cases (ex: Safari / fullscreen events), there is more than 1 handler (eventTypeString is different)
        JSEvents._removeHandler(i--);
        success = true;
      }
    }
    return success ? 0 : -5;
  },
  getTargetThreadForEventCallback(targetThread) {
    switch (targetThread) {
     case 1:
      // The event callback for the current event should be called on the
      // main browser thread. (0 == don't proxy)
      return 0;

     case 2:
      // The event callback for the current event should be backproxied to
      // the thread that is registering the event.
      // This can be 0 in the case that the caller uses
      // EM_CALLBACK_THREAD_CONTEXT_CALLING_THREAD but on the main thread
      // itself.
      return PThread.currentProxiedOperationCallerThread;

     default:
      // The event callback for the current event should be proxied to the
      // given specific thread.
      return targetThread;
    }
  },
  getNodeNameForTarget(target) {
    if (target == window) return "#window";
    if (target == screen) return "#screen";
    return target?.nodeName ?? "";
  },
  fullscreenEnabled() {
    return document.fullscreenEnabled;
  }
};

/** @type {Object} */ var specialHTMLTargets = [ 0, globalThis.document ?? 0, globalThis.window ?? 0 ];

var GLctx;

var webgl_enable_ANGLE_instanced_arrays = ctx => {
  // Extension available in WebGL 1 from Firefox 26 and Google Chrome 30 onwards. Core feature in WebGL 2.
  var ext = ctx.getExtension("ANGLE_instanced_arrays");
  // Because this extension is a core function in WebGL 2, assign the extension entry points in place of
  // where the core functions will reside in WebGL 2. This way the calling code can call these without
  // having to dynamically branch depending if running against WebGL 1 or WebGL 2.
  if (ext) {
    ctx["vertexAttribDivisor"] = (index, divisor) => ext["vertexAttribDivisorANGLE"](index, divisor);
    ctx["drawArraysInstanced"] = (mode, first, count, primcount) => ext["drawArraysInstancedANGLE"](mode, first, count, primcount);
    ctx["drawElementsInstanced"] = (mode, count, type, indices, primcount) => ext["drawElementsInstancedANGLE"](mode, count, type, indices, primcount);
    return 1;
  }
};

var webgl_enable_OES_vertex_array_object = ctx => {
  // Extension available in WebGL 1 from Firefox 25 and WebKit 536.28/desktop Safari 6.0.3 onwards. Core feature in WebGL 2.
  var ext = ctx.getExtension("OES_vertex_array_object");
  if (ext) {
    ctx["createVertexArray"] = () => ext["createVertexArrayOES"]();
    ctx["deleteVertexArray"] = vao => ext["deleteVertexArrayOES"](vao);
    ctx["bindVertexArray"] = vao => ext["bindVertexArrayOES"](vao);
    ctx["isVertexArray"] = vao => ext["isVertexArrayOES"](vao);
    return 1;
  }
};

var webgl_enable_WEBGL_draw_buffers = ctx => {
  // Extension available in WebGL 1 from Firefox 28 onwards. Core feature in WebGL 2.
  var ext = ctx.getExtension("WEBGL_draw_buffers");
  if (ext) {
    ctx["drawBuffers"] = (n, bufs) => ext["drawBuffersWEBGL"](n, bufs);
    return 1;
  }
};

var webgl_enable_EXT_polygon_offset_clamp = ctx => !!(ctx.extPolygonOffsetClamp = ctx.getExtension("EXT_polygon_offset_clamp"));

var webgl_enable_EXT_clip_control = ctx => !!(ctx.extClipControl = ctx.getExtension("EXT_clip_control"));

var webgl_enable_WEBGL_polygon_mode = ctx => !!(ctx.webglPolygonMode = ctx.getExtension("WEBGL_polygon_mode"));

var webgl_enable_WEBGL_multi_draw = ctx => // Closure is expected to be allowed to minify the '.multiDrawWebgl' property, so not accessing it quoted.
!!(ctx.multiDrawWebgl = ctx.getExtension("WEBGL_multi_draw"));

var getEmscriptenSupportedExtensions = ctx => {
  // Restrict the list of advertised extensions to those that we actually
  // support.
  var supportedExtensions = [ // WebGL 1 extensions
  "ANGLE_instanced_arrays", "EXT_blend_minmax", "EXT_disjoint_timer_query", "EXT_frag_depth", "EXT_shader_texture_lod", "EXT_sRGB", "OES_element_index_uint", "OES_fbo_render_mipmap", "OES_standard_derivatives", "OES_texture_float", "OES_texture_half_float", "OES_texture_half_float_linear", "OES_vertex_array_object", "WEBGL_color_buffer_float", "WEBGL_depth_texture", "WEBGL_draw_buffers", // WebGL 1 and WebGL 2 extensions
  "EXT_clip_control", "EXT_color_buffer_half_float", "EXT_depth_clamp", "EXT_float_blend", "EXT_polygon_offset_clamp", "EXT_texture_compression_bptc", "EXT_texture_compression_rgtc", "EXT_texture_filter_anisotropic", "KHR_parallel_shader_compile", "OES_texture_float_linear", "WEBGL_blend_func_extended", "WEBGL_compressed_texture_astc", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_etc1", "WEBGL_compressed_texture_s3tc", "WEBGL_compressed_texture_s3tc_srgb", "WEBGL_debug_renderer_info", "WEBGL_debug_shaders", "WEBGL_lose_context", "WEBGL_multi_draw", "WEBGL_polygon_mode" ];
  // .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
  return ctx.getSupportedExtensions()?.filter(ext => supportedExtensions.includes(ext)) ?? [];
};

var GL = {
  counter: 1,
  buffers: [],
  programs: [],
  framebuffers: [],
  renderbuffers: [],
  textures: [],
  shaders: [],
  vaos: [],
  contexts: {},
  offscreenCanvases: {},
  queries: [],
  stringCache: {},
  unpackAlignment: 4,
  unpackRowLength: 0,
  recordError: errorCode => {
    if (!GL.lastError) {
      GL.lastError = errorCode;
    }
  },
  getNewId: table => {
    var ret = GL.counter++;
    for (var i = table.length; i < ret; i++) {
      table[i] = null;
    }
    return ret;
  },
  genObject: (n, buffers, createFunction, objectTable) => {
    for (var i = 0; i < n; i++) {
      var buffer = GLctx[createFunction]();
      var id = buffer && GL.getNewId(objectTable);
      if (buffer) {
        buffer.name = id;
        objectTable[id] = buffer;
      } else {
        GL.recordError(1282);
      }
      (growMemViews(), HEAP32)[(((buffers) + (i * 4)) / 4)] = id;
    }
  },
  getSource: (shader, count, string, length) => {
    var source = "";
    for (var i = 0; i < count; ++i) {
      var len = length ? Number((growMemViews(), HEAPU64)[(((length) + (i * 8)) / 8)]) : undefined;
      source += UTF8ToString(Number((growMemViews(), HEAPU64)[(((string) + (i * 8)) / 8)]), len);
    }
    return source;
  },
  createContext: (/** @type {HTMLCanvasElement} */ canvas, webGLContextAttributes) => {
    var ctx = canvas.getContext("webgl", webGLContextAttributes);
    if (!ctx) return 0;
    var handle = GL.registerContext(ctx, webGLContextAttributes);
    return handle;
  },
  registerContext: (ctx, webGLContextAttributes) => {
    // with pthreads a context is a location in memory with some synchronized
    // data between threads
    var handle = _malloc(16);
    (growMemViews(), HEAPU64)[(((handle) + (8)) / 8)] = BigInt(_pthread_self());
    // the thread pointer of the thread that owns the control of the context
    var context = {
      handle,
      attributes: webGLContextAttributes,
      version: webGLContextAttributes.majorVersion,
      GLctx: ctx
    };
    // Store the created context object so that we can access the context
    // given a canvas without having to pass the parameters again.
    if (ctx.canvas) ctx.canvas.GLctxObject = context;
    GL.contexts[handle] = context;
    if (typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
      GL.initExtensions(context);
    }
    return handle;
  },
  makeContextCurrent: contextHandle => {
    // Active Emscripten GL layer context object.
    GL.currentContext = GL.contexts[contextHandle];
    // Active WebGL context object.
    Module["ctx"] = GLctx = GL.currentContext?.GLctx;
    return !(contextHandle && !GLctx);
  },
  getContext: contextHandle => GL.contexts[contextHandle],
  deleteContext: contextHandle => {
    if (GL.currentContext === GL.contexts[contextHandle]) {
      GL.currentContext = null;
    }
    if (typeof JSEvents === "object") {
      // Release all JS event handlers on the DOM element that the GL context is
      // associated with since the context is now deleted.
      JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
    }
    // Make sure the canvas object no longer refers to the context object so
    // there are no GC surprises.
    if (GL.contexts[contextHandle]?.GLctx.canvas) {
      GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
    }
    _free(GL.contexts[contextHandle].handle);
    GL.contexts[contextHandle] = null;
  },
  initExtensions: context => {
    // If this function is called without a specific context object, init the
    // extensions of the currently active context.
    context ||= GL.currentContext;
    if (context.initExtensionsDone) return;
    context.initExtensionsDone = true;
    var GLctx = context.GLctx;
    // Detect the presence of a few extensions manually, since the GL interop
    // layer itself will need to know if they exist.
    // Extensions that are available in both WebGL 1 and WebGL 2
    webgl_enable_WEBGL_multi_draw(GLctx);
    webgl_enable_EXT_polygon_offset_clamp(GLctx);
    webgl_enable_EXT_clip_control(GLctx);
    webgl_enable_WEBGL_polygon_mode(GLctx);
    // Extensions that are only available in WebGL 1 (the calls will be no-ops
    // if called on a WebGL 2 context active)
    webgl_enable_ANGLE_instanced_arrays(GLctx);
    webgl_enable_OES_vertex_array_object(GLctx);
    webgl_enable_WEBGL_draw_buffers(GLctx);
    {
      GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
    }
    for (var ext of getEmscriptenSupportedExtensions(GLctx)) {
      // WEBGL_lose_context, WEBGL_debug_renderer_info and WEBGL_debug_shaders
      // are not enabled by default.
      if (!ext.includes("lose_context") && !ext.includes("debug")) {
        // Call .getExtension() to enable that extension permanently.
        GLctx.getExtension(ext);
      }
    }
  }
};

var maybeCStringToJsString = cString => cString > 2 ? UTF8ToString(cString) : cString;

var findCanvasEventTarget = target => {
  target = maybeCStringToJsString(target);
  // When compiling with OffscreenCanvas support and looking up a canvas to target,
  // we first look up if the target Canvas has been transferred to OffscreenCanvas use.
  // These transfers are represented/tracked by GL.offscreenCanvases object, which contain
  // the OffscreenCanvas element for each regular Canvas element that has been transferred.
  // Note that each pthread/worker have their own set of GL.offscreenCanvases. That is,
  // when an OffscreenCanvas is transferred from a pthread/main thread to another pthread,
  // it will move in the GL.offscreenCanvases array between threads. Hence GL.offscreenCanvases
  // represents the set of OffscreenCanvases owned by the current calling thread.
  // First check out the list of OffscreenCanvases by CSS selector ID ('#myCanvasID')
  return GL.offscreenCanvases[target.slice(1)] || (target == "canvas" && Object.values(GL.offscreenCanvases)[0]) || specialHTMLTargets[target] || globalThis.document?.querySelector(target);
};

var getCanvasSizeCallingThread = (target, width, height) => {
  var canvas = findCanvasEventTarget(target);
  if (!canvas) return -4;
  if (canvas.canvasSharedPtr) {
    // N.B. Reading the size of the Canvas takes priority from our shared state structure, which is not the actual size.
    // However if is possible that there is a canvas size set event pending on an OffscreenCanvas owned by another thread,
    // so that the real sizes of the canvas have not updated yet. Therefore reading the real values would be racy.
    var w = (growMemViews(), HEAP32)[((canvas.canvasSharedPtr) / 4)];
    var h = (growMemViews(), HEAP32)[(((canvas.canvasSharedPtr) + (4)) / 4)];
    (growMemViews(), HEAP32)[((width) / 4)] = w;
    (growMemViews(), HEAP32)[((height) / 4)] = h;
  } else if (canvas.offscreenCanvas) {
    (growMemViews(), HEAP32)[((width) / 4)] = canvas.offscreenCanvas.width;
    (growMemViews(), HEAP32)[((height) / 4)] = canvas.offscreenCanvas.height;
  } else if (!canvas.controlTransferredOffscreen) {
    (growMemViews(), HEAP32)[((width) / 4)] = canvas.width;
    (growMemViews(), HEAP32)[((height) / 4)] = canvas.height;
  } else {
    return -4;
  }
  return 0;
};

function getCanvasSizeMainThread(target, width, height) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(4, 0, 1, target, width, height);
  return getCanvasSizeCallingThread(target, width, height);
}

function _emscripten_get_canvas_element_size(target, width, height) {
  target = bigintToI53Checked(target);
  width = bigintToI53Checked(width);
  height = bigintToI53Checked(height);
  var canvas = findCanvasEventTarget(target);
  if (canvas) {
    return getCanvasSizeCallingThread(target, width, height);
  }
  return getCanvasSizeMainThread(target, width, height);
}

var stringToUTF8OnStack = str => {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8(str, ret, size);
  return ret;
};

var getCanvasElementSize = target => {
  var sp = stackSave();
  var w = stackAlloc(8);
  var h = w + 4;
  var targetInt = stringToUTF8OnStack(target.id);
  var ret = _emscripten_get_canvas_element_size(targetInt, w, h);
  var size = [ (growMemViews(), HEAP32)[((w) / 4)], (growMemViews(), HEAP32)[((h) / 4)] ];
  stackRestore(sp);
  return size;
};

var stringToNewUTF8 = str => {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8(str, ret, size);
  return ret;
};

var setOffscreenCanvasSizeOnTargetThread = (targetThread, targetCanvas, width, height) => {
  targetCanvas = targetCanvas ? UTF8ToString(targetCanvas) : "";
  var targetCanvasPtr = 0;
  if (targetCanvas) {
    targetCanvasPtr = stringToNewUTF8(targetCanvas);
  }
  __emscripten_set_offscreencanvas_size_on_thread(targetThread, targetCanvasPtr, width, height);
};

var setCanvasElementSizeCallingThread = (target, width, height) => {
  var canvas = findCanvasEventTarget(target);
  if (!canvas) return -4;
  if (canvas.canvasSharedPtr) {
    // N.B. We hold the canvasSharedPtr info structure as the authoritative source for specifying the size of a canvas
    // since the actual canvas size changes are asynchronous if the canvas is owned by an OffscreenCanvas on another thread.
    // Therefore when setting the size, eagerly set the size of the canvas on the calling thread here, though this thread
    // might not be the one that actually ends up specifying the size, but the actual size change may be dispatched
    // as an asynchronous event below.
    (growMemViews(), HEAP32)[((canvas.canvasSharedPtr) / 4)] = width;
    (growMemViews(), HEAP32)[(((canvas.canvasSharedPtr) + (4)) / 4)] = height;
  }
  if (canvas.offscreenCanvas || !canvas.controlTransferredOffscreen) {
    if (canvas.offscreenCanvas) canvas = canvas.offscreenCanvas;
    var autoResizeViewport = false;
    if (canvas.GLctxObject?.GLctx) {
      var prevViewport = canvas.GLctxObject.GLctx.getParameter(2978);
      // TODO: Perhaps autoResizeViewport should only be true if FBO 0 is currently active?
      autoResizeViewport = (!prevViewport[0] && !prevViewport[1] && prevViewport[2] === canvas.width && prevViewport[3] === canvas.height);
    }
    canvas.width = width;
    canvas.height = height;
    if (autoResizeViewport) {
      // TODO: Add -sCANVAS_RESIZE_SETS_GL_VIEWPORT=0/1 option (default=1). This is commonly done and several graphics engines depend on this,
      // but this can be quite disruptive.
      canvas.GLctxObject.GLctx.viewport(0, 0, width, height);
    }
  } else if (canvas.canvasSharedPtr) {
    var targetThread = Number((growMemViews(), HEAPU64)[(((canvas.canvasSharedPtr) + (8)) / 8)]);
    setOffscreenCanvasSizeOnTargetThread(targetThread, target, width, height);
    return 1;
  } else {
    return -4;
  }
  return 0;
};

function setCanvasElementSizeMainThread(target, width, height) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(5, 0, 1, target, width, height);
  return setCanvasElementSizeCallingThread(target, width, height);
}

function _emscripten_set_canvas_element_size(target, width, height) {
  target = bigintToI53Checked(target);
  var canvas = findCanvasEventTarget(target);
  if (canvas) {
    return setCanvasElementSizeCallingThread(target, width, height);
  }
  return setCanvasElementSizeMainThread(target, width, height);
}

var setCanvasElementSize = (target, width, height) => {
  if (!target.controlTransferredOffscreen) {
    target.width = width;
    target.height = height;
  } else {
    // This function is being called from high-level JavaScript code instead of asm.js/Wasm,
    // and it needs to synchronously proxy over to another thread, so marshal the string onto the heap to do the call.
    var sp = stackSave();
    var targetInt = stringToUTF8OnStack(target.id);
    _emscripten_set_canvas_element_size(targetInt, width, height);
    stackRestore(sp);
  }
};

var currentFullscreenStrategy = 0;

var callCanvasResizedCallback = strategy => {
  if (strategy.canvasResizedCallback) {
    if (strategy.canvasResizedCallbackTargetThread) __emscripten_run_callback_on_thread(strategy.canvasResizedCallbackTargetThread, strategy.canvasResizedCallback, 37, 0, 0, strategy.canvasResizedCallbackUserData); else (((a1, a2, a3) => getWasmTableEntry(strategy.canvasResizedCallback).call(null, a1, BigInt(a2), BigInt(a3))))(37, 0, strategy.canvasResizedCallbackUserData);
  }
};

var registerRestoreOldStyle = canvas => {
  var canvasSize = getCanvasElementSize(canvas);
  var oldWidth = canvasSize[0];
  var oldHeight = canvasSize[1];
  var oldCssWidth = canvas.style.width;
  var oldCssHeight = canvas.style.height;
  var oldBackgroundColor = canvas.style.backgroundColor;
  // Chrome reads color from here.
  var oldDocumentBackgroundColor = document.body.style.backgroundColor;
  // IE11 reads color from here.
  // Firefox always has black background color.
  var oldPaddingLeft = canvas.style.paddingLeft;
  // Chrome, FF, Safari
  var oldPaddingRight = canvas.style.paddingRight;
  var oldPaddingTop = canvas.style.paddingTop;
  var oldPaddingBottom = canvas.style.paddingBottom;
  var oldMarginLeft = canvas.style.marginLeft;
  // IE11
  var oldMarginRight = canvas.style.marginRight;
  var oldMarginTop = canvas.style.marginTop;
  var oldMarginBottom = canvas.style.marginBottom;
  var oldDocumentBodyMargin = document.body.style.margin;
  var oldDocumentOverflow = document.documentElement.style.overflow;
  // Chrome, Firefox
  var oldDocumentScroll = document.body.scroll;
  // IE
  var oldImageRendering = canvas.style.imageRendering;
  function restoreOldStyle() {
    if (!getFullscreenElement()) {
      document.removeEventListener("fullscreenchange", restoreOldStyle);
      setCanvasElementSize(canvas, oldWidth, oldHeight);
      canvas.style.width = oldCssWidth;
      canvas.style.height = oldCssHeight;
      canvas.style.backgroundColor = oldBackgroundColor;
      // Chrome
      // IE11 hack: assigning 'undefined' or an empty string to document.body.style.backgroundColor has no effect, so first assign back the default color
      // before setting the undefined value. Setting undefined value is also important, or otherwise we would later treat that as something that the user
      // had explicitly set so subsequent fullscreen transitions would not set background color properly.
      if (!oldDocumentBackgroundColor) document.body.style.backgroundColor = "white";
      document.body.style.backgroundColor = oldDocumentBackgroundColor;
      // IE11
      canvas.style.paddingLeft = oldPaddingLeft;
      // Chrome, FF, Safari
      canvas.style.paddingRight = oldPaddingRight;
      canvas.style.paddingTop = oldPaddingTop;
      canvas.style.paddingBottom = oldPaddingBottom;
      canvas.style.marginLeft = oldMarginLeft;
      // IE11
      canvas.style.marginRight = oldMarginRight;
      canvas.style.marginTop = oldMarginTop;
      canvas.style.marginBottom = oldMarginBottom;
      document.body.style.margin = oldDocumentBodyMargin;
      document.documentElement.style.overflow = oldDocumentOverflow;
      // Chrome, Firefox
      document.body.scroll = oldDocumentScroll;
      // IE
      canvas.style.imageRendering = oldImageRendering;
      if (canvas.GLctxObject) canvas.GLctxObject.GLctx.viewport(0, 0, oldWidth, oldHeight);
      callCanvasResizedCallback(currentFullscreenStrategy);
    }
  }
  document.addEventListener("fullscreenchange", restoreOldStyle);
  return restoreOldStyle;
};

var setLetterbox = (element, topBottom, leftRight) => {
  // Cannot use margin to specify letterboxes in FF or Chrome, since those ignore margins in fullscreen mode.
  element.style.paddingLeft = element.style.paddingRight = leftRight + "px";
  element.style.paddingTop = element.style.paddingBottom = topBottom + "px";
};

var getBoundingClientRect = e => specialHTMLTargets.indexOf(e) < 0 ? e.getBoundingClientRect() : {
  "left": 0,
  "top": 0
};

var JSEvents_resizeCanvasForFullscreen = (target, strategy) => {
  var restoreOldStyle = registerRestoreOldStyle(target);
  var cssWidth = strategy.softFullscreen ? innerWidth : screen.width;
  var cssHeight = strategy.softFullscreen ? innerHeight : screen.height;
  var rect = getBoundingClientRect(target);
  var windowedCssWidth = rect.width;
  var windowedCssHeight = rect.height;
  var canvasSize = getCanvasElementSize(target);
  var windowedRttWidth = canvasSize[0];
  var windowedRttHeight = canvasSize[1];
  if (strategy.scaleMode == 3) {
    setLetterbox(target, (cssHeight - windowedCssHeight) / 2, (cssWidth - windowedCssWidth) / 2);
    cssWidth = windowedCssWidth;
    cssHeight = windowedCssHeight;
  } else if (strategy.scaleMode == 2) {
    if (cssWidth * windowedRttHeight < windowedRttWidth * cssHeight) {
      var desiredCssHeight = windowedRttHeight * cssWidth / windowedRttWidth;
      setLetterbox(target, (cssHeight - desiredCssHeight) / 2, 0);
      cssHeight = desiredCssHeight;
    } else {
      var desiredCssWidth = windowedRttWidth * cssHeight / windowedRttHeight;
      setLetterbox(target, 0, (cssWidth - desiredCssWidth) / 2);
      cssWidth = desiredCssWidth;
    }
  }
  // If we are adding padding, must choose a background color or otherwise Chrome will give the
  // padding a default white color. Do it only if user has not customized their own background color.
  target.style.backgroundColor ||= "black";
  // IE11 does the same, but requires the color to be set in the document body.
  document.body.style.backgroundColor ||= "black";
  // IE11
  // Firefox always shows black letterboxes independent of style color.
  target.style.width = cssWidth + "px";
  target.style.height = cssHeight + "px";
  if (strategy.filteringMode == 1) {
    target.style.imageRendering = "optimizeSpeed";
    target.style.imageRendering = "-moz-crisp-edges";
    target.style.imageRendering = "-o-crisp-edges";
    target.style.imageRendering = "-webkit-optimize-contrast";
    target.style.imageRendering = "optimize-contrast";
    target.style.imageRendering = "crisp-edges";
    target.style.imageRendering = "pixelated";
  }
  var dpiScale = (strategy.canvasResolutionScaleMode == 2) ? devicePixelRatio : 1;
  if (strategy.canvasResolutionScaleMode != 0) {
    var newWidth = (cssWidth * dpiScale) | 0;
    var newHeight = (cssHeight * dpiScale) | 0;
    setCanvasElementSize(target, newWidth, newHeight);
    if (target.GLctxObject) target.GLctxObject.GLctx.viewport(0, 0, newWidth, newHeight);
  }
  return restoreOldStyle;
};

var JSEvents_requestFullscreen = (target, strategy) => {
  // EMSCRIPTEN_FULLSCREEN_SCALE_DEFAULT + EMSCRIPTEN_FULLSCREEN_CANVAS_SCALE_NONE is a mode where no extra logic is performed to the DOM elements.
  if (strategy.scaleMode != 0 || strategy.canvasResolutionScaleMode != 0) {
    JSEvents_resizeCanvasForFullscreen(target, strategy);
  }
  if (target.requestFullscreen) {
    target.requestFullscreen();
  } else {
    return JSEvents.fullscreenEnabled() ? -3 : -1;
  }
  currentFullscreenStrategy = strategy;
  callCanvasResizedCallback(strategy);
  return 0;
};

function _emscripten_exit_fullscreen() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(3, 0, 1);
  if (!JSEvents.fullscreenEnabled()) return -1;
  // Make sure no queued up calls will fire after this.
  JSEvents.removeDeferredCalls(JSEvents_requestFullscreen);
  var d = specialHTMLTargets[1];
  if (d.exitFullscreen) {
    d.fullscreenElement && d.exitFullscreen();
  } else {
    return -1;
  }
  return 0;
}

var requestPointerLock = target => {
  if (target.requestPointerLock) {
    target.requestPointerLock();
  } else {
    // document.body is known to accept pointer lock, so use that to differentiate if the user passed a bad element,
    // or if the whole browser just doesn't support the feature.
    if (document.body.requestPointerLock) {
      return -3;
    }
    return -1;
  }
  return 0;
};

function _emscripten_exit_pointerlock() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(6, 0, 1);
  // Make sure no queued up calls will fire after this.
  JSEvents.removeDeferredCalls(requestPointerLock);
  if (!document.exitPointerLock) return -1;
  document.exitPointerLock();
  return 0;
}

var _emscripten_exit_with_live_runtime = () => {
  runtimeKeepalivePush();
  throw "unwind";
};

function _emscripten_get_device_pixel_ratio() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(7, 0, 1);
  return devicePixelRatio;
}

var findEventTarget = target => {
  target = maybeCStringToJsString(target);
  var domElement = specialHTMLTargets[target] || globalThis.document?.querySelector(target);
  return domElement;
};

function _emscripten_get_element_css_size(target, width, height) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(8, 0, 1, target, width, height);
  target = bigintToI53Checked(target);
  width = bigintToI53Checked(width);
  height = bigintToI53Checked(height);
  target = findEventTarget(target);
  if (!target) return -4;
  var rect = getBoundingClientRect(target);
  (growMemViews(), HEAPF64)[((width) / 8)] = rect.width;
  (growMemViews(), HEAPF64)[((height) / 8)] = rect.height;
  return 0;
}

function getFullscreenElement() {
  return document.fullscreenElement;
}

var fillFullscreenChangeEventData = eventStruct => {
  var fullscreenElement = getFullscreenElement();
  var isFullscreen = !!fullscreenElement;
  // Assigning a boolean to HEAP32 with expected type coercion.
  /** @suppress{checkTypes} */ (growMemViews(), HEAP8)[eventStruct] = isFullscreen;
  (growMemViews(), HEAP8)[(eventStruct) + (1)] = JSEvents.fullscreenEnabled();
  // If transitioning to fullscreen, report info about the element that is now fullscreen.
  // If transitioning to windowed mode, report info about the element that just was fullscreen.
  var reportedElement = isFullscreen ? fullscreenElement : JSEvents.previousFullscreenElement;
  var nodeName = JSEvents.getNodeNameForTarget(reportedElement);
  var id = reportedElement?.id ?? "";
  stringToUTF8(nodeName, eventStruct + 2, 128);
  stringToUTF8(id, eventStruct + 130, 128);
  (growMemViews(), HEAP32)[(((eventStruct) + (260)) / 4)] = reportedElement?.clientWidth ?? 0;
  (growMemViews(), HEAP32)[(((eventStruct) + (264)) / 4)] = reportedElement?.clientHeight ?? 0;
  (growMemViews(), HEAP32)[(((eventStruct) + (268)) / 4)] = screen.width;
  (growMemViews(), HEAP32)[(((eventStruct) + (272)) / 4)] = screen.height;
  if (isFullscreen) {
    JSEvents.previousFullscreenElement = fullscreenElement;
  }
};

function _emscripten_get_fullscreen_status(fullscreenStatus) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(9, 0, 1, fullscreenStatus);
  fullscreenStatus = bigintToI53Checked(fullscreenStatus);
  if (!JSEvents.fullscreenEnabled()) return -1;
  fillFullscreenChangeEventData(fullscreenStatus);
  return 0;
}

var fillGamepadEventData = (eventStruct, e) => {
  (growMemViews(), HEAPF64)[((eventStruct) / 8)] = e.timestamp;
  for (var i = 0; i < e.axes.length; ++i) {
    (growMemViews(), HEAPF64)[(((eventStruct + i * 8) + (16)) / 8)] = e.axes[i];
  }
  for (var i = 0; i < e.buttons.length; ++i) {
    (growMemViews(), HEAP8)[(eventStruct + i) + (1040)] = e.buttons[i].pressed;
    (growMemViews(), HEAPF64)[(((eventStruct + i * 8) + (528)) / 8)] = e.buttons[i].value;
  }
  (growMemViews(), HEAP8)[(eventStruct) + (1104)] = e.connected;
  (growMemViews(), HEAP32)[(((eventStruct) + (1108)) / 4)] = e.index;
  (growMemViews(), HEAP32)[(((eventStruct) + (8)) / 4)] = e.axes.length;
  (growMemViews(), HEAP32)[(((eventStruct) + (12)) / 4)] = e.buttons.length;
  stringToUTF8(e.id, eventStruct + 1112, 64);
  stringToUTF8(e.mapping, eventStruct + 1176, 64);
};

function _emscripten_get_gamepad_status(index, gamepadState) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(10, 0, 1, index, gamepadState);
  gamepadState = bigintToI53Checked(gamepadState);
  // INVALID_PARAM is returned on a Gamepad index that never was there.
  if (index < 0 || index >= JSEvents.lastGamepadState.length) return -5;
  // NO_DATA is returned on a Gamepad index that was removed.
  // For previously disconnected gamepads there should be an empty slot (null/undefined/false) at the index.
  // This is because gamepads must keep their original position in the array.
  // For example, removing the first of two gamepads produces [null/undefined/false, gamepad].
  if (!JSEvents.lastGamepadState[index]) return -7;
  fillGamepadEventData(gamepadState, JSEvents.lastGamepadState[index]);
  return 0;
}

var getHeapMax = () => 17179869184;

var _emscripten_get_heap_max = () => BigInt(getHeapMax());

var _emscripten_set_main_loop_timing = (mode, value) => {
  MainLoop.timingMode = mode;
  MainLoop.timingValue = value;
  if (!MainLoop.func) {
    return 1;
  }
  // If there is no existing scheduler then we are transitioning from
  // inactive to active and we add to runtime keepalive counter.
  if (!MainLoop.scheduler) {
    runtimeKeepalivePush();
  }
  if (mode == 0) {
    MainLoop.scheduler = function MainLoop_scheduler_setTimeout() {
      var timeUntilNextTick = Math.max(0, MainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
      setTimeout(MainLoop.runner, timeUntilNextTick);
    };
  } else if (mode == 1) {
    MainLoop.scheduler = function MainLoop_scheduler_rAF() {
      MainLoop.requestAnimationFrame(MainLoop.runner);
    };
  } else {
    if (!MainLoop.setImmediate) {
      if (globalThis.scheduler) {
        // Some modern browsers implement scheduler.postTask, but not all.
        MainLoop.setImmediate = scheduler.postTask.bind(scheduler);
      } else {
        // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
        var setImmediates = [];
        var emscriptenMainLoopMessageId = "setimmediate";
        /** @param {Event} event */ var MainLoop_setImmediate_messageHandler = event => {
          if (event.data === emscriptenMainLoopMessageId) {
            event.stopPropagation();
            setImmediates.shift()();
          }
        };
        addEventListener("message", MainLoop_setImmediate_messageHandler, true);
        MainLoop.setImmediate = /** @type{function(function(): ?, ...?): number} */ (func => {
          setImmediates.push(func);
          if (ENVIRONMENT_IS_WORKER) {
            // The postMessge API in a Worker, sends message to the main
            // thread and does not support the `targetOrigin` (*) argument.
            postMessage(emscriptenMainLoopMessageId);
          } else {
            postMessage(emscriptenMainLoopMessageId, "*");
          }
        });
      }
    }
    MainLoop.scheduler = function MainLoop_scheduler_setImmediate() {
      MainLoop.setImmediate(MainLoop.runner);
    };
  }
  return 0;
};

/**
   * @param {number=} arg
   * @param {boolean=} noSetTiming
   */ var setMainLoop = (iterFunc, fps, simulateInfiniteLoop, arg, noSetTiming) => {
  MainLoop.func = iterFunc;
  MainLoop.arg = arg;
  var thisMainLoopId = MainLoop.currentlyRunningMainloop;
  function checkIsRunning() {
    if (thisMainLoopId < MainLoop.currentlyRunningMainloop) {
      maybeExit();
      return false;
    }
    return true;
  }
  // We create the loop runner here but it is not actually running until
  // _emscripten_set_main_loop_timing is called (which might happen at a
  // later time).
  MainLoop.runner = function MainLoop_runner() {
    if (ABORT) return;
    if (MainLoop.queue.length > 0) {
      var start = Date.now();
      var blocker = MainLoop.queue.shift();
      blocker.func(blocker.arg);
      if (MainLoop.remainingBlockers) {
        var remaining = MainLoop.remainingBlockers;
        var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
        if (blocker.counted) {
          MainLoop.remainingBlockers = next;
        } else {
          // not counted, but move the progress along a tiny bit
          next = next + .5;
          // do not steal all the next one's progress
          MainLoop.remainingBlockers = (8 * remaining + next) / 9;
        }
      }
      MainLoop.updateStatus();
      // catches pause/resume main loop from blocker execution
      if (!checkIsRunning()) return;
      setTimeout(MainLoop.runner, 0);
      return;
    }
    // catch pauses from non-main loop sources
    if (!checkIsRunning()) return;
    // Implement very basic swap interval control
    MainLoop.currentFrameNumber = MainLoop.currentFrameNumber + 1 | 0;
    if (MainLoop.timingMode == 1 && MainLoop.timingValue > 1 && MainLoop.currentFrameNumber % MainLoop.timingValue != 0) {
      // Not the scheduled time to render this frame - skip.
      MainLoop.scheduler();
      return;
    } else if (MainLoop.timingMode == 0) {
      MainLoop.tickStartTime = _emscripten_get_now();
    }
    MainLoop.runIter(iterFunc);
    // catch pauses from the main loop itself
    if (!checkIsRunning()) return;
    MainLoop.scheduler();
  };
  if (!noSetTiming) {
    if (fps > 0) {
      _emscripten_set_main_loop_timing(0, 1e3 / fps);
    } else {
      // Do rAF by rendering each frame (no decimating)
      _emscripten_set_main_loop_timing(1, 1);
    }
    MainLoop.scheduler();
  }
  if (simulateInfiniteLoop) {
    throw "unwind";
  }
};

var MainLoop = {
  func: null,
  scheduler: null,
  currentlyRunningMainloop: 0,
  arg: 0,
  timingMode: 0,
  timingValue: 0,
  currentFrameNumber: 0,
  queue: [],
  preMainLoop: [],
  postMainLoop: [],
  pause() {
    if (MainLoop.scheduler) {
      MainLoop.scheduler = null;
      // Incrementing this signals the previous main loop that it's now become old, and it must return.
      MainLoop.currentlyRunningMainloop++;
      runtimeKeepalivePop();
    }
  },
  resume() {
    MainLoop.currentlyRunningMainloop++;
    var timingMode = MainLoop.timingMode;
    var timingValue = MainLoop.timingValue;
    var func = MainLoop.func;
    MainLoop.func = null;
    // do not set timing and call scheduler, we will do it on the next lines
    setMainLoop(func, 0, false, MainLoop.arg, true);
    _emscripten_set_main_loop_timing(timingMode, timingValue);
    MainLoop.scheduler();
  },
  updateStatus() {
    if (Module["setStatus"]) {
      var message = Module["statusMessage"] || "Please wait...";
      var remaining = MainLoop.remainingBlockers ?? 0;
      var expected = MainLoop.expectedBlockers ?? 0;
      if (remaining) {
        if (remaining < expected) {
          Module["setStatus"](`{message} ({expected - remaining}/{expected})`);
        } else {
          Module["setStatus"](message);
        }
      } else {
        Module["setStatus"]("");
      }
    }
  },
  init() {},
  runIter(func) {
    if (ABORT) return;
    for (var pre of MainLoop.preMainLoop) {
      if (pre() === false) {
        return;
      }
    }
    callUserCallback(func);
    for (var post of MainLoop.postMainLoop) {
      post();
    }
  },
  nextRAF: 0,
  fakeRequestAnimationFrame(func) {
    // try to keep 60fps between calls to here
    var now = Date.now();
    if (!MainLoop.nextRAF) {
      MainLoop.nextRAF = now + 1e3 / 60;
    } else {
      while (now + 2 >= MainLoop.nextRAF) {
        // fudge a little, to avoid timer jitter causing us to do lots of delay:0
        MainLoop.nextRAF += 1e3 / 60;
      }
    }
    var delay = Math.max(MainLoop.nextRAF - now, 0);
    setTimeout(func, delay);
  },
  requestAnimationFrame(func) {
    if (globalThis.requestAnimationFrame) {
      requestAnimationFrame(func);
    } else {
      MainLoop.fakeRequestAnimationFrame(func);
    }
  }
};

function _emscripten_get_main_loop_timing(mode, value) {
  mode = bigintToI53Checked(mode);
  value = bigintToI53Checked(value);
  if (mode) (growMemViews(), HEAP32)[((mode) / 4)] = MainLoop.timingMode;
  if (value) (growMemViews(), HEAP32)[((value) / 4)] = MainLoop.timingValue;
}

function _emscripten_get_num_gamepads() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(11, 0, 1);
  // N.B. Do not call emscripten_get_num_gamepads() unless having first called emscripten_sample_gamepad_data(), and that has returned EMSCRIPTEN_RESULT_SUCCESS.
  // Otherwise the following line will throw an exception.
  return JSEvents.lastGamepadState.length;
}

var preloadPlugins = [];

/** @type {!Uint32Array} */ var HEAPU32;

var Browser = {
  useWebGL: false,
  isFullscreen: false,
  pointerLock: false,
  moduleContextCreatedCallbacks: [],
  preloadedImages: {},
  preloadedAudios: {},
  getCanvas: () => Module["canvas"],
  init() {
    if (Browser.initted) return;
    Browser.initted = true;
    // Support for plugins that can process preloaded files. You can add more of these to
    // your app by creating and appending to preloadPlugins.
    // Each plugin is asked if it can handle a file based on the file's name. If it can,
    // it is given the file's raw data. When it is done, it calls a callback with the file's
    // (possibly modified) data. For example, a plugin might decompress a file, or it
    // might create some side data structure for use later (like an Image element, etc.).
    var imagePlugin = {};
    imagePlugin["canHandle"] = name => !Module["noImageDecoding"] && /\.(jpg|jpeg|png|bmp|webp)$/i.test(name);
    imagePlugin["handle"] = async (byteArray, name) => {
      var b = new Blob([ byteArray ], {
        type: Browser.getMimetype(name)
      });
      if (b.size !== byteArray.length) {
        // Safari bug #118630
        // Safari's Blob can only take an ArrayBuffer
        b = new Blob([ (new Uint8Array(byteArray)).buffer ], {
          type: Browser.getMimetype(name)
        });
      }
      var url = URL.createObjectURL(b);
      return new Promise((resolve, reject) => {
        var img = new Image;
        img.onload = () => {
          var canvas = /** @type {!HTMLCanvasElement} */ (document.createElement("canvas"));
          canvas.width = img.width;
          canvas.height = img.height;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          Browser.preloadedImages[name] = canvas;
          URL.revokeObjectURL(url);
          resolve(byteArray);
        };
        img.onerror = event => {
          err(`Image ${url} could not be decoded`);
          reject();
        };
        img.src = url;
      });
    };
    preloadPlugins.push(imagePlugin);
    var audioPlugin = {};
    audioPlugin["canHandle"] = name => !Module["noAudioDecoding"] && name.slice(-4) in {
      ".ogg": 1,
      ".wav": 1,
      ".mp3": 1
    };
    audioPlugin["handle"] = async (byteArray, name) => new Promise((resolve, reject) => {
      var done = false;
      function finish(audio) {
        if (done) return;
        done = true;
        Browser.preloadedAudios[name] = audio;
        resolve(byteArray);
      }
      var b = new Blob([ byteArray ], {
        type: Browser.getMimetype(name)
      });
      var url = URL.createObjectURL(b);
      // XXX we never revoke this!
      var audio = new Audio;
      audio.addEventListener("canplaythrough", () => finish(audio));
      // use addEventListener due to chromium bug 124926
      audio.onerror = event => {
        if (done) return;
        err(`warning: browser could not fully decode audio ${name}, trying slower base64 approach`);
        function encode64(data) {
          var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
          const PAD = "=";
          var ret = "";
          var leftchar = 0;
          var leftbits = 0;
          for (var byte of data) {
            leftchar = (leftchar << 8) | byte;
            leftbits += 8;
            while (leftbits >= 6) {
              var curr = (leftchar >> (leftbits - 6)) & 63;
              leftbits -= 6;
              ret += BASE[curr];
            }
          }
          if (leftbits == 2) {
            ret += BASE[(leftchar & 3) << 4];
            ret += PAD + PAD;
          } else if (leftbits == 4) {
            ret += BASE[(leftchar & 15) << 2];
            ret += PAD;
          }
          return ret;
        }
        audio.src = "data:audio/x-" + name.slice(-3) + ";base64," + encode64(byteArray);
        finish(audio);
      };
      audio.src = url;
      // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
      safeSetTimeout(() => {
        finish(audio);
      }, 1e4);
    });
    preloadPlugins.push(audioPlugin);
    // Canvas event setup
    function pointerLockChange() {
      var canvas = Browser.getCanvas();
      Browser.pointerLock = document.pointerLockElement === canvas;
    }
    var canvas = Browser.getCanvas();
    if (canvas) {
      // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
      // Module['forcedAspectRatio'] = 4 / 3;
      document.addEventListener("pointerlockchange", pointerLockChange);
      if (Module["elementPointerLock"]) {
        canvas.addEventListener("click", ev => {
          if (!Browser.pointerLock && Browser.getCanvas().requestPointerLock) {
            Browser.getCanvas().requestPointerLock();
            ev.preventDefault();
          }
        });
      }
    }
  },
  createContext(/** @type {HTMLCanvasElement} */ canvas, useWebGL, setInModule, webGLContextAttributes) {
    if (useWebGL && Module["ctx"] && canvas == Browser.getCanvas()) return Module["ctx"];
    // no need to recreate GL context if it's already been created for this canvas.
    var ctx;
    var contextHandle;
    if (useWebGL) {
      // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
      var contextAttributes = {
        antialias: false,
        alpha: false,
        majorVersion: 1
      };
      if (webGLContextAttributes) {
        for (var attribute in webGLContextAttributes) {
          contextAttributes[attribute] = webGLContextAttributes[attribute];
        }
      }
      // This check of existence of GL is here to satisfy Closure compiler, which yells if variable GL is referenced below but GL object is not
      // actually compiled in because application is not doing any GL operations. TODO: Ideally if GL is not being used, this function
      // Browser.createContext() should not even be emitted.
      if (typeof GL !== "undefined") {
        contextHandle = GL.createContext(canvas, contextAttributes);
        if (contextHandle) {
          ctx = GL.getContext(contextHandle).GLctx;
        }
      }
    } else {
      ctx = canvas.getContext("2d");
    }
    if (!ctx) return null;
    if (setInModule) {
      Module["ctx"] = ctx;
      if (useWebGL) GL.makeContextCurrent(contextHandle);
      Browser.useWebGL = useWebGL;
      Browser.moduleContextCreatedCallbacks.forEach(callback => callback());
      Browser.init();
    }
    return ctx;
  },
  fullscreenHandlersInstalled: false,
  lockPointer: undefined,
  resizeCanvas: undefined,
  requestFullscreen(lockPointer, resizeCanvas) {
    Browser.lockPointer = lockPointer;
    Browser.resizeCanvas = resizeCanvas;
    if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
    if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
    var canvas = Browser.getCanvas();
    function fullscreenChange() {
      Browser.isFullscreen = false;
      var canvasContainer = canvas.parentNode;
      if (getFullscreenElement() === canvasContainer) {
        canvas.exitFullscreen = Browser.exitFullscreen;
        if (Browser.lockPointer) canvas.requestPointerLock();
        Browser.isFullscreen = true;
        if (Browser.resizeCanvas) {
          Browser.setFullscreenCanvasSize();
        } else {
          Browser.updateCanvasDimensions(canvas);
        }
      } else {
        // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
        canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
        canvasContainer.parentNode.removeChild(canvasContainer);
        if (Browser.resizeCanvas) {
          Browser.setWindowedCanvasSize();
        } else {
          Browser.updateCanvasDimensions(canvas);
        }
      }
    }
    if (!Browser.fullscreenHandlersInstalled) {
      Browser.fullscreenHandlersInstalled = true;
      document.addEventListener("fullscreenchange", fullscreenChange);
    }
    // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
    var canvasContainer = document.createElement("div");
    canvas.parentNode.insertBefore(canvasContainer, canvas);
    canvasContainer.appendChild(canvas);
    // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
    canvasContainer.requestFullscreen();
  },
  exitFullscreen() {
    // This is workaround for chrome. Trying to exit from fullscreen
    // not in fullscreen state will cause 'TypeError: Document not active'
    // in chrome. See https://github.com/emscripten-core/emscripten/pull/8236
    if (!Browser.isFullscreen) {
      return false;
    }
    document.exitFullscreen();
    return true;
  },
  getMimetype(name) {
    return {
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "bmp": "image/bmp",
      "ogg": "audio/ogg",
      "wav": "audio/wav",
      "mp3": "audio/mpeg"
    }[name.slice(name.lastIndexOf(".") + 1)];
  },
  getMouseWheelDelta(event) {
    var delta = 0;
    switch (event.type) {
     case "DOMMouseScroll":
      // 3 lines make up a step
      delta = event.detail / 3;
      break;

     case "mousewheel":
      // 120 units make up a step
      delta = event.wheelDelta / 120;
      break;

     case "wheel":
      delta = event.deltaY;
      switch (event.deltaMode) {
       case 0:
        // DOM_DELTA_PIXEL: 100 pixels make up a step
        delta /= 100;
        break;

       case 1:
        // DOM_DELTA_LINE: 3 lines make up a step
        delta /= 3;
        break;

       case 2:
        // DOM_DELTA_PAGE: A page makes up 80 steps
        delta *= 80;
        break;

       default:
        abort("unrecognized mouse wheel delta mode: " + event.deltaMode);
      }
      break;

     default:
      abort("unrecognized mouse wheel event: " + event.type);
    }
    return delta;
  },
  mouseX: 0,
  mouseY: 0,
  mouseMovementX: 0,
  mouseMovementY: 0,
  touches: {},
  lastTouches: {},
  calculateMouseCoords(pageX, pageY) {
    // Calculate the movement based on the changes
    // in the coordinates.
    var canvas = Browser.getCanvas();
    var rect = canvas.getBoundingClientRect();
    var adjustedX = pageX - (window.scrollX + rect.left);
    var adjustedY = pageY - (window.scrollY + rect.top);
    // the canvas might be CSS-scaled compared to its backbuffer;
    // SDL-using content will want mouse coordinates in terms
    // of backbuffer units.
    adjustedX = adjustedX * (canvas.width / rect.width);
    adjustedY = adjustedY * (canvas.height / rect.height);
    return {
      x: adjustedX,
      y: adjustedY
    };
  },
  setMouseCoords(pageX, pageY) {
    const {x, y} = Browser.calculateMouseCoords(pageX, pageY);
    Browser.mouseMovementX = x - Browser.mouseX;
    Browser.mouseMovementY = y - Browser.mouseY;
    Browser.mouseX = x;
    Browser.mouseY = y;
  },
  calculateMouseEvent(event) {
    // event should be mousemove, mousedown or mouseup
    if (Browser.pointerLock) {
      // When the pointer is locked, calculate the coordinates
      // based on the movement of the mouse.
      Browser.mouseMovementX = event.movementX;
      Browser.mouseMovementY = event.movementY;
      // add the mouse delta to the current absolute mouse position
      Browser.mouseX += Browser.mouseMovementX;
      Browser.mouseY += Browser.mouseMovementY;
    } else {
      if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
        var touch = event.touch;
        if (touch === undefined) {
          return;
        }
        var coords = Browser.calculateMouseCoords(touch.pageX, touch.pageY);
        if (event.type === "touchstart") {
          Browser.lastTouches[touch.identifier] = coords;
          Browser.touches[touch.identifier] = coords;
        } else if (event.type === "touchend" || event.type === "touchmove") {
          var last = Browser.touches[touch.identifier];
          last ||= coords;
          Browser.lastTouches[touch.identifier] = last;
          Browser.touches[touch.identifier] = coords;
        }
        return;
      }
      Browser.setMouseCoords(event.pageX, event.pageY);
    }
  },
  resizeListeners: [],
  updateResizeListeners() {
    var canvas = Browser.getCanvas();
    Browser.resizeListeners.forEach(listener => listener(canvas.width, canvas.height));
  },
  setCanvasSize(width, height, noUpdates) {
    var canvas = Browser.getCanvas();
    Browser.updateCanvasDimensions(canvas, width, height);
    if (!noUpdates) Browser.updateResizeListeners();
  },
  setFullscreenCanvasSize() {
    // check if SDL is available
    if (typeof SDL !== "undefined") {
      var flags = (growMemViews(), HEAPU32)[((SDL.screen) / 4)];
      flags = flags | 8388608;
      (growMemViews(), HEAP32)[((SDL.screen) / 4)] = flags;
    }
    Browser.updateCanvasDimensions(Browser.getCanvas());
    Browser.updateResizeListeners();
  },
  setWindowedCanvasSize() {
    // check if SDL is available
    if (typeof SDL !== "undefined") {
      var flags = (growMemViews(), HEAPU32)[((SDL.screen) / 4)];
      flags = flags & ~8388608;
      (growMemViews(), HEAP32)[((SDL.screen) / 4)] = flags;
    }
    Browser.updateCanvasDimensions(Browser.getCanvas());
    Browser.updateResizeListeners();
  },
  updateCanvasDimensions(canvas, wNative, hNative) {
    if (wNative && hNative) {
      canvas.widthNative = wNative;
      canvas.heightNative = hNative;
    } else {
      wNative = canvas.widthNative;
      hNative = canvas.heightNative;
    }
    var w = wNative;
    var h = hNative;
    if ((getFullscreenElement() === canvas.parentNode) && (typeof screen !== "undefined")) {
      var factor = Math.min(screen.width / w, screen.height / h);
      w = Math.round(w * factor);
      h = Math.round(h * factor);
    }
    if (Browser.resizeCanvas) {
      if (canvas.width != w) canvas.width = w;
      if (canvas.height != h) canvas.height = h;
      if (typeof canvas.style !== "undefined") {
        canvas.style.removeProperty("width");
        canvas.style.removeProperty("height");
      }
    } else {
      if (canvas.width != wNative) canvas.width = wNative;
      if (canvas.height != hNative) canvas.height = hNative;
      if (typeof canvas.style !== "undefined") {
        if (w != wNative || h != hNative) {
          canvas.style.setProperty("width", w + "px", "important");
          canvas.style.setProperty("height", h + "px", "important");
        } else {
          canvas.style.removeProperty("width");
          canvas.style.removeProperty("height");
        }
      }
    }
  }
};

function _emscripten_get_screen_size(width, height) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(12, 0, 1, width, height);
  width = bigintToI53Checked(width);
  height = bigintToI53Checked(height);
  (growMemViews(), HEAP32)[((width) / 4)] = screen.width;
  (growMemViews(), HEAP32)[((height) / 4)] = screen.height;
}

var _emscripten_glActiveTexture = x0 => GLctx.activeTexture(x0);

var _emscripten_glAttachShader = (program, shader) => {
  GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
};

var _emscripten_glBeginQueryEXT = (target, id) => {
  GLctx.disjointTimerQueryExt["beginQueryEXT"](target, GL.queries[id]);
};

function _emscripten_glBindAttribLocation(program, index, name) {
  name = bigintToI53Checked(name);
  GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
}

var _emscripten_glBindBuffer = (target, buffer) => {
  GLctx.bindBuffer(target, GL.buffers[buffer]);
};

var _emscripten_glBindFramebuffer = (target, framebuffer) => {
  GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer]);
};

var _emscripten_glBindRenderbuffer = (target, renderbuffer) => {
  GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer]);
};

var _emscripten_glBindTexture = (target, texture) => {
  GLctx.bindTexture(target, GL.textures[texture]);
};

var _emscripten_glBindVertexArray = vao => {
  GLctx.bindVertexArray(GL.vaos[vao]);
};

var _emscripten_glBindVertexArrayOES = _emscripten_glBindVertexArray;

var _emscripten_glBlendColor = (x0, x1, x2, x3) => GLctx.blendColor(x0, x1, x2, x3);

var _emscripten_glBlendEquation = x0 => GLctx.blendEquation(x0);

var _emscripten_glBlendEquationSeparate = (x0, x1) => GLctx.blendEquationSeparate(x0, x1);

var _emscripten_glBlendFunc = (x0, x1) => GLctx.blendFunc(x0, x1);

var _emscripten_glBlendFuncSeparate = (x0, x1, x2, x3) => GLctx.blendFuncSeparate(x0, x1, x2, x3);

function _emscripten_glBufferData(target, size, data, usage) {
  size = bigintToI53Checked(size);
  data = bigintToI53Checked(data);
  // N.b. here first form specifies a heap subarray, second form an integer
  // size, so the ?: code here is polymorphic. It is advised to avoid
  // randomly mixing both uses in calling code, to avoid any potential JS
  // engine JIT issues.
  GLctx.bufferData(target, data ? (growMemViews(), HEAPU8).subarray(data, data + size) : size, usage);
}

var webglBufferSubData = (target, offset, size, data, src = (growMemViews(), HEAPU8)) => {
  GLctx.bufferSubData(target, offset, src.subarray(data, data + size));
};

function _emscripten_glBufferSubData(target, offset, size, data) {
  offset = bigintToI53Checked(offset);
  size = bigintToI53Checked(size);
  data = bigintToI53Checked(data);
  return webglBufferSubData(target, offset, size, data);
}

var _emscripten_glCheckFramebufferStatus = x0 => GLctx.checkFramebufferStatus(x0);

var _emscripten_glClear = x0 => GLctx.clear(x0);

var _emscripten_glClearColor = (x0, x1, x2, x3) => GLctx.clearColor(x0, x1, x2, x3);

var _emscripten_glClearDepthf = x0 => GLctx.clearDepth(x0);

var _emscripten_glClearStencil = x0 => GLctx.clearStencil(x0);

var _emscripten_glClipControlEXT = (origin, depth) => {
  GLctx.extClipControl["clipControlEXT"](origin, depth);
};

var _emscripten_glColorMask = (red, green, blue, alpha) => {
  GLctx.colorMask(!!red, !!green, !!blue, !!alpha);
};

var _emscripten_glCompileShader = shader => {
  GLctx.compileShader(GL.shaders[shader]);
};

function _emscripten_glCompressedTexImage2D(target, level, internalFormat, width, height, border, imageSize, data) {
  data = bigintToI53Checked(data);
  // `data` may be null here, which means "allocate uninitialized space but
  // don't upload" in GLES parlance, but `compressedTexImage2D` requires the
  // final data parameter, so we simply pass a heap view starting at zero
  // effectively uploading whatever happens to be near address zero.  See
  // https://github.com/emscripten-core/emscripten/issues/19300.
  GLctx.compressedTexImage2D(target, level, internalFormat, width, height, border, (growMemViews(), 
  HEAPU8).subarray(data, data + imageSize));
}

function _emscripten_glCompressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, imageSize, data) {
  data = bigintToI53Checked(data);
  GLctx.compressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, (growMemViews(), 
  HEAPU8).subarray(data, data + imageSize));
}

var _emscripten_glCopyTexImage2D = (x0, x1, x2, x3, x4, x5, x6, x7) => GLctx.copyTexImage2D(x0, x1, x2, x3, x4, x5, x6, x7);

var _emscripten_glCopyTexSubImage2D = (x0, x1, x2, x3, x4, x5, x6, x7) => GLctx.copyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7);

var _emscripten_glCreateProgram = () => {
  var id = GL.getNewId(GL.programs);
  var program = GLctx.createProgram();
  // Store additional information needed for each shader program:
  program.name = id;
  // Lazy cache results of
  // glGetProgramiv(GL_ACTIVE_UNIFORM_MAX_LENGTH/GL_ACTIVE_ATTRIBUTE_MAX_LENGTH/GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH)
  program.maxUniformLength = program.maxAttributeLength = program.maxUniformBlockNameLength = 0;
  program.uniformIdCounter = 1;
  GL.programs[id] = program;
  return id;
};

var _emscripten_glCreateShader = shaderType => {
  var id = GL.getNewId(GL.shaders);
  GL.shaders[id] = GLctx.createShader(shaderType);
  return id;
};

var _emscripten_glCullFace = x0 => GLctx.cullFace(x0);

function _emscripten_glDeleteBuffers(n, buffers) {
  buffers = bigintToI53Checked(buffers);
  for (var i = 0; i < n; i++) {
    var id = (growMemViews(), HEAP32)[(((buffers) + (i * 4)) / 4)];
    var buffer = GL.buffers[id];
    // From spec: "glDeleteBuffers silently ignores 0's and names that do not
    // correspond to existing buffer objects."
    if (!buffer) continue;
    GLctx.deleteBuffer(buffer);
    buffer.name = 0;
    GL.buffers[id] = null;
  }
}

function _emscripten_glDeleteFramebuffers(n, framebuffers) {
  framebuffers = bigintToI53Checked(framebuffers);
  for (var i = 0; i < n; ++i) {
    var id = (growMemViews(), HEAP32)[(((framebuffers) + (i * 4)) / 4)];
    var framebuffer = GL.framebuffers[id];
    if (!framebuffer) continue;
    // GL spec: "glDeleteFramebuffers silently ignores 0s and names that do not correspond to existing framebuffer objects".
    GLctx.deleteFramebuffer(framebuffer);
    framebuffer.name = 0;
    GL.framebuffers[id] = null;
  }
}

var _emscripten_glDeleteProgram = id => {
  if (!id) return;
  var program = GL.programs[id];
  if (!program) {
    // glDeleteProgram actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(1281);
    return;
  }
  GLctx.deleteProgram(program);
  program.name = 0;
  GL.programs[id] = null;
};

function _emscripten_glDeleteQueriesEXT(n, ids) {
  ids = bigintToI53Checked(ids);
  for (var i = 0; i < n; i++) {
    var id = (growMemViews(), HEAP32)[(((ids) + (i * 4)) / 4)];
    var query = GL.queries[id];
    if (!query) continue;
    // GL spec: "unused names in ids are ignored, as is the name zero."
    GLctx.disjointTimerQueryExt["deleteQueryEXT"](query);
    GL.queries[id] = null;
  }
}

function _emscripten_glDeleteRenderbuffers(n, renderbuffers) {
  renderbuffers = bigintToI53Checked(renderbuffers);
  for (var i = 0; i < n; i++) {
    var id = (growMemViews(), HEAP32)[(((renderbuffers) + (i * 4)) / 4)];
    var renderbuffer = GL.renderbuffers[id];
    if (!renderbuffer) continue;
    // GL spec: "glDeleteRenderbuffers silently ignores 0s and names that do not correspond to existing renderbuffer objects".
    GLctx.deleteRenderbuffer(renderbuffer);
    renderbuffer.name = 0;
    GL.renderbuffers[id] = null;
  }
}

var _emscripten_glDeleteShader = id => {
  if (!id) return;
  var shader = GL.shaders[id];
  if (!shader) {
    // glDeleteShader actually signals an error when deleting a nonexisting
    // object, unlike some other GL delete functions.
    GL.recordError(1281);
    return;
  }
  GLctx.deleteShader(shader);
  GL.shaders[id] = null;
};

function _emscripten_glDeleteTextures(n, textures) {
  textures = bigintToI53Checked(textures);
  for (var i = 0; i < n; i++) {
    var id = (growMemViews(), HEAP32)[(((textures) + (i * 4)) / 4)];
    var texture = GL.textures[id];
    // GL spec: "glDeleteTextures silently ignores 0s and names that do not
    // correspond to existing textures".
    if (!texture) continue;
    GLctx.deleteTexture(texture);
    texture.name = 0;
    GL.textures[id] = null;
  }
}

function _emscripten_glDeleteVertexArrays(n, vaos) {
  vaos = bigintToI53Checked(vaos);
  for (var i = 0; i < n; i++) {
    var id = (growMemViews(), HEAP32)[(((vaos) + (i * 4)) / 4)];
    GLctx.deleteVertexArray(GL.vaos[id]);
    GL.vaos[id] = null;
  }
}

var _emscripten_glDeleteVertexArraysOES = _emscripten_glDeleteVertexArrays;

var _emscripten_glDepthFunc = x0 => GLctx.depthFunc(x0);

var _emscripten_glDepthMask = flag => {
  GLctx.depthMask(!!flag);
};

var _emscripten_glDepthRangef = (x0, x1) => GLctx.depthRange(x0, x1);

var _emscripten_glDetachShader = (program, shader) => {
  GLctx.detachShader(GL.programs[program], GL.shaders[shader]);
};

var _emscripten_glDisable = x0 => GLctx.disable(x0);

var _emscripten_glDisableVertexAttribArray = index => {
  GLctx.disableVertexAttribArray(index);
};

var _emscripten_glDrawArrays = (mode, first, count) => {
  GLctx.drawArrays(mode, first, count);
};

var _emscripten_glDrawArraysInstanced = (mode, first, count, primcount) => {
  GLctx.drawArraysInstanced(mode, first, count, primcount);
};

var _emscripten_glDrawArraysInstancedANGLE = _emscripten_glDrawArraysInstanced;

var tempFixedLengthArray = [];

function _emscripten_glDrawBuffers(n, bufs) {
  bufs = bigintToI53Checked(bufs);
  var bufArray = tempFixedLengthArray[n];
  for (var i = 0; i < n; i++) {
    bufArray[i] = (growMemViews(), HEAP32)[(((bufs) + (i * 4)) / 4)];
  }
  GLctx.drawBuffers(bufArray);
}

var _emscripten_glDrawBuffersWEBGL = _emscripten_glDrawBuffers;

function _emscripten_glDrawElements(mode, count, type, indices) {
  indices = bigintToI53Checked(indices);
  GLctx.drawElements(mode, count, type, indices);
}

function _emscripten_glDrawElementsInstanced(mode, count, type, indices, primcount) {
  indices = bigintToI53Checked(indices);
  GLctx.drawElementsInstanced(mode, count, type, indices, primcount);
}

var _emscripten_glDrawElementsInstancedANGLE = _emscripten_glDrawElementsInstanced;

var _emscripten_glEnable = x0 => GLctx.enable(x0);

var _emscripten_glEnableVertexAttribArray = index => {
  GLctx.enableVertexAttribArray(index);
};

var _emscripten_glEndQueryEXT = target => {
  GLctx.disjointTimerQueryExt["endQueryEXT"](target);
};

var _emscripten_glFinish = () => GLctx.finish();

var _emscripten_glFlush = () => GLctx.flush();

var _emscripten_glFramebufferRenderbuffer = (target, attachment, renderbuffertarget, renderbuffer) => {
  GLctx.framebufferRenderbuffer(target, attachment, renderbuffertarget, GL.renderbuffers[renderbuffer]);
};

var _emscripten_glFramebufferTexture2D = (target, attachment, textarget, texture, level) => {
  GLctx.framebufferTexture2D(target, attachment, textarget, GL.textures[texture], level);
};

var _emscripten_glFrontFace = x0 => GLctx.frontFace(x0);

function _emscripten_glGenBuffers(n, buffers) {
  buffers = bigintToI53Checked(buffers);
  GL.genObject(n, buffers, "createBuffer", GL.buffers);
}

function _emscripten_glGenFramebuffers(n, ids) {
  ids = bigintToI53Checked(ids);
  GL.genObject(n, ids, "createFramebuffer", GL.framebuffers);
}

function _emscripten_glGenQueriesEXT(n, ids) {
  ids = bigintToI53Checked(ids);
  for (var i = 0; i < n; i++) {
    var query = GLctx.disjointTimerQueryExt["createQueryEXT"]();
    if (!query) {
      GL.recordError(1282);
      while (i < n) (growMemViews(), HEAP32)[(((ids) + (i++ * 4)) / 4)] = 0;
      return;
    }
    var id = GL.getNewId(GL.queries);
    query.name = id;
    GL.queries[id] = query;
    (growMemViews(), HEAP32)[(((ids) + (i * 4)) / 4)] = id;
  }
}

function _emscripten_glGenRenderbuffers(n, renderbuffers) {
  renderbuffers = bigintToI53Checked(renderbuffers);
  GL.genObject(n, renderbuffers, "createRenderbuffer", GL.renderbuffers);
}

function _emscripten_glGenTextures(n, textures) {
  textures = bigintToI53Checked(textures);
  GL.genObject(n, textures, "createTexture", GL.textures);
}

function _emscripten_glGenVertexArrays(n, arrays) {
  arrays = bigintToI53Checked(arrays);
  GL.genObject(n, arrays, "createVertexArray", GL.vaos);
}

var _emscripten_glGenVertexArraysOES = _emscripten_glGenVertexArrays;

var _emscripten_glGenerateMipmap = x0 => GLctx.generateMipmap(x0);

var __glGetActiveAttribOrUniform = (funcName, program, index, bufSize, length, size, type, name) => {
  program = GL.programs[program];
  var info = GLctx[funcName](program, index);
  if (info) {
    // If an error occurs, nothing will be written to length, size and type and name.
    var numBytesWrittenExclNull = name && stringToUTF8(info.name, name, bufSize);
    if (length) (growMemViews(), HEAP32)[((length) / 4)] = numBytesWrittenExclNull;
    if (size) (growMemViews(), HEAP32)[((size) / 4)] = info.size;
    if (type) (growMemViews(), HEAP32)[((type) / 4)] = info.type;
  }
};

function _emscripten_glGetActiveAttrib(program, index, bufSize, length, size, type, name) {
  length = bigintToI53Checked(length);
  size = bigintToI53Checked(size);
  type = bigintToI53Checked(type);
  name = bigintToI53Checked(name);
  return __glGetActiveAttribOrUniform("getActiveAttrib", program, index, bufSize, length, size, type, name);
}

function _emscripten_glGetActiveUniform(program, index, bufSize, length, size, type, name) {
  length = bigintToI53Checked(length);
  size = bigintToI53Checked(size);
  type = bigintToI53Checked(type);
  name = bigintToI53Checked(name);
  return __glGetActiveAttribOrUniform("getActiveUniform", program, index, bufSize, length, size, type, name);
}

function _emscripten_glGetAttachedShaders(program, maxCount, count, shaders) {
  count = bigintToI53Checked(count);
  shaders = bigintToI53Checked(shaders);
  var result = GLctx.getAttachedShaders(GL.programs[program]);
  var len = result.length;
  if (len > maxCount) {
    len = maxCount;
  }
  (growMemViews(), HEAP32)[((count) / 4)] = len;
  for (var i = 0; i < len; ++i) {
    var id = GL.shaders.indexOf(result[i]);
    (growMemViews(), HEAP32)[(((shaders) + (i * 4)) / 4)] = id;
  }
}

function _emscripten_glGetAttribLocation(program, name) {
  name = bigintToI53Checked(name);
  return GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));
}

var writeI53ToI64 = (ptr, num) => {
  (growMemViews(), HEAPU32)[((ptr) / 4)] = num;
  var lower = (growMemViews(), HEAPU32)[((ptr) / 4)];
  (growMemViews(), HEAPU32)[(((ptr) + (4)) / 4)] = (num - lower) / 4294967296;
};

/** @type {!Float32Array} */ var HEAPF32;

var emscriptenWebGLGet = (name_, p, type) => {
  // Guard against user passing a null pointer.
  // Note that GLES2 spec does not say anything about how passing a null
  // pointer should be treated.  Testing on desktop core GL 3, the application
  // crashes on glGetIntegerv to a null pointer, but better to report an error
  // instead of doing anything random.
  if (!p) {
    GL.recordError(1281);
    return;
  }
  var ret = undefined;
  switch (name_) {
   // Handle a few trivial GLES values
    case 36346:
    // GL_SHADER_COMPILER
    ret = 1;
    break;

   case 36344:
    // GL_SHADER_BINARY_FORMATS
    if (type != 0 && type != 1) {
      GL.recordError(1280);
    }
    // Do not write anything to the out pointer, since no binary formats are
    // supported.
    return;

   case 36345:
    // GL_NUM_SHADER_BINARY_FORMATS
    ret = 0;
    break;

   case 34466:
    // GL_NUM_COMPRESSED_TEXTURE_FORMATS
    // WebGL doesn't have GL_NUM_COMPRESSED_TEXTURE_FORMATS (it's obsolete
    // since GL_COMPRESSED_TEXTURE_FORMATS returns a JS array that can be
    // queried for length), so implement it ourselves to allow C++ GLES2
    // code to get the length.
    var formats = GLctx.getParameter(34467);
    ret = formats ? formats.length : 0;
    break;
  }
  if (ret === undefined) {
    var result = GLctx.getParameter(name_);
    switch (typeof result) {
     case "number":
      ret = result;
      break;

     case "boolean":
      ret = result ? 1 : 0;
      break;

     case "string":
      GL.recordError(1280);
      // GL_INVALID_ENUM
      return;

     case "object":
      if (result === null) {
        // null is a valid result for some (e.g., which buffer is bound -
        // perhaps nothing is bound), but otherwise can mean an invalid
        // name_, which we need to report as an error
        switch (name_) {
         case 34964:
         // ARRAY_BUFFER_BINDING
          case 35725:
         // CURRENT_PROGRAM
          case 34965:
         // ELEMENT_ARRAY_BUFFER_BINDING
          case 36006:
         // FRAMEBUFFER_BINDING or DRAW_FRAMEBUFFER_BINDING
          case 36007:
         // RENDERBUFFER_BINDING
          case 32873:
         // TEXTURE_BINDING_2D
          case 34229:
         // WebGL 2 GL_VERTEX_ARRAY_BINDING, or WebGL 1 extension OES_vertex_array_object GL_VERTEX_ARRAY_BINDING_OES
          case 34068:
          {
            // TEXTURE_BINDING_CUBE_MAP
            ret = 0;
            break;
          }

         default:
          {
            GL.recordError(1280);
            // GL_INVALID_ENUM
            return;
          }
        }
      } else if (result instanceof Float32Array || result instanceof Uint32Array || result instanceof Int32Array || result instanceof Array) {
        for (var i = 0; i < result.length; ++i) {
          switch (type) {
           case 0:
            (growMemViews(), HEAP32)[(((p) + (i * 4)) / 4)] = result[i];
            break;

           case 2:
            (growMemViews(), HEAPF32)[(((p) + (i * 4)) / 4)] = result[i];
            break;

           case 4:
            (growMemViews(), HEAP8)[(p) + (i)] = result[i] ? 1 : 0;
            break;
          }
        }
        return;
      } else {
        try {
          ret = result.name | 0;
        } catch (e) {
          GL.recordError(1280);
          // GL_INVALID_ENUM
          err(`GL_INVALID_ENUM in glGet${type}v: Unknown object returned from WebGL getParameter(${name_})! (error: ${e})`);
          return;
        }
      }
      break;

     default:
      GL.recordError(1280);
      // GL_INVALID_ENUM
      err(`GL_INVALID_ENUM in glGet${type}v: Native code calling glGet${type}v(${name_}) and it returns ${result} of type ${typeof (result)}!`);
      return;
    }
  }
  switch (type) {
   case 1:
    writeI53ToI64(p, ret);
    break;

   case 0:
    (growMemViews(), HEAP32)[((p) / 4)] = ret;
    break;

   case 2:
    (growMemViews(), HEAPF32)[((p) / 4)] = ret;
    break;

   case 4:
    (growMemViews(), HEAP8)[p] = ret ? 1 : 0;
    break;
  }
};

function _emscripten_glGetBooleanv(name_, p) {
  p = bigintToI53Checked(p);
  return emscriptenWebGLGet(name_, p, 4);
}

function _emscripten_glGetBufferParameteriv(target, value, data) {
  data = bigintToI53Checked(data);
  if (!data) {
    // GLES2 specification does not specify how to behave if data is a null
    // pointer. Since calling this function does not make sense if data ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAP32)[((data) / 4)] = GLctx.getBufferParameter(target, value);
}

var _emscripten_glGetError = () => {
  var error = GLctx.getError() || GL.lastError;
  GL.lastError = 0;
  return error;
};

function _emscripten_glGetFloatv(name_, p) {
  p = bigintToI53Checked(p);
  return emscriptenWebGLGet(name_, p, 2);
}

function _emscripten_glGetFramebufferAttachmentParameteriv(target, attachment, pname, params) {
  params = bigintToI53Checked(params);
  var result = GLctx.getFramebufferAttachmentParameter(target, attachment, pname);
  if (result instanceof WebGLRenderbuffer || result instanceof WebGLTexture) {
    result = result.name | 0;
  }
  (growMemViews(), HEAP32)[((params) / 4)] = result;
}

function _emscripten_glGetIntegerv(name_, p) {
  p = bigintToI53Checked(p);
  return emscriptenWebGLGet(name_, p, 0);
}

function _emscripten_glGetProgramInfoLog(program, maxLength, length, infoLog) {
  length = bigintToI53Checked(length);
  infoLog = bigintToI53Checked(infoLog);
  var log = GLctx.getProgramInfoLog(GL.programs[program]);
  if (log === null) log = "(unknown error)";
  var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
  if (length) (growMemViews(), HEAP32)[((length) / 4)] = numBytesWrittenExclNull;
}

function _emscripten_glGetProgramiv(program, pname, p) {
  p = bigintToI53Checked(p);
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  if (program >= GL.counter) {
    GL.recordError(1281);
    return;
  }
  program = GL.programs[program];
  if (pname == 35716) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getProgramInfoLog(program);
    if (log === null) log = "(unknown error)";
    (growMemViews(), HEAP32)[((p) / 4)] = log.length + 1;
  } else if (pname == 35719) {
    if (!program.maxUniformLength) {
      var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
      for (var i = 0; i < numActiveUniforms; ++i) {
        program.maxUniformLength = Math.max(program.maxUniformLength, GLctx.getActiveUniform(program, i).name.length + 1);
      }
    }
    (growMemViews(), HEAP32)[((p) / 4)] = program.maxUniformLength;
  } else if (pname == 35722) {
    if (!program.maxAttributeLength) {
      var numActiveAttributes = GLctx.getProgramParameter(program, 35721);
      for (var i = 0; i < numActiveAttributes; ++i) {
        program.maxAttributeLength = Math.max(program.maxAttributeLength, GLctx.getActiveAttrib(program, i).name.length + 1);
      }
    }
    (growMemViews(), HEAP32)[((p) / 4)] = program.maxAttributeLength;
  } else if (pname == 35381) {
    if (!program.maxUniformBlockNameLength) {
      var numActiveUniformBlocks = GLctx.getProgramParameter(program, 35382);
      for (var i = 0; i < numActiveUniformBlocks; ++i) {
        program.maxUniformBlockNameLength = Math.max(program.maxUniformBlockNameLength, GLctx.getActiveUniformBlockName(program, i).length + 1);
      }
    }
    (growMemViews(), HEAP32)[((p) / 4)] = program.maxUniformBlockNameLength;
  } else {
    (growMemViews(), HEAP32)[((p) / 4)] = GLctx.getProgramParameter(program, pname);
  }
}

function _emscripten_glGetQueryObjecti64vEXT(id, pname, params) {
  params = bigintToI53Checked(params);
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  var query = GL.queries[id];
  var param;
  {
    param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
  }
  var ret;
  if (typeof param === "boolean") {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  writeI53ToI64(params, ret);
}

function _emscripten_glGetQueryObjectivEXT(id, pname, params) {
  params = bigintToI53Checked(params);
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  var query = GL.queries[id];
  var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
  var ret;
  if (typeof param === "boolean") {
    ret = param ? 1 : 0;
  } else {
    ret = param;
  }
  (growMemViews(), HEAP32)[((params) / 4)] = ret;
}

var _emscripten_glGetQueryObjectui64vEXT = _emscripten_glGetQueryObjecti64vEXT;

var _emscripten_glGetQueryObjectuivEXT = _emscripten_glGetQueryObjectivEXT;

function _emscripten_glGetQueryivEXT(target, pname, params) {
  params = bigintToI53Checked(params);
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if p == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAP32)[((params) / 4)] = GLctx.disjointTimerQueryExt["getQueryEXT"](target, pname);
}

function _emscripten_glGetRenderbufferParameteriv(target, pname, params) {
  params = bigintToI53Checked(params);
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
    // if params == null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAP32)[((params) / 4)] = GLctx.getRenderbufferParameter(target, pname);
}

function _emscripten_glGetShaderInfoLog(shader, maxLength, length, infoLog) {
  length = bigintToI53Checked(length);
  infoLog = bigintToI53Checked(infoLog);
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = "(unknown error)";
  var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
  if (length) (growMemViews(), HEAP32)[((length) / 4)] = numBytesWrittenExclNull;
}

function _emscripten_glGetShaderPrecisionFormat(shaderType, precisionType, range, precision) {
  range = bigintToI53Checked(range);
  precision = bigintToI53Checked(precision);
  var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
  (growMemViews(), HEAP32)[((range) / 4)] = result.rangeMin;
  (growMemViews(), HEAP32)[(((range) + (4)) / 4)] = result.rangeMax;
  (growMemViews(), HEAP32)[((precision) / 4)] = result.precision;
}

function _emscripten_glGetShaderSource(shader, bufSize, length, source) {
  length = bigintToI53Checked(length);
  source = bigintToI53Checked(source);
  var result = GLctx.getShaderSource(GL.shaders[shader]);
  if (!result) return;
  // If an error occurs, nothing will be written to length or source.
  var numBytesWrittenExclNull = (bufSize > 0 && source) ? stringToUTF8(result, source, bufSize) : 0;
  if (length) (growMemViews(), HEAP32)[((length) / 4)] = numBytesWrittenExclNull;
}

function _emscripten_glGetShaderiv(shader, pname, p) {
  p = bigintToI53Checked(p);
  if (!p) {
    // GLES2 specification does not specify how to behave if p is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  if (pname == 35716) {
    // GL_INFO_LOG_LENGTH
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null) log = "(unknown error)";
    // The GLES2 specification says that if the shader has an empty info log,
    // a value of 0 is returned. Otherwise the log has a null char appended.
    // (An empty string is falsey, so we can just check that instead of
    // looking at log.length.)
    var logLength = log ? log.length + 1 : 0;
    (growMemViews(), HEAP32)[((p) / 4)] = logLength;
  } else if (pname == 35720) {
    // GL_SHADER_SOURCE_LENGTH
    var source = GLctx.getShaderSource(GL.shaders[shader]);
    // source may be a null, or the empty string, both of which are falsey
    // values that we report a 0 length for.
    var sourceLength = source ? source.length + 1 : 0;
    (growMemViews(), HEAP32)[((p) / 4)] = sourceLength;
  } else {
    (growMemViews(), HEAP32)[((p) / 4)] = GLctx.getShaderParameter(GL.shaders[shader], pname);
  }
}

var webglGetExtensions = () => {
  var exts = getEmscriptenSupportedExtensions(GLctx);
  exts = exts.concat(exts.map(e => "GL_" + e));
  return exts;
};

var _emscripten_glGetString = function(name_) {
  var ret = ((() => {
    var ret = GL.stringCache[name_];
    if (!ret) {
      switch (name_) {
       case 7939:
        ret = stringToNewUTF8(webglGetExtensions().join(" "));
        break;

       case 7936:
       case 7937:
       case 37445:
       case 37446:
        var s = GLctx.getParameter(name_);
        if (!s) {
          GL.recordError(1280);
        }
        ret = s ? stringToNewUTF8(s) : 0;
        break;

       case 7938:
        var webGLVersion = GLctx.getParameter(7938);
        // return GLES version string corresponding to the version of the WebGL context
        var glVersion = `OpenGL ES 2.0 (${webGLVersion})`;
        ret = stringToNewUTF8(glVersion);
        break;

       case 35724:
        var glslVersion = GLctx.getParameter(35724);
        // extract the version number 'N.M' from the string 'WebGL GLSL ES N.M ...'
        var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
        var ver_num = glslVersion.match(ver_re);
        if (ver_num !== null) {
          if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + "0";
          // ensure minor version has 2 digits
          glslVersion = `OpenGL ES GLSL ES ${ver_num[1]} (${glslVersion})`;
        }
        ret = stringToNewUTF8(glslVersion);
        break;

       default:
        GL.recordError(1280);
      }
      GL.stringCache[name_] = ret;
    }
    return ret;
  }))();
  return BigInt(ret);
};

function _emscripten_glGetTexParameterfv(target, pname, params) {
  params = bigintToI53Checked(params);
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAPF32)[((params) / 4)] = GLctx.getTexParameter(target, pname);
}

function _emscripten_glGetTexParameteriv(target, pname, params) {
  params = bigintToI53Checked(params);
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if p == null,
    // issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAP32)[((params) / 4)] = GLctx.getTexParameter(target, pname);
}

/** @suppress {checkTypes} */ var jstoi_q = str => parseInt(str);

/** @noinline */ var webglGetLeftBracePos = name => name.slice(-1) == "]" && name.lastIndexOf("[");

var webglPrepareUniformLocationsBeforeFirstUse = program => {
  var uniformLocsById = program.uniformLocsById, // Maps GLuint -> WebGLUniformLocation
  uniformSizeAndIdsByName = program.uniformSizeAndIdsByName, // Maps name -> [uniform array length, GLuint]
  i, j;
  // On the first time invocation of glGetUniformLocation on this shader program:
  // initialize cache data structures and discover which uniforms are arrays.
  if (!uniformLocsById) {
    // maps GLint integer locations to WebGLUniformLocations
    program.uniformLocsById = uniformLocsById = {};
    // maps integer locations back to uniform name strings, so that we can lazily fetch uniform array locations
    program.uniformArrayNamesById = {};
    var numActiveUniforms = GLctx.getProgramParameter(program, 35718);
    for (i = 0; i < numActiveUniforms; ++i) {
      var u = GLctx.getActiveUniform(program, i);
      var nm = u.name;
      var sz = u.size;
      var lb = webglGetLeftBracePos(nm);
      var arrayName = lb > 0 ? nm.slice(0, lb) : nm;
      // Assign a new location.
      var id = program.uniformIdCounter;
      program.uniformIdCounter += sz;
      // Eagerly get the location of the uniformArray[0] base element.
      // The remaining indices >0 will be left for lazy evaluation to
      // improve performance. Those may never be needed to fetch, if the
      // application fills arrays always in full starting from the first
      // element of the array.
      uniformSizeAndIdsByName[arrayName] = [ sz, id ];
      // Store placeholder integers in place that highlight that these
      // >0 index locations are array indices pending population.
      for (j = 0; j < sz; ++j) {
        uniformLocsById[id] = j;
        program.uniformArrayNamesById[id++] = arrayName;
      }
    }
  }
};

function _emscripten_glGetUniformLocation(program, name) {
  name = bigintToI53Checked(name);
  name = UTF8ToString(name);
  if (program = GL.programs[program]) {
    webglPrepareUniformLocationsBeforeFirstUse(program);
    var uniformLocsById = program.uniformLocsById;
    // Maps GLuint -> WebGLUniformLocation
    var arrayIndex = 0;
    var uniformBaseName = name;
    // Invariant: when populating integer IDs for uniform locations, we must
    // maintain the precondition that arrays reside in contiguous addresses,
    // i.e. for a 'vec4 colors[10];', colors[4] must be at location
    // colors[0]+4.  However, user might call glGetUniformLocation(program,
    // "colors") for an array, so we cannot discover based on the user input
    // arguments whether the uniform we are dealing with is an array. The only
    // way to discover which uniforms are arrays is to enumerate over all the
    // active uniforms in the program.
    var leftBrace = webglGetLeftBracePos(name);
    // If user passed an array accessor "[index]", parse the array index off the accessor.
    if (leftBrace > 0) {
      arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0;
      // "index]", coerce parseInt(']') with >>>0 to treat "foo[]" as "foo[0]" and foo[-1] as unsigned out-of-bounds.
      uniformBaseName = name.slice(0, leftBrace);
    }
    // Have we cached the location of this uniform before?
    // A pair [array length, GLint of the uniform location]
    var sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName];
    // If a uniform with this name exists, and if its index is within the
    // array limits (if it's even an array), query the WebGLlocation, or
    // return an existing cached location.
    if (sizeAndId && arrayIndex < sizeAndId[0]) {
      arrayIndex += sizeAndId[1];
      // Add the base location of the uniform to the array index offset.
      if ((uniformLocsById[arrayIndex] = uniformLocsById[arrayIndex] || GLctx.getUniformLocation(program, name))) {
        return arrayIndex;
      }
    }
  } else {
    // N.b. we are currently unable to distinguish between GL program IDs that
    // never existed vs GL program IDs that have been deleted, so report
    // GL_INVALID_VALUE in both cases.
    GL.recordError(1281);
  }
  return -1;
}

var webglGetProgramUniformLocation = (program, location) => {
  if (program) {
    var webglLoc = program.uniformLocsById[location];
    // program.uniformLocsById[location] stores either an integer, or a
    // WebGLUniformLocation.
    // If an integer, we have not yet bound the location, so do it now. The
    // integer value specifies the array index we should bind to.
    if (typeof webglLoc === "number") {
      program.uniformLocsById[location] = webglLoc = GLctx.getUniformLocation(program, program.uniformArrayNamesById[location] + (webglLoc > 0 ? `[${webglLoc}]` : ""));
    }
    // Else an already cached WebGLUniformLocation, return it.
    return webglLoc;
  } else {
    GL.recordError(1282);
  }
};

/** @suppress{checkTypes} */ var emscriptenWebGLGetUniform = (program, location, params, type) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if params ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  program = GL.programs[program];
  webglPrepareUniformLocationsBeforeFirstUse(program);
  var data = GLctx.getUniform(program, webglGetProgramUniformLocation(program, location));
  if (typeof data === "number" || typeof data === "boolean") {
    switch (type) {
     case 0:
      (growMemViews(), HEAP32)[((params) / 4)] = data;
      break;

     case 2:
      (growMemViews(), HEAPF32)[((params) / 4)] = data;
      break;
    }
  } else {
    for (var i = 0; i < data.length; i++) {
      switch (type) {
       case 0:
        (growMemViews(), HEAP32)[(((params) + (i * 4)) / 4)] = data[i];
        break;

       case 2:
        (growMemViews(), HEAPF32)[(((params) + (i * 4)) / 4)] = data[i];
        break;
      }
    }
  }
};

function _emscripten_glGetUniformfv(program, location, params) {
  params = bigintToI53Checked(params);
  emscriptenWebGLGetUniform(program, location, params, 2);
}

function _emscripten_glGetUniformiv(program, location, params) {
  params = bigintToI53Checked(params);
  emscriptenWebGLGetUniform(program, location, params, 0);
}

function _emscripten_glGetVertexAttribPointerv(index, pname, pointer) {
  pointer = bigintToI53Checked(pointer);
  if (!pointer) {
    // GLES2 specification does not specify how to behave if pointer is a null
    // pointer. Since calling this function does not make sense if pointer ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  (growMemViews(), HEAP32)[((pointer) / 4)] = GLctx.getVertexAttribOffset(index, pname);
}

/** @suppress{checkTypes} */ var emscriptenWebGLGetVertexAttrib = (index, pname, params, type) => {
  if (!params) {
    // GLES2 specification does not specify how to behave if params is a null
    // pointer. Since calling this function does not make sense if params ==
    // null, issue a GL error to notify user about it.
    GL.recordError(1281);
    return;
  }
  var data = GLctx.getVertexAttrib(index, pname);
  if (pname == 34975) {
    (growMemViews(), HEAP32)[((params) / 4)] = data && data["name"];
  } else if (typeof data === "number" || typeof data === "boolean") {
    switch (type) {
     case 0:
      (growMemViews(), HEAP32)[((params) / 4)] = data;
      break;

     case 2:
      (growMemViews(), HEAPF32)[((params) / 4)] = data;
      break;

     case 5:
      (growMemViews(), HEAP32)[((params) / 4)] = Math.fround(data);
      break;
    }
  } else {
    for (var i = 0; i < data.length; i++) {
      switch (type) {
       case 0:
        (growMemViews(), HEAP32)[(((params) + (i * 4)) / 4)] = data[i];
        break;

       case 2:
        (growMemViews(), HEAPF32)[(((params) + (i * 4)) / 4)] = data[i];
        break;

       case 5:
        (growMemViews(), HEAP32)[(((params) + (i * 4)) / 4)] = Math.fround(data[i]);
        break;
      }
    }
  }
};

function _emscripten_glGetVertexAttribfv(index, pname, params) {
  params = bigintToI53Checked(params);
  // N.B. This function may only be called if the vertex attribute was
  // specified using the function glVertexAttrib*f(), otherwise the results
  // are undefined. (GLES3 spec 6.1.12)
  emscriptenWebGLGetVertexAttrib(index, pname, params, 2);
}

function _emscripten_glGetVertexAttribiv(index, pname, params) {
  params = bigintToI53Checked(params);
  // N.B. This function may only be called if the vertex attribute was
  // specified using the function glVertexAttrib*f(), otherwise the results
  // are undefined. (GLES3 spec 6.1.12)
  emscriptenWebGLGetVertexAttrib(index, pname, params, 5);
}

var _emscripten_glHint = (x0, x1) => GLctx.hint(x0, x1);

var _emscripten_glIsBuffer = buffer => {
  var b = GL.buffers[buffer];
  if (!b) return 0;
  return GLctx.isBuffer(b);
};

var _emscripten_glIsEnabled = x0 => GLctx.isEnabled(x0);

var _emscripten_glIsFramebuffer = framebuffer => {
  var fb = GL.framebuffers[framebuffer];
  if (!fb) return 0;
  return GLctx.isFramebuffer(fb);
};

var _emscripten_glIsProgram = program => {
  program = GL.programs[program];
  if (!program) return 0;
  return GLctx.isProgram(program);
};

var _emscripten_glIsQueryEXT = id => {
  var query = GL.queries[id];
  if (!query) return 0;
  return GLctx.disjointTimerQueryExt["isQueryEXT"](query);
};

var _emscripten_glIsRenderbuffer = renderbuffer => {
  var rb = GL.renderbuffers[renderbuffer];
  if (!rb) return 0;
  return GLctx.isRenderbuffer(rb);
};

var _emscripten_glIsShader = shader => {
  var s = GL.shaders[shader];
  if (!s) return 0;
  return GLctx.isShader(s);
};

var _emscripten_glIsTexture = id => {
  var texture = GL.textures[id];
  if (!texture) return 0;
  return GLctx.isTexture(texture);
};

var _emscripten_glIsVertexArray = array => {
  var vao = GL.vaos[array];
  if (!vao) return 0;
  return GLctx.isVertexArray(vao);
};

var _emscripten_glIsVertexArrayOES = _emscripten_glIsVertexArray;

var _emscripten_glLineWidth = x0 => GLctx.lineWidth(x0);

var _emscripten_glLinkProgram = program => {
  program = GL.programs[program];
  GLctx.linkProgram(program);
  // Invalidate earlier computed uniform->ID mappings, those have now become stale
  program.uniformLocsById = 0;
  // Mark as null-like so that glGetUniformLocation() knows to populate this again.
  program.uniformSizeAndIdsByName = {};
};

var _emscripten_glPixelStorei = (pname, param) => {
  if (pname == 3317) {
    GL.unpackAlignment = param;
  } else if (pname == 3314) {
    GL.unpackRowLength = param;
  }
  GLctx.pixelStorei(pname, param);
};

var _emscripten_glPolygonModeWEBGL = (face, mode) => {
  GLctx.webglPolygonMode["polygonModeWEBGL"](face, mode);
};

var _emscripten_glPolygonOffset = (x0, x1) => GLctx.polygonOffset(x0, x1);

var _emscripten_glPolygonOffsetClampEXT = (factor, units, clamp) => {
  GLctx.extPolygonOffsetClamp["polygonOffsetClampEXT"](factor, units, clamp);
};

var _emscripten_glQueryCounterEXT = (id, target) => {
  GLctx.disjointTimerQueryExt["queryCounterEXT"](GL.queries[id], target);
};

var computeUnpackAlignedImageSize = (width, height, sizePerPixel) => {
  function roundedToNextMultipleOf(x, y) {
    return (x + y - 1) & -y;
  }
  var plainRowSize = (GL.unpackRowLength || width) * sizePerPixel;
  var alignedRowSize = roundedToNextMultipleOf(plainRowSize, GL.unpackAlignment);
  return height * alignedRowSize;
};

var colorChannelsInGlTextureFormat = format => {
  // Micro-optimizations for size: map format to size by subtracting smallest
  // enum value (0x1902) from all values first.  Also omit the most common
  // size value (1) from the list, which is assumed by formats not on the
  // list.
  var colorChannels = {
    // 0x1902 /* GL_DEPTH_COMPONENT */ - 0x1902: 1,
    // 0x1906 /* GL_ALPHA */ - 0x1902: 1,
    5: 3,
    6: 4,
    // 0x1909 /* GL_LUMINANCE */ - 0x1902: 1,
    8: 2,
    29502: 3,
    29504: 4
  };
  return colorChannels[format - 6402] || 1;
};

/** @type {!Uint16Array} */ var HEAPU16;

var heapObjectForWebGLType = type => {
  // Micro-optimization for size: Subtract lowest GL enum number (0x1400/* GL_BYTE */) from type to compare
  // smaller values for the heap, for shorter generated code size.
  // Also the type HEAPU16 is not tested for explicitly, but any unrecognized type will return out HEAPU16.
  // (since most types are HEAPU16)
  type -= 5120;
  if (type == 1) return growMemViews(), HEAPU8;
  if (type == 4) return growMemViews(), HEAP32;
  if (type == 6) return growMemViews(), HEAPF32;
  if (type == 5 || type == 28922) return growMemViews(), HEAPU32;
  return growMemViews(), HEAPU16;
};

var toTypedArrayIndex = (pointer, heap) => pointer / heap.BYTES_PER_ELEMENT;

var emscriptenWebGLGetTexPixelData = (type, format, width, height, pixels) => {
  var heap = heapObjectForWebGLType(type);
  var sizePerPixel = colorChannelsInGlTextureFormat(format) * heap.BYTES_PER_ELEMENT;
  var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel);
  return heap.subarray(toTypedArrayIndex(pixels, heap), toTypedArrayIndex(pixels + bytes, heap));
};

function _emscripten_glReadPixels(x, y, width, height, format, type, pixels) {
  pixels = bigintToI53Checked(pixels);
  var pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels);
  if (!pixelData) {
    GL.recordError(1280);
    return;
  }
  GLctx.readPixels(x, y, width, height, format, type, pixelData);
}

var _emscripten_glReleaseShaderCompiler = () => {};

var _emscripten_glRenderbufferStorage = (x0, x1, x2, x3) => GLctx.renderbufferStorage(x0, x1, x2, x3);

var _emscripten_glSampleCoverage = (value, invert) => {
  GLctx.sampleCoverage(value, !!invert);
};

var _emscripten_glScissor = (x0, x1, x2, x3) => GLctx.scissor(x0, x1, x2, x3);

function _emscripten_glShaderBinary(count, shaders, binaryformat, binary, length) {
  shaders = bigintToI53Checked(shaders);
  binary = bigintToI53Checked(binary);
  GL.recordError(1280);
}

function _emscripten_glShaderSource(shader, count, string, length) {
  string = bigintToI53Checked(string);
  length = bigintToI53Checked(length);
  var source = GL.getSource(shader, count, string, length);
  GLctx.shaderSource(GL.shaders[shader], source);
}

var _emscripten_glStencilFunc = (x0, x1, x2) => GLctx.stencilFunc(x0, x1, x2);

var _emscripten_glStencilFuncSeparate = (x0, x1, x2, x3) => GLctx.stencilFuncSeparate(x0, x1, x2, x3);

var _emscripten_glStencilMask = x0 => GLctx.stencilMask(x0);

var _emscripten_glStencilMaskSeparate = (x0, x1) => GLctx.stencilMaskSeparate(x0, x1);

var _emscripten_glStencilOp = (x0, x1, x2) => GLctx.stencilOp(x0, x1, x2);

var _emscripten_glStencilOpSeparate = (x0, x1, x2, x3) => GLctx.stencilOpSeparate(x0, x1, x2, x3);

function _emscripten_glTexImage2D(target, level, internalFormat, width, height, border, format, type, pixels) {
  pixels = bigintToI53Checked(pixels);
  var pixelData = pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels) : null;
  GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixelData);
}

var _emscripten_glTexParameterf = (x0, x1, x2) => GLctx.texParameterf(x0, x1, x2);

function _emscripten_glTexParameterfv(target, pname, params) {
  params = bigintToI53Checked(params);
  var param = (growMemViews(), HEAPF32)[((params) / 4)];
  GLctx.texParameterf(target, pname, param);
}

var _emscripten_glTexParameteri = (x0, x1, x2) => GLctx.texParameteri(x0, x1, x2);

function _emscripten_glTexParameteriv(target, pname, params) {
  params = bigintToI53Checked(params);
  var param = (growMemViews(), HEAP32)[((params) / 4)];
  GLctx.texParameteri(target, pname, param);
}

function _emscripten_glTexSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels) {
  pixels = bigintToI53Checked(pixels);
  var pixelData = pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels) : null;
  GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData);
}

var webglGetUniformLocation = location => webglGetProgramUniformLocation(GLctx.currentProgram, location);

var _emscripten_glUniform1f = (location, v0) => {
  GLctx.uniform1f(webglGetUniformLocation(location), v0);
};

var miniTempWebGLFloatBuffers = [];

function _emscripten_glUniform1fv(location, count, value) {
  value = bigintToI53Checked(value);
  if (count <= 288) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; ++i) {
      view[i] = (growMemViews(), HEAPF32)[(((value) + (4 * i)) / 4)];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray(((value) / 4), ((value + count * 4) / 4));
  }
  GLctx.uniform1fv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform1i = (location, v0) => {
  GLctx.uniform1i(webglGetUniformLocation(location), v0);
};

var miniTempWebGLIntBuffers = [];

function _emscripten_glUniform1iv(location, count, value) {
  value = bigintToI53Checked(value);
  if (count <= 288) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLIntBuffers[count];
    for (var i = 0; i < count; ++i) {
      view[i] = (growMemViews(), HEAP32)[(((value) + (4 * i)) / 4)];
    }
  } else {
    var view = (growMemViews(), HEAP32).subarray(((value) / 4), ((value + count * 4) / 4));
  }
  GLctx.uniform1iv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform2f = (location, v0, v1) => {
  GLctx.uniform2f(webglGetUniformLocation(location), v0, v1);
};

function _emscripten_glUniform2fv(location, count, value) {
  value = bigintToI53Checked(value);
  if (count <= 144) {
    // avoid allocation when uploading few enough uniforms
    count *= 2;
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; i += 2) {
      view[i] = (growMemViews(), HEAPF32)[(((value) + (4 * i)) / 4)];
      view[i + 1] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 4)) / 4)];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray(((value) / 4), ((value + count * 8) / 4));
  }
  GLctx.uniform2fv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform2i = (location, v0, v1) => {
  GLctx.uniform2i(webglGetUniformLocation(location), v0, v1);
};

function _emscripten_glUniform2iv(location, count, value) {
  value = bigintToI53Checked(value);
  if (count <= 144) {
    // avoid allocation when uploading few enough uniforms
    count *= 2;
    var view = miniTempWebGLIntBuffers[count];
    for (var i = 0; i < count; i += 2) {
      view[i] = (growMemViews(), HEAP32)[(((value) + (4 * i)) / 4)];
      view[i + 1] = (growMemViews(), HEAP32)[(((value) + (4 * i + 4)) / 4)];
    }
  } else {
    var view = (growMemViews(), HEAP32).subarray(((value) / 4), ((value + count * 8) / 4));
  }
  GLctx.uniform2iv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform3f = (location, v0, v1, v2) => {
  GLctx.uniform3f(webglGetUniformLocation(location), v0, v1, v2);
};

function _emscripten_glUniform3fv(location, count, value) {
  value = bigintToI53Checked(value);
  if (count <= 96) {
    // avoid allocation when uploading few enough uniforms
    count *= 3;
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; i += 3) {
      view[i] = (growMemViews(), HEAPF32)[(((value) + (4 * i)) / 4)];
      view[i + 1] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 4)) / 4)];
      view[i + 2] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 8)) / 4)];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray(((value) / 4), ((value + count * 12) / 4));
  }
  GLctx.uniform3fv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform3i = (location, v0, v1, v2) => {
  GLctx.uniform3i(webglGetUniformLocation(location), v0, v1, v2);
};

function _emscripten_glUniform3iv(location, count, value) {
  value = bigintToI53Checked(value);
  if (count <= 96) {
    // avoid allocation when uploading few enough uniforms
    count *= 3;
    var view = miniTempWebGLIntBuffers[count];
    for (var i = 0; i < count; i += 3) {
      view[i] = (growMemViews(), HEAP32)[(((value) + (4 * i)) / 4)];
      view[i + 1] = (growMemViews(), HEAP32)[(((value) + (4 * i + 4)) / 4)];
      view[i + 2] = (growMemViews(), HEAP32)[(((value) + (4 * i + 8)) / 4)];
    }
  } else {
    var view = (growMemViews(), HEAP32).subarray(((value) / 4), ((value + count * 12) / 4));
  }
  GLctx.uniform3iv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform4f = (location, v0, v1, v2, v3) => {
  GLctx.uniform4f(webglGetUniformLocation(location), v0, v1, v2, v3);
};

function _emscripten_glUniform4fv(location, count, value) {
  value = bigintToI53Checked(value);
  if (count <= 72) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLFloatBuffers[4 * count];
    // hoist the heap out of the loop for size and for pthreads+growth.
    var heap = (growMemViews(), HEAPF32);
    value = ((value) / 4);
    count *= 4;
    for (var i = 0; i < count; i += 4) {
      var dst = value + i;
      view[i] = heap[dst];
      view[i + 1] = heap[dst + 1];
      view[i + 2] = heap[dst + 2];
      view[i + 3] = heap[dst + 3];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray(((value) / 4), ((value + count * 16) / 4));
  }
  GLctx.uniform4fv(webglGetUniformLocation(location), view);
}

var _emscripten_glUniform4i = (location, v0, v1, v2, v3) => {
  GLctx.uniform4i(webglGetUniformLocation(location), v0, v1, v2, v3);
};

function _emscripten_glUniform4iv(location, count, value) {
  value = bigintToI53Checked(value);
  if (count <= 72) {
    // avoid allocation when uploading few enough uniforms
    count *= 4;
    var view = miniTempWebGLIntBuffers[count];
    for (var i = 0; i < count; i += 4) {
      view[i] = (growMemViews(), HEAP32)[(((value) + (4 * i)) / 4)];
      view[i + 1] = (growMemViews(), HEAP32)[(((value) + (4 * i + 4)) / 4)];
      view[i + 2] = (growMemViews(), HEAP32)[(((value) + (4 * i + 8)) / 4)];
      view[i + 3] = (growMemViews(), HEAP32)[(((value) + (4 * i + 12)) / 4)];
    }
  } else {
    var view = (growMemViews(), HEAP32).subarray(((value) / 4), ((value + count * 16) / 4));
  }
  GLctx.uniform4iv(webglGetUniformLocation(location), view);
}

function _emscripten_glUniformMatrix2fv(location, count, transpose, value) {
  value = bigintToI53Checked(value);
  if (count <= 72) {
    // avoid allocation when uploading few enough uniforms
    count *= 4;
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; i += 4) {
      view[i] = (growMemViews(), HEAPF32)[(((value) + (4 * i)) / 4)];
      view[i + 1] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 4)) / 4)];
      view[i + 2] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 8)) / 4)];
      view[i + 3] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 12)) / 4)];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray(((value) / 4), ((value + count * 16) / 4));
  }
  GLctx.uniformMatrix2fv(webglGetUniformLocation(location), !!transpose, view);
}

function _emscripten_glUniformMatrix3fv(location, count, transpose, value) {
  value = bigintToI53Checked(value);
  if (count <= 32) {
    // avoid allocation when uploading few enough uniforms
    count *= 9;
    var view = miniTempWebGLFloatBuffers[count];
    for (var i = 0; i < count; i += 9) {
      view[i] = (growMemViews(), HEAPF32)[(((value) + (4 * i)) / 4)];
      view[i + 1] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 4)) / 4)];
      view[i + 2] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 8)) / 4)];
      view[i + 3] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 12)) / 4)];
      view[i + 4] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 16)) / 4)];
      view[i + 5] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 20)) / 4)];
      view[i + 6] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 24)) / 4)];
      view[i + 7] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 28)) / 4)];
      view[i + 8] = (growMemViews(), HEAPF32)[(((value) + (4 * i + 32)) / 4)];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray(((value) / 4), ((value + count * 36) / 4));
  }
  GLctx.uniformMatrix3fv(webglGetUniformLocation(location), !!transpose, view);
}

function _emscripten_glUniformMatrix4fv(location, count, transpose, value) {
  value = bigintToI53Checked(value);
  if (count <= 18) {
    // avoid allocation when uploading few enough uniforms
    var view = miniTempWebGLFloatBuffers[16 * count];
    // hoist the heap out of the loop for size and for pthreads+growth.
    var heap = (growMemViews(), HEAPF32);
    value = ((value) / 4);
    count *= 16;
    for (var i = 0; i < count; i += 16) {
      var dst = value + i;
      view[i] = heap[dst];
      view[i + 1] = heap[dst + 1];
      view[i + 2] = heap[dst + 2];
      view[i + 3] = heap[dst + 3];
      view[i + 4] = heap[dst + 4];
      view[i + 5] = heap[dst + 5];
      view[i + 6] = heap[dst + 6];
      view[i + 7] = heap[dst + 7];
      view[i + 8] = heap[dst + 8];
      view[i + 9] = heap[dst + 9];
      view[i + 10] = heap[dst + 10];
      view[i + 11] = heap[dst + 11];
      view[i + 12] = heap[dst + 12];
      view[i + 13] = heap[dst + 13];
      view[i + 14] = heap[dst + 14];
      view[i + 15] = heap[dst + 15];
    }
  } else {
    var view = (growMemViews(), HEAPF32).subarray(((value) / 4), ((value + count * 64) / 4));
  }
  GLctx.uniformMatrix4fv(webglGetUniformLocation(location), !!transpose, view);
}

var _emscripten_glUseProgram = program => {
  program = GL.programs[program];
  GLctx.useProgram(program);
  // Record the currently active program so that we can access the uniform
  // mapping table of that program.
  GLctx.currentProgram = program;
};

var _emscripten_glValidateProgram = program => {
  GLctx.validateProgram(GL.programs[program]);
};

var _emscripten_glVertexAttrib1f = (x0, x1) => GLctx.vertexAttrib1f(x0, x1);

function _emscripten_glVertexAttrib1fv(index, v) {
  v = bigintToI53Checked(v);
  GLctx.vertexAttrib1f(index, (growMemViews(), HEAPF32)[v >> 2]);
}

var _emscripten_glVertexAttrib2f = (x0, x1, x2) => GLctx.vertexAttrib2f(x0, x1, x2);

function _emscripten_glVertexAttrib2fv(index, v) {
  v = bigintToI53Checked(v);
  GLctx.vertexAttrib2f(index, (growMemViews(), HEAPF32)[v >> 2], (growMemViews(), 
  HEAPF32)[v + 4 >> 2]);
}

var _emscripten_glVertexAttrib3f = (x0, x1, x2, x3) => GLctx.vertexAttrib3f(x0, x1, x2, x3);

function _emscripten_glVertexAttrib3fv(index, v) {
  v = bigintToI53Checked(v);
  GLctx.vertexAttrib3f(index, (growMemViews(), HEAPF32)[v >> 2], (growMemViews(), 
  HEAPF32)[v + 4 >> 2], (growMemViews(), HEAPF32)[v + 8 >> 2]);
}

var _emscripten_glVertexAttrib4f = (x0, x1, x2, x3, x4) => GLctx.vertexAttrib4f(x0, x1, x2, x3, x4);

function _emscripten_glVertexAttrib4fv(index, v) {
  v = bigintToI53Checked(v);
  GLctx.vertexAttrib4f(index, (growMemViews(), HEAPF32)[v >> 2], (growMemViews(), 
  HEAPF32)[v + 4 >> 2], (growMemViews(), HEAPF32)[v + 8 >> 2], (growMemViews(), HEAPF32)[v + 12 >> 2]);
}

var _emscripten_glVertexAttribDivisor = (index, divisor) => {
  GLctx.vertexAttribDivisor(index, divisor);
};

var _emscripten_glVertexAttribDivisorANGLE = _emscripten_glVertexAttribDivisor;

function _emscripten_glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
  ptr = bigintToI53Checked(ptr);
  GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
}

var _emscripten_glViewport = (x0, x1, x2, x3) => GLctx.viewport(x0, x1, x2, x3);

var _emscripten_has_asyncify = () => 0;

var _emscripten_num_logical_cores = () => navigator["hardwareConcurrency"];

function _emscripten_out(str) {
  str = bigintToI53Checked(str);
  return out(UTF8ToString(str));
}

var doRequestFullscreen = (target, strategy) => {
  if (!JSEvents.fullscreenEnabled()) return -1;
  target = findEventTarget(target);
  if (!target) return -4;
  if (!target.requestFullscreen) {
    return -3;
  }
  // Queue this function call if we're not currently in an event handler and
  // the user saw it appropriate to do so.
  if (!JSEvents.canPerformEventHandlerRequests()) {
    if (strategy.deferUntilInEventHandler) {
      JSEvents.deferCall(JSEvents_requestFullscreen, 1, [ target, strategy ]);
      return 1;
    }
    return -2;
  }
  return JSEvents_requestFullscreen(target, strategy);
};

function _emscripten_request_fullscreen_strategy(target, deferUntilInEventHandler, fullscreenStrategy) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(13, 0, 1, target, deferUntilInEventHandler, fullscreenStrategy);
  target = bigintToI53Checked(target);
  fullscreenStrategy = bigintToI53Checked(fullscreenStrategy);
  var strategy = {
    scaleMode: (growMemViews(), HEAP32)[((fullscreenStrategy) / 4)],
    canvasResolutionScaleMode: (growMemViews(), HEAP32)[(((fullscreenStrategy) + (4)) / 4)],
    filteringMode: (growMemViews(), HEAP32)[(((fullscreenStrategy) + (8)) / 4)],
    deferUntilInEventHandler,
    canvasResizedCallbackTargetThread: (growMemViews(), HEAP32)[(((fullscreenStrategy) + (32)) / 4)],
    canvasResizedCallback: (growMemViews(), HEAP32)[(((fullscreenStrategy) + (16)) / 4)],
    canvasResizedCallbackUserData: (growMemViews(), HEAP32)[(((fullscreenStrategy) + (24)) / 4)]
  };
  return doRequestFullscreen(target, strategy);
}

function _emscripten_request_pointerlock(target, deferUntilInEventHandler) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(14, 0, 1, target, deferUntilInEventHandler);
  target = bigintToI53Checked(target);
  target = findEventTarget(target);
  if (!target) return -4;
  if (!target.requestPointerLock) {
    return -1;
  }
  // Queue this function call if we're not currently in an event handler and
  // the user saw it appropriate to do so.
  if (!JSEvents.canPerformEventHandlerRequests()) {
    if (deferUntilInEventHandler) {
      JSEvents.deferCall(requestPointerLock, 2, [ target ]);
      return 1;
    }
    return -2;
  }
  return requestPointerLock(target);
}

var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;

var growMemory = size => {
  var oldHeapSize = wasmMemory.buffer.byteLength;
  var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
  try {
    // round size grow request up to wasm page size (fixed 64KB per spec)
    wasmMemory.grow(BigInt(pages));
    // .grow() takes a delta compared to the previous size
    updateMemoryViews();
    return 1;
  } catch (e) {}
};

function _emscripten_resize_heap(requestedSize) {
  requestedSize = bigintToI53Checked(requestedSize);
  var oldSize = (growMemViews(), HEAPU8).length;
  // With multithreaded builds, races can happen (another thread might increase the size
  // in between), so return a failure, and let the caller retry.
  if (requestedSize <= oldSize) {
    return false;
  }
  // Memory resize rules:
  // 1.  Always increase heap size to at least the requested size, rounded up
  //     to next page multiple.
  // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
  //     geometrically: increase the heap size according to
  //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
  //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
  // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
  //     linearly: increase the heap size by at least
  //     MEMORY_GROWTH_LINEAR_STEP bytes.
  // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
  //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
  // 4.  If we were unable to allocate as much memory, it may be due to
  //     over-eager decision to excessively reserve due to (3) above.
  //     Hence if an allocation fails, cut down on the amount of excess
  //     growth, in an attempt to succeed to perform a smaller allocation.
  // A limit is set for how much we can grow. We should not exceed that
  // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
  var maxHeapSize = getHeapMax();
  if (requestedSize > maxHeapSize) {
    return false;
  }
  // Loop through potential heap size increases. If we attempt a too eager
  // reservation that fails, cut down on the attempted size and reserve a
  // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
  for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
    var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
    // ensure geometric growth
    // but limit overreserving (default to capping at +96MB overgrowth at most)
    overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
    var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
    var replacement = growMemory(newSize);
    if (replacement) {
      return true;
    }
  }
  return false;
}

var _emscripten_runtime_keepalive_check = keepRuntimeAlive;

/** @suppress {checkTypes} */ function _emscripten_sample_gamepad_data() {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(15, 0, 1);
  try {
    if (navigator.getGamepads) return (JSEvents.lastGamepadState = navigator.getGamepads()) ? 0 : -1;
  } catch (e) {
    navigator.getGamepads = null;
  }
  return -1;
}

var registerBeforeUnloadEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString) => {
  var beforeUnloadEventHandlerFunc = e => {
    // Note: This is always called on the main browser thread, since it needs synchronously return a value!
    var confirmationMessage = (((a1, a2, a3) => Number(getWasmTableEntry(callbackfunc).call(null, a1, BigInt(a2), BigInt(a3)))))(eventTypeId, 0, userData);
    if (confirmationMessage) {
      confirmationMessage = UTF8ToString(confirmationMessage);
    }
    if (confirmationMessage) {
      e.preventDefault();
      e.returnValue = confirmationMessage;
      return confirmationMessage;
    }
  };
  var eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: beforeUnloadEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_beforeunload_callback_on_thread(userData, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(16, 0, 1, userData, callbackfunc, targetThread);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  if (typeof onbeforeunload === "undefined") return -1;
  // beforeunload callback can only be registered on the main browser thread, because the page will go away immediately after returning from the handler,
  // and there is no time to start proxying it anywhere.
  if (targetThread !== 1) return -5;
  return registerBeforeUnloadEventCallback(2, userData, true, callbackfunc, 28, "beforeunload");
}

var registerFocusEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  const eventSize = 256;
  JSEvents.focusEvent ||= _malloc(eventSize);
  var focusEventHandlerFunc = e => {
    var nodeName = JSEvents.getNodeNameForTarget(e.target);
    var id = e.target.id ?? "";
    var focusEvent = JSEvents.focusEvent;
    stringToUTF8(nodeName, focusEvent + 0, 128);
    stringToUTF8(id, focusEvent + 128, 128);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, focusEvent, eventSize, userData); else if ((((a1, a2, a3) => getWasmTableEntry(callbackfunc).call(null, a1, BigInt(a2), BigInt(a3))))(eventTypeId, focusEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: focusEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_blur_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(17, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target = bigintToI53Checked(target);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  return registerFocusEventCallback(target, userData, useCapture, callbackfunc, 12, "blur", targetThread);
}

function _emscripten_set_element_css_size(target, width, height) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(18, 0, 1, target, width, height);
  target = bigintToI53Checked(target);
  target = findEventTarget(target);
  if (!target) return -4;
  target.style.width = width + "px";
  target.style.height = height + "px";
  return 0;
}

function _emscripten_set_focus_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(19, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target = bigintToI53Checked(target);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  return registerFocusEventCallback(target, userData, useCapture, callbackfunc, 13, "focus", targetThread);
}

var registerFullscreenChangeEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  const eventSize = 276;
  JSEvents.fullscreenChangeEvent ||= _malloc(eventSize);
  var fullscreenChangeEventHandlerFunc = e => {
    var fullscreenChangeEvent = JSEvents.fullscreenChangeEvent;
    fillFullscreenChangeEventData(fullscreenChangeEvent);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, fullscreenChangeEvent, eventSize, userData); else if ((((a1, a2, a3) => getWasmTableEntry(callbackfunc).call(null, a1, BigInt(a2), BigInt(a3))))(eventTypeId, fullscreenChangeEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: fullscreenChangeEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_fullscreenchange_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(20, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target = bigintToI53Checked(target);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  if (!JSEvents.fullscreenEnabled()) return -1;
  target = findEventTarget(target);
  if (!target) return -4;
  return registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, 19, "fullscreenchange", targetThread);
}

var registerGamepadEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  const eventSize = 1240;
  JSEvents.gamepadEvent ||= _malloc(eventSize);
  var gamepadEventHandlerFunc = e => {
    var gamepadEvent = JSEvents.gamepadEvent;
    fillGamepadEventData(gamepadEvent, e["gamepad"]);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, gamepadEvent, eventSize, userData); else if ((((a1, a2, a3) => getWasmTableEntry(callbackfunc).call(null, a1, BigInt(a2), BigInt(a3))))(eventTypeId, gamepadEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target: findEventTarget(target),
    allowsDeferredCalls: true,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: gamepadEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_gamepadconnected_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(21, 0, 1, userData, useCapture, callbackfunc, targetThread);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  if (_emscripten_sample_gamepad_data()) return -1;
  return registerGamepadEventCallback(2, userData, useCapture, callbackfunc, 26, "gamepadconnected", targetThread);
}

function _emscripten_set_gamepaddisconnected_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(22, 0, 1, userData, useCapture, callbackfunc, targetThread);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  if (_emscripten_sample_gamepad_data()) return -1;
  return registerGamepadEventCallback(2, userData, useCapture, callbackfunc, 27, "gamepaddisconnected", targetThread);
}

var registerKeyEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  const eventSize = 160;
  JSEvents.keyEvent ||= _malloc(eventSize);
  var keyEventHandlerFunc = e => {
    var keyEventData = JSEvents.keyEvent;
    (growMemViews(), HEAPF64)[((keyEventData) / 8)] = e.timeStamp;
    var idx = ((keyEventData) / 4);
    (growMemViews(), HEAP32)[idx + 2] = e.location;
    (growMemViews(), HEAP8)[keyEventData + 12] = e.ctrlKey;
    (growMemViews(), HEAP8)[keyEventData + 13] = e.shiftKey;
    (growMemViews(), HEAP8)[keyEventData + 14] = e.altKey;
    (growMemViews(), HEAP8)[keyEventData + 15] = e.metaKey;
    (growMemViews(), HEAP8)[keyEventData + 16] = e.repeat;
    (growMemViews(), HEAP32)[idx + 5] = e.charCode;
    (growMemViews(), HEAP32)[idx + 6] = e.keyCode;
    (growMemViews(), HEAP32)[idx + 7] = e.which;
    stringToUTF8(e.key ?? "", keyEventData + 32, 32);
    stringToUTF8(e.code ?? "", keyEventData + 64, 32);
    stringToUTF8(e.char ?? "", keyEventData + 96, 32);
    stringToUTF8(e.locale ?? "", keyEventData + 128, 32);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, keyEventData, eventSize, userData); else if ((((a1, a2, a3) => getWasmTableEntry(callbackfunc).call(null, a1, BigInt(a2), BigInt(a3))))(eventTypeId, keyEventData, userData)) e.preventDefault();
  };
  var eventHandler = {
    target: findEventTarget(target),
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: keyEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_keydown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(23, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target = bigintToI53Checked(target);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  return registerKeyEventCallback(target, userData, useCapture, callbackfunc, 2, "keydown", targetThread);
}

function _emscripten_set_keypress_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(24, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target = bigintToI53Checked(target);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  return registerKeyEventCallback(target, userData, useCapture, callbackfunc, 1, "keypress", targetThread);
}

function _emscripten_set_keyup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(25, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target = bigintToI53Checked(target);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  return registerKeyEventCallback(target, userData, useCapture, callbackfunc, 3, "keyup", targetThread);
}

var screenOrientation = () => window.screen?.orientation;

var fillOrientationChangeEventData = eventStruct => {
  // OrientationType enum
  var orientationsType1 = [ "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary" ];
  // alternative selection from OrientationLockType enum
  var orientationsType2 = [ "portrait", "portrait", "landscape", "landscape" ];
  var orientationIndex = 0;
  var orientationAngle = 0;
  var screenOrientObj = screenOrientation();
  if (screenOrientObj) {
    orientationIndex = orientationsType1.indexOf(screenOrientObj.type);
    if (orientationIndex < 0) {
      orientationIndex = orientationsType2.indexOf(screenOrientObj.type);
    }
    if (orientationIndex >= 0) {
      orientationIndex = 1 << orientationIndex;
    }
    orientationAngle = screenOrientObj.angle;
  }
  (growMemViews(), HEAP32)[((eventStruct) / 4)] = orientationIndex;
  (growMemViews(), HEAP32)[(((eventStruct) + (4)) / 4)] = orientationAngle;
};

var registerOrientationChangeEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  const eventSize = 8;
  JSEvents.orientationChangeEvent ||= _malloc(eventSize);
  var orientationChangeEventHandlerFunc = e => {
    var orientationChangeEvent = JSEvents.orientationChangeEvent;
    fillOrientationChangeEventData(orientationChangeEvent);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, orientationChangeEvent, eventSize, userData); else if ((((a1, a2, a3) => getWasmTableEntry(callbackfunc).call(null, a1, BigInt(a2), BigInt(a3))))(eventTypeId, orientationChangeEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: orientationChangeEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_orientationchange_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(26, 0, 1, userData, useCapture, callbackfunc, targetThread);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  if (!window.screen || !screen.orientation) return -1;
  return registerOrientationChangeEventCallback(screen.orientation, userData, useCapture, callbackfunc, 18, "change", targetThread);
}

var fillPointerlockChangeEventData = eventStruct => {
  var pointerLockElement = document.pointerLockElement;
  var isPointerlocked = !!pointerLockElement;
  // Assigning a boolean to HEAP32 with expected type coercion.
  /** @suppress{checkTypes} */ (growMemViews(), HEAP8)[eventStruct] = isPointerlocked;
  var nodeName = JSEvents.getNodeNameForTarget(pointerLockElement);
  var id = pointerLockElement?.id ?? "";
  stringToUTF8(nodeName, eventStruct + 1, 128);
  stringToUTF8(id, eventStruct + 129, 128);
};

var registerPointerlockChangeEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  const eventSize = 257;
  JSEvents.pointerlockChangeEvent ||= _malloc(eventSize);
  var pointerlockChangeEventHandlerFunc = e => {
    var pointerlockChangeEvent = JSEvents.pointerlockChangeEvent;
    fillPointerlockChangeEventData(pointerlockChangeEvent);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, pointerlockChangeEvent, eventSize, userData); else if ((((a1, a2, a3) => getWasmTableEntry(callbackfunc).call(null, a1, BigInt(a2), BigInt(a3))))(eventTypeId, pointerlockChangeEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: pointerlockChangeEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_pointerlockchange_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(27, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target = bigintToI53Checked(target);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  if (!document.body?.requestPointerLock) {
    return -1;
  }
  target = findEventTarget(target);
  if (!target) return -4;
  return registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "pointerlockchange", targetThread);
}

var registerUiEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  const eventSize = 36;
  JSEvents.uiEvent ||= _malloc(eventSize);
  target = findEventTarget(target);
  var uiEventHandlerFunc = e => {
    if (e.target != target) {
      // Never take ui events such as scroll via a 'bubbled' route, but always from the direct element that
      // was targeted. Otherwise e.g. if app logs a message in response to a page scroll, the Emscripten log
      // message box could cause to scroll, generating a new (bubbled) scroll message, causing a new log print,
      // causing a new scroll, etc..
      return;
    }
    var b = document.body;
    // Take document.body to a variable, Closure compiler does not outline access to it on its own.
    if (!b) {
      // During a page unload 'body' can be null, with "Cannot read property 'clientWidth' of null" being thrown
      return;
    }
    var uiEvent = JSEvents.uiEvent;
    (growMemViews(), HEAP32)[((uiEvent) / 4)] = 0;
    // always zero for resize and scroll
    (growMemViews(), HEAP32)[(((uiEvent) + (4)) / 4)] = b.clientWidth;
    (growMemViews(), HEAP32)[(((uiEvent) + (8)) / 4)] = b.clientHeight;
    (growMemViews(), HEAP32)[(((uiEvent) + (12)) / 4)] = innerWidth;
    (growMemViews(), HEAP32)[(((uiEvent) + (16)) / 4)] = innerHeight;
    (growMemViews(), HEAP32)[(((uiEvent) + (20)) / 4)] = outerWidth;
    (growMemViews(), HEAP32)[(((uiEvent) + (24)) / 4)] = outerHeight;
    (growMemViews(), HEAP32)[(((uiEvent) + (28)) / 4)] = pageXOffset | 0;
    // scroll offsets are float
    (growMemViews(), HEAP32)[(((uiEvent) + (32)) / 4)] = pageYOffset | 0;
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, uiEvent, eventSize, userData); else if ((((a1, a2, a3) => getWasmTableEntry(callbackfunc).call(null, a1, BigInt(a2), BigInt(a3))))(eventTypeId, uiEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: uiEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_resize_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(28, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target = bigintToI53Checked(target);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  return registerUiEventCallback(target, userData, useCapture, callbackfunc, 10, "resize", targetThread);
}

var _emscripten_set_timeout = function(cb, msecs, userData) {
  cb = bigintToI53Checked(cb);
  userData = bigintToI53Checked(userData);
  return safeSetTimeout(() => ((a1 => getWasmTableEntry(cb).call(null, BigInt(a1))))(userData), msecs);
};

var fillVisibilityChangeEventData = eventStruct => {
  var visibilityStates = [ "hidden", "visible", "prerender", "unloaded" ];
  var visibilityState = visibilityStates.indexOf(document.visibilityState);
  // Assigning a boolean to HEAP32 with expected type coercion.
  /** @suppress{checkTypes} */ (growMemViews(), HEAP8)[eventStruct] = document.hidden;
  (growMemViews(), HEAP32)[(((eventStruct) + (4)) / 4)] = visibilityState;
};

var registerVisibilityChangeEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  const eventSize = 8;
  JSEvents.visibilityChangeEvent ||= _malloc(eventSize);
  var visibilityChangeEventHandlerFunc = e => {
    var visibilityChangeEvent = JSEvents.visibilityChangeEvent;
    fillVisibilityChangeEventData(visibilityChangeEvent);
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, visibilityChangeEvent, eventSize, userData); else if ((((a1, a2, a3) => getWasmTableEntry(callbackfunc).call(null, a1, BigInt(a2), BigInt(a3))))(eventTypeId, visibilityChangeEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: visibilityChangeEventHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_visibilitychange_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(29, 0, 1, userData, useCapture, callbackfunc, targetThread);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  if (!specialHTMLTargets[1]) {
    return -4;
  }
  return registerVisibilityChangeEventCallback(specialHTMLTargets[1], userData, useCapture, callbackfunc, 21, "visibilitychange", targetThread);
}

/** @type {!Int16Array} */ var HEAP16;

var fillMouseEventData = (eventStruct, e, target) => {
  (growMemViews(), HEAPF64)[((eventStruct) / 8)] = e.timeStamp;
  var idx = ((eventStruct) / 4);
  (growMemViews(), HEAP32)[idx + 2] = e.screenX;
  (growMemViews(), HEAP32)[idx + 3] = e.screenY;
  (growMemViews(), HEAP32)[idx + 4] = e.clientX;
  (growMemViews(), HEAP32)[idx + 5] = e.clientY;
  (growMemViews(), HEAP8)[eventStruct + 24] = e.ctrlKey;
  (growMemViews(), HEAP8)[eventStruct + 25] = e.shiftKey;
  (growMemViews(), HEAP8)[eventStruct + 26] = e.altKey;
  (growMemViews(), HEAP8)[eventStruct + 27] = e.metaKey;
  (growMemViews(), HEAP16)[idx * 2 + 14] = e.button;
  (growMemViews(), HEAP16)[idx * 2 + 15] = e.buttons;
  (growMemViews(), HEAP32)[idx + 8] = e.movementX;
  (growMemViews(), HEAP32)[idx + 9] = e.movementY;
  // Note: rect contains doubles (truncated to placate SAFE_HEAP, which is the same behaviour when writing to HEAP32 anyway)
  var rect = getBoundingClientRect(target);
  (growMemViews(), HEAP32)[idx + 10] = e.clientX - (rect.left | 0);
  (growMemViews(), HEAP32)[idx + 11] = e.clientY - (rect.top | 0);
};

var registerWheelEventCallback = (target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) => {
  targetThread = JSEvents.getTargetThreadForEventCallback(targetThread);
  const eventSize = 96;
  JSEvents.wheelEvent ||= _malloc(eventSize);
  // The DOM Level 3 events spec event 'wheel'
  var wheelHandlerFunc = e => {
    var wheelEvent = JSEvents.wheelEvent;
    fillMouseEventData(wheelEvent, e, target);
    (growMemViews(), HEAPF64)[(((wheelEvent) + (64)) / 8)] = e["deltaX"];
    (growMemViews(), HEAPF64)[(((wheelEvent) + (72)) / 8)] = e["deltaY"];
    (growMemViews(), HEAPF64)[(((wheelEvent) + (80)) / 8)] = e["deltaZ"];
    (growMemViews(), HEAP32)[(((wheelEvent) + (88)) / 4)] = e["deltaMode"];
    if (targetThread) __emscripten_run_callback_on_thread(targetThread, callbackfunc, eventTypeId, wheelEvent, eventSize, userData); else if ((((a1, a2, a3) => getWasmTableEntry(callbackfunc).call(null, a1, BigInt(a2), BigInt(a3))))(eventTypeId, wheelEvent, userData)) e.preventDefault();
  };
  var eventHandler = {
    target,
    allowsDeferredCalls: true,
    eventTypeString,
    eventTypeId,
    userData,
    callbackfunc,
    handlerFunc: wheelHandlerFunc,
    useCapture
  };
  return JSEvents.registerOrRemoveHandler(eventHandler);
};

function _emscripten_set_wheel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(30, 0, 1, target, userData, useCapture, callbackfunc, targetThread);
  target = bigintToI53Checked(target);
  userData = bigintToI53Checked(userData);
  callbackfunc = bigintToI53Checked(callbackfunc);
  targetThread = bigintToI53Checked(targetThread);
  target = findEventTarget(target);
  if (!target) return -4;
  if (typeof target.onwheel !== "undefined") {
    return registerWheelEventCallback(target, userData, useCapture, callbackfunc, 9, "wheel", targetThread);
  } else {
    return -1;
  }
}

function _emscripten_set_window_title(title) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(31, 0, 1, title);
  title = bigintToI53Checked(title);
  return document.title = 'game';
}

var _emscripten_sleep = () => {
  abort("Please compile your program with async support in order to use asynchronous operations like emscripten_sleep");
};

var _emscripten_unwind_to_js_event_loop = () => {
  throw "unwind";
};

var registerPreMainLoop = f => {
  // Does nothing unless $MainLoop is included/used.
  typeof MainLoop !== "undefined" && MainLoop.preMainLoop.push(f);
};

var _emscripten_supports_offscreencanvas = () => // TODO: Add a new build mode, e.g. OFFSCREENCANVAS_SUPPORT=2, which
// necessitates OffscreenCanvas support at build time, and "return 1;" here in that build mode.
typeof OffscreenCanvas !== "undefined";

var webglPowerPreferences = [ "default", "low-power", "high-performance" ];

var _emscripten_webgl_do_create_context = function(target, attributes) {
  target = bigintToI53Checked(target);
  attributes = bigintToI53Checked(attributes);
  var ret = ((() => {
    var attr32 = ((attributes) / 4);
    var powerPreference = (growMemViews(), HEAP32)[attr32 + (8 >> 2)];
    var contextAttributes = {
      "alpha": !!(growMemViews(), HEAP8)[attributes + 0],
      "depth": !!(growMemViews(), HEAP8)[attributes + 1],
      "stencil": !!(growMemViews(), HEAP8)[attributes + 2],
      "antialias": !!(growMemViews(), HEAP8)[attributes + 3],
      "premultipliedAlpha": !!(growMemViews(), HEAP8)[attributes + 4],
      "preserveDrawingBuffer": !!(growMemViews(), HEAP8)[attributes + 5],
      "powerPreference": webglPowerPreferences[powerPreference],
      "failIfMajorPerformanceCaveat": !!(growMemViews(), HEAP8)[attributes + 12],
      "desynchronized": !!(growMemViews(), HEAP8)[attributes + 33],
      // The following are not predefined WebGL context attributes in the WebGL specification, so the property names can be minified by Closure.
      majorVersion: (growMemViews(), HEAP32)[attr32 + (16 >> 2)],
      minorVersion: (growMemViews(), HEAP32)[attr32 + (20 >> 2)],
      enableExtensionsByDefault: (growMemViews(), HEAP8)[attributes + 24],
      explicitSwapControl: (growMemViews(), HEAP8)[attributes + 25],
      proxyContextToMainThread: (growMemViews(), HEAP32)[attr32 + (28 >> 2)],
      renderViaOffscreenBackBuffer: (growMemViews(), HEAP8)[attributes + 32]
    };
    var canvas = findCanvasEventTarget(target);
    // If our canvas from findCanvasEventTarget is actually an offscreen canvas record, we should extract the inner canvas.
    if (canvas?.canvas) {
      canvas = canvas.canvas;
    }
    if (!canvas) {
      return 0;
    }
    if (canvas.offscreenCanvas) canvas = canvas.offscreenCanvas;
    if (contextAttributes.explicitSwapControl) {
      var supportsOffscreenCanvas = canvas.transferControlToOffscreen || (_emscripten_supports_offscreencanvas() && canvas instanceof OffscreenCanvas);
      if (!supportsOffscreenCanvas) {
        return 0;
      }
      if (canvas.transferControlToOffscreen) {
        if (!canvas.controlTransferredOffscreen) {
          GL.offscreenCanvases[canvas.id] = {
            canvas: canvas.transferControlToOffscreen(),
            canvasSharedPtr: _malloc(12),
            id: canvas.id
          };
          canvas.controlTransferredOffscreen = true;
        } else if (!GL.offscreenCanvases[canvas.id]) {
          return 0;
        }
        canvas = GL.offscreenCanvases[canvas.id].canvas;
      }
    }
    var contextHandle = GL.createContext(canvas, contextAttributes);
    return contextHandle;
  }))();
  return BigInt(ret);
};

var _emscripten_webgl_create_context = _emscripten_webgl_do_create_context;

var _emscripten_webgl_do_destroy_context_calling_thread = contextHandle => {
  if (GL.currentContext == contextHandle) GL.currentContext = 0;
  GL.deleteContext(contextHandle);
};

var _emscripten_webgl_do_destroy_context_main_thread = _emscripten_webgl_do_destroy_context_calling_thread;

function _emscripten_webgl_do_destroy_context(p0) {
  p0 = bigintToI53Checked(p0);
  return GL.contexts[p0] ? _emscripten_webgl_do_destroy_context_calling_thread(p0) : _emscripten_webgl_do_destroy_context_main_thread(p0);
}

var _emscripten_webgl_destroy_context = _emscripten_webgl_do_destroy_context;

function _emscripten_webgl_make_context_current(contextHandle) {
  contextHandle = bigintToI53Checked(contextHandle);
  var success = GL.makeContextCurrent(contextHandle);
  return success ? 0 : -5;
}

var ENV = {};

var getExecutableName = () => thisProgram;

var getEnvStrings = () => {
  if (!getEnvStrings.strings) {
    // Default values.
    var lang = (globalThis.navigator?.language ?? "C").replace("-", "_") + ".UTF-8";
    var env = {
      "USER": "web_user",
      "LOGNAME": "web_user",
      "PATH": "/",
      "PWD": "/",
      "HOME": "/home/web_user",
      "LANG": lang,
      "_": getExecutableName()
    };
    // Apply the user-provided values, if any.
    for (var x in ENV) {
      // x is a key in ENV; if ENV[x] is undefined, that means it was
      // explicitly set to be so. We allow user code to do that to
      // force variables with default values to remain unset.
      if (ENV[x] === undefined) delete env[x]; else env[x] = ENV[x];
    }
    var strings = [];
    for (var x in env) {
      strings.push(`${x}=${env[x]}`);
    }
    getEnvStrings.strings = strings;
  }
  return getEnvStrings.strings;
};

function _environ_get(__environ, environ_buf) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(32, 0, 1, __environ, environ_buf);
  __environ = bigintToI53Checked(__environ);
  environ_buf = bigintToI53Checked(environ_buf);
  var bufSize = 0;
  var envp = 0;
  for (var string of getEnvStrings()) {
    var ptr = environ_buf + bufSize;
    (growMemViews(), HEAPU64)[(((__environ) + (envp)) / 8)] = BigInt(ptr);
    bufSize += stringToUTF8(string, ptr, Infinity) + 1;
    envp += 8;
  }
  return 0;
}

function _environ_sizes_get(penviron_count, penviron_buf_size) {
  if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(33, 0, 1, penviron_count, penviron_buf_size);
  penviron_count = bigintToI53Checked(penviron_count);
  penviron_buf_size = bigintToI53Checked(penviron_buf_size);
  var strings = getEnvStrings();
  (growMemViews(), HEAPU64)[((penviron_count) / 8)] = BigInt(strings.length);
  var bufSize = 0;
  for (var string of strings) {
    bufSize += lengthBytesUTF8(string) + 1;
  }
  (growMemViews(), HEAPU64)[((penviron_buf_size) / 8)] = BigInt(bufSize);
  return 0;
}

var initRandomFill = () => view => (view.set(crypto.getRandomValues(new Uint8Array(view.byteLength))), 
0);

var randomFill = view => (randomFill = initRandomFill())(view);

function _random_get(buffer, size) {
  buffer = bigintToI53Checked(buffer);
  size = bigintToI53Checked(size);
  return randomFill((growMemViews(), HEAPU8).subarray(buffer, buffer + size));
}

var autoResumeAudioContext = ctx => {
  for (var event of [ "keydown", "mousedown", "touchstart" ]) {
    for (var element of [ document, document.getElementById("canvas") ]) {
      element?.addEventListener(event, () => {
        if (ctx.state === "suspended") ctx.resume();
      }, {
        "once": true
      });
    }
  }
};

var dynCall = (sig, ptr, args = [], promising = false) => {
  // With MEMORY64 we have an additional step to convert `p` arguments to
  // bigint. This is the runtime equivalent of the wrappers we create for wasm
  // exports in `emscripten.py:create_wasm64_wrappers`.
  for (var i = 1; i < sig.length; ++i) {
    if (sig[i] == "p") args[i - 1] = BigInt(args[i - 1]);
  }
  var func = getWasmTableEntry(ptr);
  var rtn = func(...args);
  function convert(rtn) {
    return sig[0] == "p" ? Number(rtn) : rtn;
  }
  return convert(rtn);
};

var PATH = {
  isAbs: path => path.charAt(0) === "/",
  splitPath: filename => {
    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    return splitPathRe.exec(filename).slice(1);
  },
  normalizeArray: (parts, allowAboveRoot) => {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === ".") {
        parts.splice(i, 1);
      } else if (last === "..") {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }
    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (;up; up--) {
        parts.unshift("..");
      }
    }
    return parts;
  },
  normalize: path => {
    var isAbsolute = PATH.isAbs(path), trailingSlash = path.slice(-1) === "/";
    // Normalize the path
    path = PATH.normalizeArray(path.split("/").filter(p => !!p), !isAbsolute).join("/");
    if (!path && !isAbsolute) {
      path = ".";
    }
    if (path && trailingSlash) {
      path += "/";
    }
    return (isAbsolute ? "/" : "") + path;
  },
  dirname: path => {
    var result = PATH.splitPath(path), root = result[0], dir = result[1];
    if (!root && !dir) {
      // No dirname whatsoever
      return ".";
    }
    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.slice(0, -1);
    }
    return root + dir;
  },
  basename: path => path && path.match(/([^\/]+|\/)\/*$/)[1],
  join: (...paths) => PATH.normalize(paths.join("/")),
  join2: (l, r) => PATH.normalize(l + "/" + r)
};

var withStackSave = f => {
  var stack = stackSave();
  var ret = f();
  stackRestore(stack);
  return ret;
};

var readI53FromI64 = ptr => (growMemViews(), HEAPU32)[((ptr) / 4)] + (growMemViews(), 
HEAP32)[(((ptr) + (4)) / 4)] * 4294967296;

var readI53FromU64 = ptr => (growMemViews(), HEAPU32)[((ptr) / 4)] + (growMemViews(), 
HEAPU32)[(((ptr) + (4)) / 4)] * 4294967296;

var FS_mknod = (path, mode, dev) => FS.handleError(withStackSave(() => {
  var pathBuffer = stringToUTF8OnStack(path);
  return __wasmfs_mknod(pathBuffer, mode, dev);
}));

var FS_create = (path, mode = 438) => {
  mode &= 4095;
  mode |= 32768;
  return FS_mknod(path, mode, 0);
};

var FS_fileDataToTypedArray = data => {
  if (typeof data === "string") {
    data = intArrayFromString(data, true);
  }
  if (!data.subarray) {
    data = new Uint8Array(data);
  }
  return data;
};

var FS_writeFile = (path, data) => {
  var sp = stackSave();
  var pathBuffer = stringToUTF8OnStack(path);
  data = FS_fileDataToTypedArray(data);
  var len = data.length;
  var dataBuffer = _malloc(len);
  (growMemViews(), HEAPU8).set(data, dataBuffer);
  var ret = __wasmfs_write_file(pathBuffer, dataBuffer, len);
  _free(dataBuffer);
  stackRestore(sp);
  return ret;
};

var FS_createDataFile = (parent, name, fileData, canRead, canWrite, canOwn) => {
  var pathName = name ? parent + "/" + name : parent;
  var mode = FS_getMode(canRead, canWrite);
  if (!wasmFSPreloadingFlushed) {
    // WasmFS code in the wasm is not ready to be called yet. Cache the
    // files we want to create here in JS, and WasmFS will read them
    // later.
    wasmFSPreloadedFiles.push({
      pathName,
      fileData,
      mode
    });
  } else {
    // WasmFS is already running, so create the file normally.
    FS_create(pathName, mode);
    FS_writeFile(pathName, fileData);
  }
};

var asyncLoad = async url => {
  var arrayBuffer = await readAsync(url);
  return new Uint8Array(arrayBuffer);
};

var PATH_FS = {
  resolve: (...args) => {
    var resolvedPath = "", resolvedAbsolute = false;
    for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? args[i] : FS.cwd();
      // Skip empty and invalid entries
      if (typeof path !== "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!path) {
        return "";
      }
      resolvedPath = path + "/" + resolvedPath;
      resolvedAbsolute = PATH.isAbs(path);
    }
    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)
    resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(p => !!p), !resolvedAbsolute).join("/");
    return ((resolvedAbsolute ? "/" : "") + resolvedPath) || ".";
  },
  relative: (from, to) => {
    from = PATH_FS.resolve(from).slice(1);
    to = PATH_FS.resolve(to).slice(1);
    function trim(arr) {
      var start = 0;
      for (;start < arr.length; start++) {
        if (arr[start] !== "") break;
      }
      var end = arr.length - 1;
      for (;end >= 0; end--) {
        if (arr[end] !== "") break;
      }
      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }
    var fromParts = trim(from.split("/"));
    var toParts = trim(to.split("/"));
    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }
    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push("..");
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/");
  }
};

var getUniqueRunDependency = id => id;

var FS_handledByPreloadPlugin = async (byteArray, fullname) => {
  // Ensure plugins are ready.
  if (typeof Browser !== "undefined") Browser.init();
  for (var plugin of preloadPlugins) {
    if (plugin["canHandle"](fullname)) {
      return plugin["handle"](byteArray, fullname);
    }
  }
  // If no plugin handled this file then return the original/unmodified
  // byteArray.
  return byteArray;
};

var FS_preloadFile = async (parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish) => {
  // TODO we should allow people to just pass in a complete filename instead
  // of parent and name being that we just join them anyways
  var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
  var dep = getUniqueRunDependency(`cp ${fullname}`);
  // might have several active requests for the same fullname
  addRunDependency(dep);
  try {
    var byteArray = url;
    if (typeof url === "string") {
      byteArray = await asyncLoad(url);
    }
    byteArray = await FS_handledByPreloadPlugin(byteArray, fullname);
    preFinish?.();
    if (!dontCreateFile) {
      FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
    }
  } finally {
    removeRunDependency(dep);
  }
};

var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
  FS_preloadFile(parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish).then(onload).catch(onerror);
};

var FS_getMode = (canRead, canWrite) => {
  var mode = 0;
  if (canRead) mode |= 292 | 73;
  if (canWrite) mode |= 146;
  return mode;
};

var FS_modeStringToFlags = str => {
  if (typeof str !== "string") return str;
  var flagModes = {
    "r": 0,
    "r+": 2,
    "w": 512 | 64 | 1,
    "w+": 512 | 64 | 2,
    "a": 1024 | 64 | 1,
    "a+": 1024 | 64 | 2
  };
  var flags = flagModes[str];
  if (typeof flags === "undefined") {
    throw new Error(`Unknown file open mode: ${str}`);
  }
  return flags;
};

var FS_mkdir = (path, mode = 511) => FS.handleError(withStackSave(() => {
  var buffer = stringToUTF8OnStack(path);
  return __wasmfs_mkdir(buffer, mode);
}));

/**
   * @param {number=} mode Optionally, the mode to create in. Uses mkdir's
   *                       default if not set.
   */ var FS_mkdirTree = (path, mode) => {
  var dirs = path.split("/");
  var d = "";
  for (var dir of dirs) {
    if (!dir) continue;
    if (d || PATH.isAbs(path)) d += "/";
    d += dir;
    try {
      FS_mkdir(d, mode);
    } catch (e) {
      if (e.errno != 20) throw e;
    }
  }
};

var FS_unlink = path => withStackSave(() => {
  var buffer = stringToUTF8OnStack(path);
  return __wasmfs_unlink(buffer);
});

var wasmFS$backends = {};

var wasmFSDevices = {};

var wasmFSDeviceStreams = {};

var FS = {
  ErrnoError: class extends Error {
    name="ErrnoError";
    message="FS error";
    constructor(code) {
      super();
      this.errno = code;
    }
  },
  handleError(returnValue) {
    // Assume errors correspond to negative returnValues
    // since some functions like _wasmfs_open() return positive
    // numbers on success (some callers of this function may need to negate the parameter).
    if (returnValue < 0) {
      throw new FS.ErrnoError(-returnValue);
    }
    return returnValue;
  },
  createDataFile(parent, name, fileData, canRead, canWrite, canOwn) {
    FS_createDataFile(parent, name, fileData, canRead, canWrite, canOwn);
  },
  createPath(parent, path, canRead, canWrite) {
    // Cache file path directory names.
    var parts = path.split("/").reverse();
    while (parts.length) {
      var part = parts.pop();
      if (!part) continue;
      var current = PATH.join2(parent, part);
      if (!wasmFSPreloadingFlushed) {
        wasmFSPreloadedDirs.push({
          parentPath: parent,
          childName: part
        });
      } else {
        try {
          FS.mkdir(current);
        } catch (e) {
          if (e.errno != 20) throw e;
        }
      }
      parent = current;
    }
    return current;
  },
  createPreloadedFile(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
    return FS_createPreloadedFile(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish);
  },
  async preloadFile(parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish) {
    return FS_preloadFile(parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish);
  },
  readFile(path, opts = {}) {
    opts.encoding ??= "binary";
    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
      throw new Error(`Invalid encoding type "${opts.encoding}"`);
    }
    var buf, length;
    // Copy the file into a JS buffer on the heap.
    withStackSave(() => {
      var bufPtr = stackAlloc(8);
      var sizePtr = stackAlloc(8);
      FS.handleError(-__wasmfs_read_file(stringToUTF8OnStack(path), bufPtr, sizePtr));
      buf = Number((growMemViews(), HEAPU64)[((bufPtr) / 8)]);
      length = readI53FromI64(sizePtr);
    });
    // Default return type is binary.
    // The buffer contents exist 8 bytes after the returned pointer.
    return opts.encoding === "utf8" ? UTF8ToString(buf, length) : (growMemViews(), HEAPU8).slice(buf, buf + length);
  },
  cwd: () => UTF8ToString(__wasmfs_get_cwd()),
  mkdir: (path, mode) => FS_mkdir(path, mode),
  mkdirTree: (path, mode) => FS_mkdirTree(path, mode),
  rmdir: path => FS.handleError(withStackSave(() => __wasmfs_rmdir(stringToUTF8OnStack(path)))),
  open: (path, flags, mode = 438) => withStackSave(() => {
    flags = FS_modeStringToFlags(flags);
    var buffer = stringToUTF8OnStack(path);
    var fd = FS.handleError(__wasmfs_open(buffer, flags, mode));
    return {
      fd
    };
  }),
  create: (path, mode) => FS_create(path, mode),
  close: stream => FS.handleError(-__wasmfs_close(stream.fd)),
  unlink: path => FS_unlink(path),
  chdir: path => withStackSave(() => __wasmfs_chdir(stringToUTF8OnStack(path))),
  read(stream, buffer, offset, length, position) {
    var seeking = typeof position !== "undefined";
    var dataBuffer = _malloc(length);
    var bytesRead;
    if (seeking) {
      bytesRead = __wasmfs_pread(stream.fd, dataBuffer, length, BigInt(position));
    } else {
      bytesRead = __wasmfs_read(stream.fd, dataBuffer, length);
    }
    if (bytesRead > 0) {
      buffer.set((growMemViews(), HEAPU8).subarray(dataBuffer, dataBuffer + bytesRead), offset);
    }
    _free(dataBuffer);
    return FS.handleError(bytesRead);
  },
  write(stream, buffer, offset, length, position, canOwn) {
    var seeking = typeof position !== "undefined";
    var dataBuffer = _malloc(length);
    for (var i = 0; i < length; i++) {
      (growMemViews(), HEAP8)[(dataBuffer) + (i)] = buffer[offset + i];
    }
    var bytesRead;
    if (seeking) {
      bytesRead = __wasmfs_pwrite(stream.fd, dataBuffer, length, BigInt(position));
    } else {
      bytesRead = __wasmfs_write(stream.fd, dataBuffer, length);
    }
    _free(dataBuffer);
    return FS.handleError(bytesRead);
  },
  writeFile: (path, data) => FS_writeFile(path, data),
  mmap: (stream, length, offset, prot, flags) => {
    var buf = FS.handleError(__wasmfs_mmap(length, prot, flags, stream.fd, BigInt(offset)));
    return {
      ptr: buf,
      allocated: true
    };
  },
  msync: (stream, bufferPtr, offset, length, mmapFlags) => FS.handleError(__wasmfs_msync(bufferPtr, length, mmapFlags)),
  munmap: (addr, length) => (FS.handleError(__wasmfs_munmap(addr, length))),
  symlink: (target, linkpath) => withStackSave(() => (__wasmfs_symlink(stringToUTF8OnStack(target), stringToUTF8OnStack(linkpath)))),
  readlink(path) {
    return withStackSave(() => {
      var bufPtr = stackAlloc(8);
      FS.handleError(__wasmfs_readlink(stringToUTF8OnStack(path), bufPtr));
      var readBuffer = Number((growMemViews(), HEAPU64)[((bufPtr) / 8)]);
      return UTF8ToString(readBuffer);
    });
  },
  statBufToObject(statBuf) {
    // i53/u53 are enough for times and ino in practice.
    return {
      dev: (growMemViews(), HEAPU32)[((statBuf) / 4)],
      mode: (growMemViews(), HEAPU32)[(((statBuf) + (4)) / 4)],
      nlink: (growMemViews(), HEAPU64)[(((statBuf) + (8)) / 8)],
      uid: (growMemViews(), HEAPU32)[(((statBuf) + (16)) / 4)],
      gid: (growMemViews(), HEAPU32)[(((statBuf) + (20)) / 4)],
      rdev: (growMemViews(), HEAPU32)[(((statBuf) + (24)) / 4)],
      size: readI53FromI64((statBuf) + (32)),
      blksize: (growMemViews(), HEAP32)[(((statBuf) + (40)) / 4)],
      blocks: (growMemViews(), HEAP32)[(((statBuf) + (44)) / 4)],
      atime: readI53FromI64((statBuf) + (48)),
      mtime: readI53FromI64((statBuf) + (64)),
      ctime: readI53FromI64((statBuf) + (80)),
      ino: readI53FromU64((statBuf) + (96))
    };
  },
  stat(path) {
    return withStackSave(() => {
      var statBuf = stackAlloc(104);
      FS.handleError(__wasmfs_stat(stringToUTF8OnStack(path), statBuf));
      return FS.statBufToObject(statBuf);
    });
  },
  lstat(path) {
    return withStackSave(() => {
      var statBuf = stackAlloc(104);
      FS.handleError(__wasmfs_lstat(stringToUTF8OnStack(path), statBuf));
      return FS.statBufToObject(statBuf);
    });
  },
  chmod(path, mode) {
    return FS.handleError(withStackSave(() => {
      var buffer = stringToUTF8OnStack(path);
      return __wasmfs_chmod(buffer, mode);
    }));
  },
  lchmod(path, mode) {
    return FS.handleError(withStackSave(() => {
      var buffer = stringToUTF8OnStack(path);
      return __wasmfs_lchmod(buffer, mode);
    }));
  },
  fchmod(fd, mode) {
    return FS.handleError(__wasmfs_fchmod(fd, mode));
  },
  utime: (path, atime, mtime) => (FS.handleError(withStackSave(() => (__wasmfs_utime(stringToUTF8OnStack(path), atime, mtime))))),
  truncate(path, len) {
    return FS.handleError(withStackSave(() => (__wasmfs_truncate(stringToUTF8OnStack(path), BigInt(len)))));
  },
  ftruncate(fd, len) {
    return FS.handleError(__wasmfs_ftruncate(fd, BigInt(len)));
  },
  readdir: path => withStackSave(() => {
    var pathBuffer = stringToUTF8OnStack(path);
    var entries = [];
    var state = __wasmfs_readdir_start(pathBuffer);
    if (!state) {
      // TODO: The old FS threw an ErrnoError here.
      throw new Error("No such directory");
    }
    var entry;
    while (entry = __wasmfs_readdir_get(state)) {
      entries.push(UTF8ToString(entry));
    }
    __wasmfs_readdir_finish(state);
    return entries;
  }),
  mount: (type, opts, mountpoint) => {
    var backendPointer = type.createBackend(opts);
    return FS.handleError(withStackSave(() => __wasmfs_mount(stringToUTF8OnStack(mountpoint), backendPointer)));
  },
  unmount: mountpoint => (FS.handleError(withStackSave(() => _wasmfs_unmount(stringToUTF8OnStack(mountpoint))))),
  mknod: (path, mode, dev) => FS_mknod(path, mode, dev),
  makedev: (ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
    var backendPointer = _wasmfs_create_jsimpl_backend();
    var definedOps = {
      userRead: ops.read,
      userWrite: ops.write,
      allocFile: file => {
        wasmFSDeviceStreams[file] = {};
      },
      freeFile: file => {
        wasmFSDeviceStreams[file] = undefined;
      },
      getSize: file => {},
      // Devices cannot be resized.
      setSize: (file, size) => 0,
      read: (file, buffer, length, offset) => {
        var bufferArray = (growMemViews(), HEAP8).subarray(buffer, buffer + length);
        try {
          var bytesRead = definedOps.userRead(wasmFSDeviceStreams[file], bufferArray, 0, length, offset);
        } catch (e) {
          return -e.errno;
        }
        (growMemViews(), HEAP8).set(bufferArray, buffer);
        return bytesRead;
      },
      write: (file, buffer, length, offset) => {
        var bufferArray = (growMemViews(), HEAP8).subarray(buffer, buffer + length);
        try {
          var bytesWritten = definedOps.userWrite(wasmFSDeviceStreams[file], bufferArray, 0, length, offset);
        } catch (e) {
          return -e.errno;
        }
        (growMemViews(), HEAP8).set(bufferArray, buffer);
        return bytesWritten;
      }
    };
    wasmFS$backends[backendPointer] = definedOps;
    wasmFSDevices[dev] = backendPointer;
  },
  createDevice(parent, name, input, output) {
    if (typeof parent !== "string") {
      // The old API allowed parents to be objects, which do not exist in WasmFS.
      throw new Error("Only string paths are accepted");
    }
    var path = PATH.join2(parent, name);
    var mode = FS_getMode(!!input, !!output);
    FS.createDevice.major ??= 64;
    var dev = FS.makedev(FS.createDevice.major++, 0);
    // Create a fake device with a set of stream ops to emulate
    // the old API's createDevice().
    FS.registerDevice(dev, {
      read(stream, buffer, offset, length, pos) {
        var bytesRead = 0;
        for (var i = 0; i < length; i++) {
          var result;
          try {
            result = input();
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (result === undefined && !bytesRead) {
            throw new FS.ErrnoError(6);
          }
          if (result === null || result === undefined) break;
          bytesRead++;
          buffer[offset + i] = result;
        }
        return bytesRead;
      },
      write(stream, buffer, offset, length, pos) {
        for (var i = 0; i < length; i++) {
          try {
            output(buffer[offset + i]);
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        }
        return i;
      }
    });
    return FS.mkdev(path, mode, dev);
  },
  mkdev(path, mode, dev) {
    if (typeof dev === "undefined") {
      dev = mode;
      mode = 438;
    }
    var deviceBackend = wasmFSDevices[dev];
    if (!deviceBackend) {
      throw new Error("Invalid device ID.");
    }
    return FS.handleError(withStackSave(() => (_wasmfs_create_file(stringToUTF8OnStack(path), mode, deviceBackend))));
  },
  rename(oldPath, newPath) {
    return FS.handleError(withStackSave(() => {
      var oldPathBuffer = stringToUTF8OnStack(oldPath);
      var newPathBuffer = stringToUTF8OnStack(newPath);
      return __wasmfs_rename(oldPathBuffer, newPathBuffer);
    }));
  },
  llseek(stream, offset, whence) {
    return FS.handleError(__wasmfs_llseek(stream.fd, BigInt(offset), whence));
  }
};

/**
   * @param {number} ptr
   * @param {number} value
   * @param {string} type
   */ function setValue(ptr, value, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
   case "i1":
    (growMemViews(), HEAP8)[ptr] = value;
    break;

   case "i8":
    (growMemViews(), HEAP8)[ptr] = value;
    break;

   case "i16":
    (growMemViews(), HEAP16)[((ptr) / 2)] = value;
    break;

   case "i32":
    (growMemViews(), HEAP32)[((ptr) / 4)] = value;
    break;

   case "i64":
    (growMemViews(), HEAP64)[((ptr) / 8)] = BigInt(value);
    break;

   case "float":
    (growMemViews(), HEAPF32)[((ptr) / 4)] = value;
    break;

   case "double":
    (growMemViews(), HEAPF64)[((ptr) / 8)] = value;
    break;

   case "*":
    (growMemViews(), HEAPU64)[((ptr) / 8)] = BigInt(value);
    break;

   default:
    abort(`invalid type for setValue: ${type}`);
  }
}

var FS_createPath = FS.createPath;

PThread.init();

safeSetTimeout.pending = new Map;

safeSetTimeout.nextId = 1;

Module["requestAnimationFrame"] = MainLoop.requestAnimationFrame;

Module["pauseMainLoop"] = MainLoop.pause;

Module["resumeMainLoop"] = MainLoop.resume;

MainLoop.init();

for (let i = 0; i < 32; ++i) tempFixedLengthArray.push(new Array(i));

var miniTempWebGLFloatBuffersStorage = new Float32Array(288);

// Create GL_POOL_TEMP_BUFFERS_SIZE+1 temporary buffers, for uploads of size 0 through GL_POOL_TEMP_BUFFERS_SIZE inclusive
for (/**@suppress{duplicate}*/ var i = 0; i <= 288; ++i) {
  miniTempWebGLFloatBuffers[i] = miniTempWebGLFloatBuffersStorage.subarray(0, i);
}

var miniTempWebGLIntBuffersStorage = new Int32Array(288);

// Create GL_POOL_TEMP_BUFFERS_SIZE+1 temporary buffers, for uploads of size 0 through GL_POOL_TEMP_BUFFERS_SIZE inclusive
for (/**@suppress{duplicate}*/ var i = 0; i <= 288; ++i) {
  miniTempWebGLIntBuffers[i] = miniTempWebGLIntBuffersStorage.subarray(0, i);
}

registerPreMainLoop(() => {
  // If the current GL context is an OffscreenCanvas, but it was initialized
  // with implicit swap mode, perform the swap on behalf of the user.
  if (GL.currentContext && !GL.currentContextIsProxied && !GL.currentContext.attributes.explicitSwapControl && GL.currentContext.GLctx.commit) {
    GL.currentContext.GLctx.commit();
  }
});

// End JS library code
// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.
{
  // With WASM_ESM_INTEGRATION this has to happen at the top level and not
  // delayed until processModuleArgs.
  initMemory();
  // Begin ATMODULES hooks
  if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
  if (Module["print"]) out = Module["print"];
  if (Module["printErr"]) err = Module["printErr"];
  // End ATMODULES hooks
  if (Module["arguments"]) programArgs = Module["arguments"];
  if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
  var preInit = Module["preInit"];
  if (preInit) {
    if (typeof preInit === "function") Module["preInit"] = preInit = [ preInit ];
    // Written as a loop so that preInit functions that themselves add more
    // preInit functions.  Is this actually needed?
    while (preInit.length > 0) {
      preInit.shift()();
    }
  }
}

// Begin runtime exports
Module["wasmMemory"] = wasmMemory;

Module["addRunDependency"] = addRunDependency;

Module["removeRunDependency"] = removeRunDependency;

Module["UTF8ToString"] = UTF8ToString;

Module["stringToUTF8"] = stringToUTF8;

Module["FS_preloadFile"] = FS_preloadFile;

Module["FS_unlink"] = FS_unlink;

Module["FS_createPath"] = FS_createPath;

Module["FS_createDataFile"] = FS_createDataFile;

// End runtime exports
// Begin JS library exports
// End JS library exports
// end include: postlibrary.js
// proxiedFunctionTable specifies the list of functions that can be called
// either synchronously or asynchronously from other threads in postMessage()d
// or internally queued events. This way a pthread in a Worker can synchronously
// access e.g. the DOM on the main thread.
var proxiedFunctionTable = [ _proc_exit, exitOnMainThread, pthreadCreateProxied, _emscripten_exit_fullscreen, getCanvasSizeMainThread, setCanvasElementSizeMainThread, _emscripten_exit_pointerlock, _emscripten_get_device_pixel_ratio, _emscripten_get_element_css_size, _emscripten_get_fullscreen_status, _emscripten_get_gamepad_status, _emscripten_get_num_gamepads, _emscripten_get_screen_size, _emscripten_request_fullscreen_strategy, _emscripten_request_pointerlock, _emscripten_sample_gamepad_data, _emscripten_set_beforeunload_callback_on_thread, _emscripten_set_blur_callback_on_thread, _emscripten_set_element_css_size, _emscripten_set_focus_callback_on_thread, _emscripten_set_fullscreenchange_callback_on_thread, _emscripten_set_gamepadconnected_callback_on_thread, _emscripten_set_gamepaddisconnected_callback_on_thread, _emscripten_set_keydown_callback_on_thread, _emscripten_set_keypress_callback_on_thread, _emscripten_set_keyup_callback_on_thread, _emscripten_set_orientationchange_callback_on_thread, _emscripten_set_pointerlockchange_callback_on_thread, _emscripten_set_resize_callback_on_thread, _emscripten_set_visibilitychange_callback_on_thread, _emscripten_set_wheel_callback_on_thread, _emscripten_set_window_title, _environ_get, _environ_sizes_get ];

var ASM_CONSTS = {
  3696496: ($0, $1, $2) => {
    if (Module["onGuestTrace"]) {
      Module["onGuestTrace"](Number($0), Number($1), Number($2));
    }
  },
  3696592: ($0, $1, $2) => {
    if (Module["onGuestTrace"]) {
      Module["onGuestTrace"](Number($0), Number($1), Number($2), "present");
    }
  },
  3696699: $0 => {
    Module["onGpuRing"](Number($0));
  },
  3696736: () => {
    if (typeof (Module["SDL3"]) === "undefined") {
      Module["SDL3"] = {};
    }
    var SDL3 = Module["SDL3"];
    if (typeof (SDL3.JSVarToCPtr) === "undefined") {
      SDL3.JSVarToCPtr = function(v) {
        return BigInt(v);
      };
    }
    if (typeof (SDL3.CPtrToHeap32Index) === "undefined") {
      SDL3.CPtrToHeap32Index = function(ptr) {
        return Number(ptr / 4n);
      };
    }
  },
  3697065: () => {
    Module["SDL3"].camera = {};
  },
  3697097: () => (navigator.mediaDevices === undefined) ? 0 : 1,
  3697156: ($0, $1, $2, $3, $4) => {
    const device = $0;
    const w = $1;
    const h = $2;
    const framerate_numerator = $3;
    const framerate_denominator = $4;
    const outcome = Module._SDLEmscriptenCameraPermissionOutcome;
    const iterate = Module._SDLEmscriptenThreadIterate;
    const constraints = {};
    if ((w <= 0) || (h <= 0)) {
      constraints.video = true;
    } else {
      constraints.video = {};
      constraints.video.width = w;
      constraints.video.height = h;
    }
    if ((framerate_numerator > 0) && (framerate_denominator > 0)) {
      var fps = framerate_numerator / framerate_denominator;
      constraints.video.frameRate = {
        ideal: fps
      };
    }
    function grabNextCameraFrame() {
      const SDL3 = Module["SDL3"];
      if ((typeof (SDL3) === "undefined") || (typeof (SDL3.camera) === "undefined") || (typeof (SDL3.camera.stream) === "undefined")) {
        return;
      }
      const nextframems = SDL3.camera.next_frame_time;
      const now = performance.now();
      if (now >= nextframems) {
        iterate(device);
        while (SDL3.camera.next_frame_time < now) {
          SDL3.camera.next_frame_time += SDL3.camera.fpsincrms;
        }
      }
      requestAnimationFrame(grabNextCameraFrame);
    }
    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
      const settings = stream.getVideoTracks()[0].getSettings();
      const actualw = settings.width;
      const actualh = settings.height;
      const actualfps = settings.frameRate;
      console.log("Camera is opened! Actual spec: (" + actualw + "x" + actualh + "), fps=" + actualfps);
      if (outcome(device, 1, actualw, actualh, actualfps)) {
        const video = document.createElement("video");
        video.width = actualw;
        video.height = actualh;
        video.style.display = "none";
        video.srcObject = stream;
        const canvas = document.createElement("canvas");
        canvas.width = actualw;
        canvas.height = actualh;
        canvas.style.display = "none";
        const ctx2d = canvas.getContext("2d");
        const SDL3 = Module["SDL3"];
        SDL3.camera.width = actualw;
        SDL3.camera.height = actualh;
        SDL3.camera.fps = actualfps;
        SDL3.camera.fpsincrms = 1e3 / actualfps;
        SDL3.camera.stream = stream;
        SDL3.camera.video = video;
        SDL3.camera.canvas = canvas;
        SDL3.camera.ctx2d = ctx2d;
        SDL3.camera.next_frame_time = performance.now();
        video.play();
        video.addEventListener("loadedmetadata", () => {
          grabNextCameraFrame();
        });
      }
    }).catch(err => {
      console.error("Tried to open camera but it threw an error! " + err.name + ": " + err.message);
      outcome(device, 0, 0, 0, 0);
    });
  },
  3699462: () => {
    const SDL3 = Module["SDL3"];
    if ((typeof (SDL3) === "undefined") || (typeof (SDL3.camera) === "undefined") || (typeof (SDL3.camera.stream) === "undefined")) {
      return;
    }
    SDL3.camera.stream.getTracks().forEach(track => track.stop());
    SDL3.camera = {};
  },
  3699713: ($0, $1, $2) => {
    const w = $0;
    const h = $1;
    const rgba = $2;
    const SDL3 = Module["SDL3"];
    if ((typeof (SDL3) === "undefined") || (typeof (SDL3.camera) === "undefined") || (typeof (SDL3.camera.ctx2d) === "undefined")) {
      return 0;
    }
    SDL3.camera.ctx2d.drawImage(SDL3.camera.video, 0, 0, w, h);
    const imgrgba = SDL3.camera.ctx2d.getImageData(0, 0, w, h).data;
    (growMemViews(), HEAPU8).set(imgrgba, rgba);
    return 1;
  },
  3700091: () => {
    if (typeof (Module["SDL3"]) !== "undefined") {
      Module["SDL3"].camera = undefined;
    }
  },
  3700178: () => {
    Module["SDL3"].dummy_audio = {};
    Module["SDL3"].dummy_audio.timers = [];
    Module["SDL3"].dummy_audio.timers[0] = undefined;
    Module["SDL3"].dummy_audio.timers[1] = undefined;
  },
  3700355: ($0, $1, $2, $3, $4) => {
    var a = Module["SDL3"].dummy_audio;
    if (a.timers[$0] !== undefined) {
      clearInterval(a.timers[$0]);
    }
    a.timers[$0] = setInterval(function() {
      dynCall("vi", $3, [ $4 ]);
    }, ($1 / $2) * 1e3);
  },
  3700547: $0 => {
    var a = Module["SDL3"].dummy_audio;
    if (a.timers[$0] !== undefined) {
      clearInterval(a.timers[$0]);
    }
    a.timers[$0] = undefined;
  },
  3700678: () => {
    if (typeof (AudioContext) !== "undefined") {
      return true;
    } else if (typeof (webkitAudioContext) !== "undefined") {
      return true;
    }
    return false;
  },
  3700825: () => {
    if ((typeof (navigator.mediaDevices) !== "undefined") && (typeof (navigator.mediaDevices.getUserMedia) !== "undefined")) {
      return true;
    } else if (typeof (navigator.webkitGetUserMedia) !== "undefined") {
      return true;
    }
    return false;
  },
  3701059: () => {
    var SDL3 = Module["SDL3"];
    if (typeof (SDL3.audio_playback) === "undefined") {
      SDL3.audio_playback = {};
    }
    if (typeof (SDL3.audio_recording) === "undefined") {
      SDL3.audio_recording = {};
    }
    if (!SDL3.audioContext) {
      if (typeof (AudioContext) !== "undefined") {
        SDL3.audioContext = new AudioContext;
      } else if (typeof (webkitAudioContext) !== "undefined") {
        SDL3.audioContext = new webkitAudioContext;
      }
      if (SDL3.audioContext) {
        if ((typeof navigator.userActivation) === "undefined") {
          autoResumeAudioContext(SDL3.audioContext);
        }
      }
    }
    return (SDL3.audioContext !== undefined);
  },
  3701638: () => Module["SDL3"].audioContext.sampleRate,
  3701689: ($0, $1, $2, $3) => {
    var SDL3 = Module["SDL3"];
    var have_microphone = function(stream) {
      if (SDL3.audio_recording.silenceTimer !== undefined) {
        clearInterval(SDL3.audio_recording.silenceTimer);
        SDL3.audio_recording.silenceTimer = undefined;
        SDL3.audio_recording.silenceBuffer = undefined;
      }
      SDL3.audio_recording.mediaStreamNode = SDL3.audioContext.createMediaStreamSource(stream);
      SDL3.audio_recording.scriptProcessorNode = SDL3.audioContext.createScriptProcessor($1, $0, 1);
      SDL3.audio_recording.scriptProcessorNode.onaudioprocess = function(audioProcessingEvent) {
        if ((SDL3 === undefined) || (SDL3.audio_recording === undefined)) {
          return;
        }
        audioProcessingEvent.outputBuffer.getChannelData(0).fill(0);
        SDL3.audio_recording.currentRecordingBuffer = audioProcessingEvent.inputBuffer;
        dynCall("ip", $2, [ $3 ]);
      };
      SDL3.audio_recording.mediaStreamNode.connect(SDL3.audio_recording.scriptProcessorNode);
      SDL3.audio_recording.scriptProcessorNode.connect(SDL3.audioContext.destination);
      SDL3.audio_recording.stream = stream;
    };
    var no_microphone = function(error) {};
    SDL3.audio_recording.silenceBuffer = SDL3.audioContext.createBuffer($0, $1, SDL3.audioContext.sampleRate);
    SDL3.audio_recording.silenceBuffer.getChannelData(0).fill(0);
    var silence_callback = function() {
      SDL3.audio_recording.currentRecordingBuffer = SDL3.audio_recording.silenceBuffer;
      dynCall("ip", $2, [ $3 ]);
    };
    SDL3.audio_recording.silenceTimer = setInterval(silence_callback, ($1 / SDL3.audioContext.sampleRate) * 1e3);
    if ((navigator.mediaDevices !== undefined) && (navigator.mediaDevices.getUserMedia !== undefined)) {
      navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      }).then(have_microphone).catch(no_microphone);
    } else if (navigator.webkitGetUserMedia !== undefined) {
      navigator.webkitGetUserMedia({
        audio: true,
        video: false
      }, have_microphone, no_microphone);
    }
  },
  3703530: ($0, $1, $2, $3) => {
    var SDL3 = Module["SDL3"];
    SDL3.audio_playback.scriptProcessorNode = SDL3.audioContext["createScriptProcessor"]($1, 0, $0);
    SDL3.audio_playback.scriptProcessorNode["onaudioprocess"] = function(e) {
      if ((SDL3 === undefined) || (SDL3.audio_playback === undefined)) {
        return;
      }
      if (SDL3.audio_playback.silenceTimer !== undefined) {
        clearInterval(SDL3.audio_playback.silenceTimer);
        SDL3.audio_playback.silenceTimer = undefined;
        SDL3.audio_playback.silenceBuffer = undefined;
      }
      SDL3.audio_playback.currentPlaybackBuffer = e["outputBuffer"];
      dynCall("ip", $2, [ $3 ]);
    };
    SDL3.audio_playback.scriptProcessorNode["connect"](SDL3.audioContext["destination"]);
    if (SDL3.audioContext.state === "suspended") {
      SDL3.audio_playback.silenceBuffer = SDL3.audioContext.createBuffer($0, $1, SDL3.audioContext.sampleRate);
      SDL3.audio_playback.silenceBuffer.getChannelData(0).fill(0);
      var silence_callback = function() {
        if ((typeof navigator.userActivation) !== "undefined") {
          if (navigator.userActivation.hasBeenActive) {
            SDL3.audioContext.resume();
          }
        }
        SDL3.audio_playback.currentPlaybackBuffer = SDL3.audio_playback.silenceBuffer;
        dynCall("ip", $2, [ $3 ]);
        SDL3.audio_playback.currentPlaybackBuffer = undefined;
      };
      SDL3.audio_playback.silenceTimer = setInterval(silence_callback, ($1 / SDL3.audioContext.sampleRate) * 1e3);
    }
  },
  3704846: $0 => {
    var SDL3 = Module["SDL3"];
    if ($0) {
      if (SDL3.audio_recording.silenceTimer !== undefined) {
        clearInterval(SDL3.audio_recording.silenceTimer);
      }
      if (SDL3.audio_recording.stream !== undefined) {
        var tracks = SDL3.audio_recording.stream.getAudioTracks();
        for (var i = 0; i < tracks.length; i++) {
          SDL3.audio_recording.stream.removeTrack(tracks[i]);
        }
      }
      if (SDL3.audio_recording.scriptProcessorNode !== undefined) {
        SDL3.audio_recording.scriptProcessorNode.onaudioprocess = function(audioProcessingEvent) {};
        SDL3.audio_recording.scriptProcessorNode.disconnect();
      }
      if (SDL3.audio_recording.mediaStreamNode !== undefined) {
        SDL3.audio_recording.mediaStreamNode.disconnect();
      }
      SDL3.audio_recording = undefined;
    } else {
      if (SDL3.audio_playback.scriptProcessorNode != undefined) {
        SDL3.audio_playback.scriptProcessorNode.disconnect();
      }
      if (SDL3.audio_playback.silenceTimer !== undefined) {
        clearInterval(SDL3.audio_playback.silenceTimer);
      }
      SDL3.audio_playback = undefined;
    }
    if ((SDL3.audioContext !== undefined) && (SDL3.audio_playback === undefined) && (SDL3.audio_recording === undefined)) {
      SDL3.audioContext.close();
      SDL3.audioContext = undefined;
    }
  },
  3706002: ($0, $1) => {
    var SDL3 = Module["SDL3"];
    var buf = SDL3.CPtrToHeap32Index($0);
    var numChannels = SDL3.audio_playback.currentPlaybackBuffer["numberOfChannels"];
    for (var c = 0; c < numChannels; ++c) {
      var channelData = SDL3.audio_playback.currentPlaybackBuffer["getChannelData"](c);
      if (channelData.length != $1) {
        throw "Web Audio playback buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + $1 + " samples!";
      }
      for (var j = 0; j < $1; ++j) {
        channelData[j] = (growMemViews(), HEAPF32)[buf + (j * numChannels + c)];
      }
    }
  },
  3706535: ($0, $1) => {
    var SDL3 = Module["SDL3"];
    var numChannels = SDL3.audio_recording.currentRecordingBuffer.numberOfChannels;
    for (var c = 0; c < numChannels; ++c) {
      var channelData = SDL3.audio_recording.currentRecordingBuffer.getChannelData(c);
      if (channelData.length != $1) {
        throw "Web Audio recording buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + $1 + " samples!";
      }
      if (numChannels == 1) {
        for (var j = 0; j < $1; ++j) {
          setValue($0 + (j * 4), channelData[j], "float");
        }
      } else {
        for (var j = 0; j < $1; ++j) {
          setValue($0 + (((j * numChannels) + c) * 4), channelData[j], "float");
        }
      }
    }
  },
  3707162: $0 => {
    let gamepads = navigator["getGamepads"]();
    if (!gamepads) {
      return 0;
    }
    let gamepad = gamepads[$0];
    if (!gamepad || !gamepad["vibrationActuator"]) {
      return 0;
    }
    return 1;
  },
  3707337: ($0, $1, $2) => {
    let gamepads = navigator["getGamepads"]();
    if (!gamepads) {
      return 0;
    }
    let gamepad = gamepads[$0];
    if (!gamepad || !gamepad["vibrationActuator"]) {
      return 0;
    }
    gamepad["vibrationActuator"]["playEffect"]("dual-rumble", {
      "startDelay": 0,
      "duration": 3e3,
      "weakMagnitude": $2 / 65535,
      "strongMagnitude": $1 / 65535
    });
    return 1;
  },
  3707673: ($0, $1, $2, $3) => {
    var w = $0;
    var h = $1;
    var pixels = $2;
    var canvasId = UTF8ToString($3);
    var canvas = document.querySelector(canvasId);
    var SDL3 = Module["SDL3"];
    if (SDL3.ctxCanvas !== canvas) {
      SDL3.ctx = Browser.createContext(canvas, false, true);
      if (!SDL3.ctx) {
        return false;
      }
      SDL3.ctxCanvas = canvas;
    }
    if (SDL3.w !== w || SDL3.h !== h || SDL3.imageCtx !== SDL3.ctx) {
      SDL3.image = SDL3.ctx.createImageData(w, h);
      SDL3.w = w;
      SDL3.h = h;
      SDL3.imageCtx = SDL3.ctx;
    }
    var data = SDL3.image.data;
    var src = pixels / 4;
    if (SDL3.data32Data !== data) {
      SDL3.data32 = new Int32Array(data.buffer);
      SDL3.data32Data = data;
    }
    var data32 = SDL3.data32;
    data32.set((growMemViews(), HEAP32).subarray(src, src + data32.length));
    SDL3.ctx.putImageData(SDL3.image, 0, 0);
    return true;
  },
  3708422: () => {
    var SDL3 = Module["SDL3"];
    SDL3["mouse_x"] = 0;
    SDL3["mouse_y"] = 0;
    SDL3["mouse_buttons"] = [];
    for (var i = 0; i < 5; ++i) {
      SDL3["mouse_buttons"][i] = false;
    }
    document.addEventListener("mousemove", function(e) {
      var SDL3 = Module["SDL3"];
      SDL3["mouse_x"] = e.clientX;
      SDL3["mouse_y"] = e.clientY;
    });
    document.addEventListener("mousedown", function(e) {
      var SDL3 = Module["SDL3"];
      if (0 <= e.button && e.button < SDL3["mouse_buttons"].length) {
        SDL3["mouse_buttons"][e.button] = true;
      }
    });
    document.addEventListener("mouseup", function(e) {
      var SDL3 = Module["SDL3"];
      if (0 <= e.button && e.button < SDL3["mouse_buttons"].length) {
        SDL3["mouse_buttons"][e.button] = false;
      }
    });
  },
  3709110: ($0, $1, $2, $3, $4) => {
    var w = $0;
    var h = $1;
    var hot_x = $2;
    var hot_y = $3;
    var pixels = $4;
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    var image = ctx.createImageData(w, h);
    var data = image.data;
    var src = pixels / 4;
    var data32 = new Int32Array(data.buffer);
    data32.set((growMemViews(), HEAP32).subarray(src, src + data32.length));
    ctx.putImageData(image, 0, 0);
    var url = hot_x === 0 && hot_y === 0 ? "url(" + canvas.toDataURL() + "), auto" : "url(" + canvas.toDataURL() + ") " + hot_x + " " + hot_y + ", auto";
    var urlBuf = _SDL_malloc(url.length + 1);
    stringToUTF8(url, urlBuf, url.length + 1);
    return urlBuf;
  },
  3709768: $0 => {
    if (Module["canvas"]) {
      Module["canvas"].style["cursor"] = UTF8ToString($0);
    }
  },
  3709851: () => {
    if (Module["canvas"]) {
      Module["canvas"].style["cursor"] = "none";
    }
  },
  3709920: () => Module["SDL3"]["mouse_x"],
  3709958: () => Module["SDL3"]["mouse_y"],
  3709996: $0 => Module["SDL3"]["mouse_buttons"][$0],
  3710044: $0 => {
    var data = $0;
    document.sdlEventHandlerLockKeysCheck = function(event) {
      if ((event.key != "CapsLock") && (event.key != "NumLock") && (event.key != "ScrollLock")) {
        _Emscripten_HandleLockKeysCheck(Module["SDL3"].JSVarToCPtr(data), event.getModifierState("CapsLock"), event.getModifierState("NumLock"), event.getModifierState("ScrollLock"));
      }
    };
    document.addEventListener("keydown", document.sdlEventHandlerLockKeysCheck);
  },
  3710471: () => {
    document.removeEventListener("keydown", document.sdlEventHandlerLockKeysCheck);
  },
  3710555: $0 => {
    var target = document;
    if (target) {
      target.sdlEventHandlerMouseButtonUpGlobal = function(event) {
        var SDL3 = Module["SDL3"];
        var d = SDL3.makePointerEventCStruct(0, 0, event);
        if (d != 0) {
          _Emscripten_HandleMouseButtonUpGlobal(SDL3.JSVarToCPtr($0), d);
          _SDL_free(d);
        }
      };
      target.addEventListener("pointerup", target.sdlEventHandlerMouseButtonUpGlobal);
    }
  },
  3710916: $0 => {
    var SDL3 = Module["SDL3"];
    if (SDL3.makePointerEventCStruct === undefined) {
      SDL3.makePointerEventCStruct = function(left, top, event) {
        var ptrtype = 0;
        if (event.pointerType == "mouse") {
          ptrtype = 1;
        } else if (event.pointerType == "touch") {
          ptrtype = 2;
        } else if (event.pointerType == "pen") {
          ptrtype = 3;
        } else {
          return 0;
        }
        var ptr = _SDL_malloc($0);
        if (ptr != 0) {
          var idx = SDL3.CPtrToHeap32Index(ptr);
          (growMemViews(), HEAP32)[idx++] = ptrtype;
          (growMemViews(), HEAP32)[idx++] = event.pointerId;
          (growMemViews(), HEAP32)[idx++] = (typeof (event.button) !== "undefined") ? event.button : -1;
          (growMemViews(), HEAP32)[idx++] = event.buttons;
          (growMemViews(), HEAP32)[idx++] = (event.type == "pointerdown") ? 1 : 0;
          (growMemViews(), HEAPF32)[idx++] = event.movementX;
          (growMemViews(), HEAPF32)[idx++] = event.movementY;
          (growMemViews(), HEAPF32)[idx++] = event.clientX - left;
          (growMemViews(), HEAPF32)[idx++] = event.clientY - top;
          if (ptrtype == 3) {
            (growMemViews(), HEAPF32)[idx++] = event.pressure;
            (growMemViews(), HEAPF32)[idx++] = event.tangentialPressure;
            (growMemViews(), HEAPF32)[idx++] = event.tiltX;
            (growMemViews(), HEAPF32)[idx++] = event.tiltY;
            (growMemViews(), HEAPF32)[idx++] = event.twist;
          }
        }
        return ptr;
      };
    }
  },
  3711908: $0 => {
    var id = UTF8ToString($0);
    try {
      var canvas = document.querySelector(id);
      if (canvas) {
        return canvas === document.activeElement;
      }
    } catch (e) {}
    return false;
  },
  3712074: () => document.hasFocus(),
  3712106: () => {
    var target = document;
    if (target) {
      target.removeEventListener("pointerup", target.sdlEventHandlerMouseButtonUpGlobal);
      target.sdlEventHandlerMouseButtonUpGlobal = undefined;
    }
  },
  3712288: () => document.body.clientWidth,
  3712326: () => document.body.clientHeight,
  3712365: () => window.innerWidth,
  3712395: () => window.innerHeight,
  3712426: () => window.outerWidth,
  3712456: () => window.outerHeight,
  3712487: () => window.pageXOffset,
  3712518: () => window.pageYOffset,
  3712549: ($0, $1) => {
    var target = document.querySelector(UTF8ToString($1));
    if (target) {
      var SDL3 = Module["SDL3"];
      var data = $0;
      target.sdlEventHandlerPointerEnter = function(event) {
        var rect = target.getBoundingClientRect();
        var d = SDL3.makePointerEventCStruct(rect.left, rect.top, event);
        if (d != 0) {
          _Emscripten_HandlePointerEnter(SDL3.JSVarToCPtr(data), d);
          _SDL_free(d);
        }
      };
      target.sdlEventHandlerPointerLeave = function(event) {
        var rect = target.getBoundingClientRect();
        var d = SDL3.makePointerEventCStruct(rect.left, rect.top, event);
        if (d != 0) {
          _Emscripten_HandlePointerLeave(SDL3.JSVarToCPtr(data), d);
          _SDL_free(d);
        }
      };
      target.sdlEventHandlerPointerGeneric = function(event) {
        var rect = target.getBoundingClientRect();
        var d = SDL3.makePointerEventCStruct(rect.left, rect.top, event);
        if (d != 0) {
          _Emscripten_HandlePointerGeneric(SDL3.JSVarToCPtr(data), d);
          _SDL_free(d);
        }
      };
      target.style.touchAction = "none";
      target.addEventListener("pointerenter", target.sdlEventHandlerPointerEnter);
      target.addEventListener("pointerleave", target.sdlEventHandlerPointerLeave);
      target.addEventListener("pointercancel", target.sdlEventHandlerPointerLeave);
      target.addEventListener("pointerdown", target.sdlEventHandlerPointerGeneric);
      target.addEventListener("pointermove", target.sdlEventHandlerPointerGeneric);
      target.addEventListener("pointerup", target.sdlEventHandlerPointerGeneric);
    }
  },
  3713937: ($0, $1, $2) => {
    var target = document.querySelector(UTF8ToString($1));
    if (target) {
      var data = $0;
      var SDL3 = Module["SDL3"];
      var makeDropEventCStruct = function(event) {
        var ptr = 0;
        ptr = _SDL_malloc($2);
        if (ptr != 0) {
          var idx = ptr >> 2;
          var rect = target.getBoundingClientRect();
          (growMemViews(), HEAP32)[idx++] = event.clientX - rect.left;
          (growMemViews(), HEAP32)[idx++] = event.clientY - rect.top;
        }
        return ptr;
      };
      SDL3.eventHandlerDropDragover = function(event) {
        event.preventDefault();
        var d = makeDropEventCStruct(event);
        if (d != 0) {
          _Emscripten_SendDragEvent(data, d);
          _SDL_free(d);
        }
      };
      target.addEventListener("dragover", SDL3.eventHandlerDropDragover);
      SDL3.drop_count = 0;
      try {
        FS.mkdir("/tmp/filedrop");
      } catch (e) {}
      SDL3.eventHandlerDropDrop = function(event) {
        event.preventDefault();
        if (event.dataTransfer.types.includes("text/plain")) {
          let plain_text = stringToNewUTF8(event.dataTransfer.getData("text/plain"));
          _Emscripten_SendDragTextEvent(data, plain_text);
          _Emscripten_force_free(plain_text);
        } else if (event.dataTransfer.types.includes("Files")) {
          let files_read = 0;
          const files_to_read = event.dataTransfer.files.length;
          for (let i = 0; i < files_to_read; i++) {
            const file = event.dataTransfer.files.item(i);
            const file_reader = new FileReader;
            file_reader.readAsArrayBuffer(file);
            file_reader.onload = function(event) {
              const fs_dropdir = `/tmp/filedrop/${SDL3.drop_count}`;
              SDL3.drop_count += 1;
              const fs_filepath = `${fs_dropdir}/${file.name}`;
              const c_fs_filepath = stringToNewUTF8(fs_filepath);
              const contents_array8 = new Uint8Array(event.target.result);
              try {
                FS.mkdir(fs_dropdir);
                var stream = FS.open(fs_filepath, "w");
                FS.write(stream, contents_array8, 0, contents_array8.length, 0);
                FS.close(stream);
                _Emscripten_SendDragFileEvent(data, c_fs_filepath);
              } catch (e) {}
              _Emscripten_force_free(c_fs_filepath);
              onFileRead();
            };
            file_reader.onerror = function(event) {
              onFileRead();
            };
          }
          function onFileRead() {
            ++files_read;
            if (files_read === files_to_read) {
              _Emscripten_SendDragCompleteEvent(data);
            }
          }
        }
        _Emscripten_SendDragCompleteEvent(data);
      };
      target.addEventListener("drop", SDL3.eventHandlerDropDrop);
      SDL3.eventHandlerDropDragend = function(event) {
        event.preventDefault();
        _Emscripten_SendDragCompleteEvent(data);
      };
      target.addEventListener("dragend", SDL3.eventHandlerDropDragend);
      target.addEventListener("dragleave", SDL3.eventHandlerDropDragend);
    }
  },
  3716304: $0 => {
    var target = document.querySelector(UTF8ToString($0));
    if (target) {
      var SDL3 = Module["SDL3"];
      target.removeEventListener("dragleave", SDL3.eventHandlerDropDragend);
      target.removeEventListener("dragend", SDL3.eventHandlerDropDragend);
      target.removeEventListener("drop", SDL3.eventHandlerDropDrop);
      SDL3.drop_count = undefined;
      FS.rmdir("/tmp/filedrop");
      target.removeEventListener("dragover", SDL3.eventHandlerDropDragover);
      SDL3.eventHandlerDropDragover = undefined;
      SDL3.eventHandlerDropDrop = undefined;
      SDL3.eventHandlerDropDragend = undefined;
    }
  },
  3717134: $0 => {
    var target = document.querySelector(UTF8ToString($0));
    if (target) {
      target.removeEventListener("pointerenter", target.sdlEventHandlerPointerEnter);
      target.removeEventListener("pointerleave", target.sdlEventHandlerPointerLeave);
      target.removeEventListener("pointercancel", target.sdlEventHandlerPointerLeave);
      target.removeEventListener("pointerdown", target.sdlEventHandlerPointerGeneric);
      target.removeEventListener("pointermove", target.sdlEventHandlerPointerGeneric);
      target.removeEventListener("pointerup", target.sdlEventHandlerPointerGeneric);
      target.style.touchAction = "";
      target.sdlEventHandlerPointerEnter = undefined;
      target.sdlEventHandlerPointerLeave = undefined;
      target.sdlEventHandlerPointerGeneric = undefined;
    }
  },
  3717868: () => {
    if (!window.matchMedia) {
      return -1;
    }
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      return 0;
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return 1;
    }
    return -1;
  },
  3718077: () => {
    if (typeof (Module["SDL3"]) !== "undefined") {
      var SDL3 = Module["SDL3"];
      SDL3.themeChangedMatchMedia.removeEventListener("change", SDL3.eventHandlerThemeChanged);
      SDL3.themeChangedMatchMedia = undefined;
      SDL3.eventHandlerThemeChanged = undefined;
    }
  },
  3718330: () => window.innerWidth,
  3718360: () => window.innerHeight,
  3718391: $0 => {
    Module["requestFullscreen"] = function(lockPointer, resizeCanvas) {
      _requestFullscreenThroughSDL($0);
    };
  },
  3718500: ($0, $1) => {
    var pngData = (growMemViews(), HEAPU8).buffer instanceof ArrayBuffer ? (growMemViews(), 
    HEAPU8).subarray($0, $0 + $1) : (growMemViews(), HEAPU8).slice($0, $0 + $1);
    var blob = new Blob([ pngData ], {
      type: "image/png"
    });
    var url = URL.createObjectURL(blob);
    var link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      document.head.appendChild(link);
    }
    if (link.href && link.href.startsWith("blob:")) {
      URL.revokeObjectURL(link.href);
    }
    link.href = url;
  },
  3718993: () => {
    Module["requestFullscreen"] = function(lockPointer, resizeCanvas) {};
  },
  3719067: () => window.innerWidth,
  3719097: () => window.innerHeight,
  3719128: $0 => {
    var canvas = document.querySelector(UTF8ToString($0));
    canvas.SDL3_original_position = canvas.style.position;
    canvas.SDL3_original_top = canvas.style.top;
    canvas.SDL3_original_left = canvas.style.left;
    var div = document.createElement("div");
    div.id = "SDL3_fill_document_background_elements";
    div.SDL3_canvas = canvas;
    div.SDL3_canvas_parent = canvas.parentNode;
    div.SDL3_canvas_nextsib = canvas.nextSibling;
    var children = Array.from(document.body.children);
    for (var child of children) {
      div.appendChild(child);
    }
    document.body.appendChild(div);
    div.style.display = "none";
    document.body.appendChild(canvas);
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
  },
  3719826: () => {
    var div = document.getElementById("SDL3_fill_document_background_elements");
    if (div) {
      if (div.SDL3_canvas_nextsib) {
        div.SDL3_canvas_parent.insertBefore(div.SDL3_canvas, div.SDL3_canvas_nextsib);
      } else {
        div.SDL3_canvas_parent.appendChild(div.SDL3_canvas);
      }
      while (div.firstChild) {
        document.body.insertBefore(div.firstChild, div);
      }
      div.SDL3_canvas.style.position = div.SDL3_canvas.SDL3_original_position;
      div.SDL3_canvas.style.top = div.SDL3_canvas.SDL3_original_top;
      div.SDL3_canvas.style.left = div.SDL3_canvas.SDL3_original_left;
      div.remove();
    }
  },
  3720385: () => {
    if (window.matchMedia) {
      var SDL3 = Module["SDL3"];
      SDL3.eventHandlerThemeChanged = function(event) {
        _Emscripten_SendSystemThemeChangedEvent();
      };
      SDL3.themeChangedMatchMedia = window.matchMedia("(prefers-color-scheme: dark)");
      SDL3.themeChangedMatchMedia.addEventListener("change", SDL3.eventHandlerThemeChanged);
    }
  },
  3720707: ($0, $1, $2, $3, $4) => {
    var title = UTF8ToString($0);
    var message = UTF8ToString($1);
    var background = UTF8ToString($2);
    var color = UTF8ToString($3);
    var id = UTF8ToString($4);
    var dialog = document.createElement("dialog");
    dialog.classList.add("SDL3_messagebox");
    dialog.id = id;
    dialog.style.color = color;
    dialog.style.backgroundColor = background;
    document.body.append(dialog);
    var h1 = document.createElement("h1");
    h1.innerText = title;
    dialog.append(h1);
    var p = document.createElement("p");
    p.innerText = message;
    dialog.append(p);
    dialog.showModal();
  },
  3721248: ($0, $1, $2, $3, $4, $5, $6, $7) => {
    var dialog_id = UTF8ToString($0);
    var text = UTF8ToString($1);
    var responseId = $2;
    var clickOnReturn = $3;
    var clickOnEscape = $4;
    var border = UTF8ToString($5);
    var background = UTF8ToString($6);
    var hovered = UTF8ToString($7);
    var dialog = document.getElementById(dialog_id);
    if (!dialog) {
      return false;
    }
    var button = document.createElement("button");
    button.innerText = text;
    button.style.borderColor = border;
    button.style.backgroundColor = background;
    dialog.addEventListener("keydown", function(e) {
      if (clickOnReturn && e.key === "Enter") {
        e.preventDefault();
        button.click();
      } else if (clickOnEscape && e.key === "Escape") {
        e.preventDefault();
        button.click();
      }
    });
    dialog.addEventListener("cancel", function(e) {
      e.preventDefault();
    });
    button.onmouseenter = function(e) {
      button.style.backgroundColor = hovered;
    };
    button.onmouseleave = function(e) {
      button.style.backgroundColor = background;
    };
    button.onclick = function(e) {
      dialog.close(responseId);
    };
    dialog.append(button);
    return true;
  },
  3722257: $0 => {
    var dialog_id = UTF8ToString($0);
    var dialog = document.getElementById(dialog_id);
    if (!dialog) {
      return false;
    }
    return dialog.open;
  },
  3722395: $0 => {
    var dialog_id = UTF8ToString($0);
    var dialog = document.getElementById(dialog_id);
    if (!dialog) {
      return 0;
    }
    try {
      return parseInt(dialog.returnValue);
    } catch (e) {
      return 0;
    }
  },
  3722577: ($0, $1) => {
    alert(UTF8ToString($0) + "\n\n" + UTF8ToString($1));
  }
};

function liberty_gpu_fetch_text_sync(url) {
  var xhr = new XMLHttpRequest;
  xhr.open("GET", UTF8ToString(Number(url)), false);
  try {
    xhr.send(null);
  } catch (e) {
    return BigInt(0);
  }
  if (xhr.status != 200) return BigInt(0);
  var text = xhr.responseText;
  var size = lengthBytesUTF8(text) + 1;
  var buffer = Number(_malloc(size));
  stringToUTF8(text, buffer, size);
  return BigInt(buffer);
}

function liberty_fetch_text_sync(url, status) {
  var statusIndex = Number(status) / 4;
  var xhr = new XMLHttpRequest;
  xhr.open("GET", UTF8ToString(Number(url)), false);
  try {
    xhr.send(null);
  } catch (e) {
    (growMemViews(), HEAP32)[statusIndex] = 0;
    return BigInt(0);
  }
  (growMemViews(), HEAP32)[statusIndex] = xhr.status;
  if (xhr.status != 200) return BigInt(0);
  var text = xhr.responseText;
  var size = lengthBytesUTF8(text) + 1;
  var buffer = Number(_malloc(size));
  stringToUTF8(text, buffer, size);
  return BigInt(buffer);
}

function SDL_GetEmscriptenJoystickVendor(device_index) {
  let gamepad = navigator["getGamepads"]()[device_index];
  let vendor_str = "Vendor: ";
  if (gamepad["id"]["indexOf"](vendor_str) > 0) {
    let vendor_str_index = gamepad["id"]["indexOf"](vendor_str) + vendor_str["length"];
    return parseInt(gamepad["id"]["substr"](vendor_str_index, 4), 16);
  }
  let id_split = gamepad["id"]["split"]("-");
  if (id_split["length"] > 1 && !isNaN(parseInt(id_split[0], 16))) {
    return parseInt(id_split[0], 16);
  }
  return 0;
}

function SDL_GetEmscriptenJoystickProduct(device_index) {
  let gamepad = navigator["getGamepads"]()[device_index];
  let product_str = "Product: ";
  if (gamepad["id"]["indexOf"](product_str) > 0) {
    let product_str_index = gamepad["id"]["indexOf"](product_str) + product_str["length"];
    return parseInt(gamepad["id"]["substr"](product_str_index, 4), 16);
  }
  let id_split = gamepad["id"]["split"]("-");
  if (id_split["length"] > 1 && !isNaN(parseInt(id_split[1], 16))) {
    return parseInt(id_split[1], 16);
  }
  return 0;
}

function SDL_IsEmscriptenJoystickXInput(device_index) {
  let gamepad = navigator["getGamepads"]()[device_index];
  return gamepad["id"]["toLowerCase"]()["indexOf"]("xinput") >= 0;
}

// Imports from the Wasm binary.
var __Znwm, __ZdlPvm, _free, _malloc, __ZdaPv, _pthread_self, __ZnwmSt11align_val_t, _SDL_free, _liberty_audio_profile_enable, _liberty_audio_profile, _main, __Znam, __ZdaPvm, _liberty_audio_stats, _liberty_gpu_ring, _liberty_io_table, _SDL_malloc, _SDL_calloc, _SDL_realloc, _SDLEmscriptenCameraPermissionOutcome, _SDLEmscriptenThreadIterate, _Emscripten_HandlePointerEnter, _Emscripten_HandlePointerLeave, _Emscripten_HandlePointerGeneric, _Emscripten_HandleMouseButtonUpGlobal, _Emscripten_SendDragEvent, _Emscripten_SendDragCompleteEvent, _Emscripten_SendDragTextEvent, _Emscripten_SendDragFileEvent, _Emscripten_HandleLockKeysCheck, _Emscripten_SendSystemThemeChangedEvent, _requestFullscreenThroughSDL, _Emscripten_force_free, _emscripten_builtin_free, __emscripten_tls_init, __emscripten_proxy_main, __emscripten_run_callback_on_thread, __emscripten_set_offscreencanvas_size_on_thread, _emscripten_builtin_malloc, ___funcs_on_exit, ___libc_calloc, ___libc_free, ___libc_malloc, __emscripten_thread_init, ___set_thread_state, __emscripten_thread_crashed, __emscripten_run_js_on_main_thread_done, __emscripten_run_js_on_main_thread, __emscripten_thread_free_data, __emscripten_thread_exit, _strndup, __emscripten_check_mailbox, __ZdlPv, __ZnamSt11align_val_t, ___libc_realloc, _emscripten_builtin_calloc, _emscripten_builtin_realloc, _malloc_size, _malloc_usable_size, _reallocf, ___trap, _emscripten_stack_set_limits, __emscripten_stack_restore, __emscripten_stack_alloc, _emscripten_stack_get_current, __wasmfs_read_file, __wasmfs_write_file, __wasmfs_mkdir, __wasmfs_rmdir, __wasmfs_open, __wasmfs_mknod, __wasmfs_unlink, __wasmfs_chdir, __wasmfs_symlink, __wasmfs_readlink, __wasmfs_write, __wasmfs_pwrite, __wasmfs_chmod, __wasmfs_fchmod, __wasmfs_lchmod, __wasmfs_llseek, __wasmfs_rename, __wasmfs_read, __wasmfs_pread, __wasmfs_truncate, __wasmfs_ftruncate, __wasmfs_close, __wasmfs_mmap, __wasmfs_msync, __wasmfs_munmap, __wasmfs_utime, __wasmfs_stat, __wasmfs_lstat, __wasmfs_mount, __wasmfs_readdir_start, __wasmfs_readdir_get, __wasmfs_readdir_finish, __wasmfs_get_cwd, _wasmfs_create_jsimpl_backend, _wasmfs_create_file, _wasmfs_unmount, __indirect_function_table, wasmTable;

function assignWasmExports(wasmExports) {
  __Znwm = Module["__Znwm"] = wasmExports["Ud"];
  __ZdlPvm = Module["__ZdlPvm"] = wasmExports["Vd"];
  _free = Module["_free"] = wasmExports["Xd"];
  _malloc = Module["_malloc"] = wasmExports["Yd"];
  __ZdaPv = Module["__ZdaPv"] = wasmExports["Zd"];
  _pthread_self = wasmExports["_d"];
  __ZnwmSt11align_val_t = Module["__ZnwmSt11align_val_t"] = wasmExports["$d"];
  _SDL_free = Module["_SDL_free"] = wasmExports["ae"];
  _liberty_audio_profile_enable = Module["_liberty_audio_profile_enable"] = wasmExports["be"];
  _liberty_audio_profile = Module["_liberty_audio_profile"] = wasmExports["ce"];
  _main = Module["_main"] = wasmExports["de"];
  __Znam = Module["__Znam"] = wasmExports["ee"];
  __ZdaPvm = Module["__ZdaPvm"] = wasmExports["fe"];
  _liberty_audio_stats = Module["_liberty_audio_stats"] = wasmExports["ge"];
  _liberty_gpu_ring = Module["_liberty_gpu_ring"] = wasmExports["he"];
  _liberty_io_table = Module["_liberty_io_table"] = wasmExports["ie"];
  _SDL_malloc = Module["_SDL_malloc"] = wasmExports["je"];
  _SDL_calloc = Module["_SDL_calloc"] = wasmExports["ke"];
  _SDL_realloc = Module["_SDL_realloc"] = wasmExports["le"];
  _SDLEmscriptenCameraPermissionOutcome = Module["_SDLEmscriptenCameraPermissionOutcome"] = wasmExports["me"];
  _SDLEmscriptenThreadIterate = Module["_SDLEmscriptenThreadIterate"] = wasmExports["ne"];
  _Emscripten_HandlePointerEnter = Module["_Emscripten_HandlePointerEnter"] = wasmExports["oe"];
  _Emscripten_HandlePointerLeave = Module["_Emscripten_HandlePointerLeave"] = wasmExports["pe"];
  _Emscripten_HandlePointerGeneric = Module["_Emscripten_HandlePointerGeneric"] = wasmExports["qe"];
  _Emscripten_HandleMouseButtonUpGlobal = Module["_Emscripten_HandleMouseButtonUpGlobal"] = wasmExports["re"];
  _Emscripten_SendDragEvent = Module["_Emscripten_SendDragEvent"] = wasmExports["se"];
  _Emscripten_SendDragCompleteEvent = Module["_Emscripten_SendDragCompleteEvent"] = wasmExports["te"];
  _Emscripten_SendDragTextEvent = Module["_Emscripten_SendDragTextEvent"] = wasmExports["ue"];
  _Emscripten_SendDragFileEvent = Module["_Emscripten_SendDragFileEvent"] = wasmExports["ve"];
  _Emscripten_HandleLockKeysCheck = Module["_Emscripten_HandleLockKeysCheck"] = wasmExports["we"];
  _Emscripten_SendSystemThemeChangedEvent = Module["_Emscripten_SendSystemThemeChangedEvent"] = wasmExports["xe"];
  _requestFullscreenThroughSDL = Module["_requestFullscreenThroughSDL"] = wasmExports["ye"];
  _Emscripten_force_free = Module["_Emscripten_force_free"] = wasmExports["ze"];
  _emscripten_builtin_free = Module["_emscripten_builtin_free"] = wasmExports["Ae"];
  __emscripten_tls_init = wasmExports["Be"];
  __emscripten_proxy_main = Module["__emscripten_proxy_main"] = wasmExports["Ce"];
  __emscripten_run_callback_on_thread = wasmExports["De"];
  __emscripten_set_offscreencanvas_size_on_thread = wasmExports["Ee"];
  _emscripten_builtin_malloc = Module["_emscripten_builtin_malloc"] = wasmExports["Fe"];
  ___funcs_on_exit = wasmExports["Ge"];
  ___libc_calloc = Module["___libc_calloc"] = wasmExports["He"];
  ___libc_free = Module["___libc_free"] = wasmExports["Ie"];
  ___libc_malloc = Module["___libc_malloc"] = wasmExports["Je"];
  __emscripten_thread_init = wasmExports["Ke"];
  ___set_thread_state = wasmExports["Le"];
  __emscripten_thread_crashed = wasmExports["Me"];
  __emscripten_run_js_on_main_thread_done = wasmExports["Ne"];
  __emscripten_run_js_on_main_thread = wasmExports["Oe"];
  __emscripten_thread_free_data = wasmExports["Pe"];
  __emscripten_thread_exit = wasmExports["Qe"];
  _strndup = Module["_strndup"] = wasmExports["Re"];
  __emscripten_check_mailbox = wasmExports["Se"];
  __ZdlPv = Module["__ZdlPv"] = wasmExports["Te"];
  __ZnamSt11align_val_t = Module["__ZnamSt11align_val_t"] = wasmExports["Ue"];
  ___libc_realloc = Module["___libc_realloc"] = wasmExports["Ve"];
  _emscripten_builtin_calloc = Module["_emscripten_builtin_calloc"] = wasmExports["We"];
  _emscripten_builtin_realloc = Module["_emscripten_builtin_realloc"] = wasmExports["Xe"];
  _malloc_size = Module["_malloc_size"] = wasmExports["Ye"];
  _malloc_usable_size = Module["_malloc_usable_size"] = wasmExports["Ze"];
  _reallocf = Module["_reallocf"] = wasmExports["_e"];
  ___trap = wasmExports["$e"];
  _emscripten_stack_set_limits = wasmExports["af"];
  __emscripten_stack_restore = wasmExports["bf"];
  __emscripten_stack_alloc = wasmExports["cf"];
  _emscripten_stack_get_current = wasmExports["df"];
  __wasmfs_read_file = wasmExports["ef"];
  __wasmfs_write_file = wasmExports["ff"];
  __wasmfs_mkdir = wasmExports["gf"];
  __wasmfs_rmdir = wasmExports["hf"];
  __wasmfs_open = wasmExports["jf"];
  __wasmfs_mknod = wasmExports["kf"];
  __wasmfs_unlink = wasmExports["lf"];
  __wasmfs_chdir = wasmExports["mf"];
  __wasmfs_symlink = wasmExports["nf"];
  __wasmfs_readlink = wasmExports["of"];
  __wasmfs_write = wasmExports["pf"];
  __wasmfs_pwrite = wasmExports["qf"];
  __wasmfs_chmod = wasmExports["rf"];
  __wasmfs_fchmod = wasmExports["sf"];
  __wasmfs_lchmod = wasmExports["tf"];
  __wasmfs_llseek = wasmExports["uf"];
  __wasmfs_rename = wasmExports["vf"];
  __wasmfs_read = wasmExports["wf"];
  __wasmfs_pread = wasmExports["xf"];
  __wasmfs_truncate = wasmExports["yf"];
  __wasmfs_ftruncate = wasmExports["zf"];
  __wasmfs_close = wasmExports["Af"];
  __wasmfs_mmap = wasmExports["Bf"];
  __wasmfs_msync = wasmExports["Cf"];
  __wasmfs_munmap = wasmExports["Df"];
  __wasmfs_utime = wasmExports["Ef"];
  __wasmfs_stat = wasmExports["Ff"];
  __wasmfs_lstat = wasmExports["Gf"];
  __wasmfs_mount = wasmExports["Hf"];
  __wasmfs_readdir_start = wasmExports["If"];
  __wasmfs_readdir_get = wasmExports["Jf"];
  __wasmfs_readdir_finish = wasmExports["Kf"];
  __wasmfs_get_cwd = wasmExports["Lf"];
  _wasmfs_create_jsimpl_backend = wasmExports["Mf"];
  _wasmfs_create_file = wasmExports["Nf"];
  _wasmfs_unmount = wasmExports["Of"];
  __indirect_function_table = wasmTable = wasmExports["Wd"];
}

var wasmImports;

function assignWasmImports() {
  wasmImports = {
    /** @export */ Sd: SDL_GetEmscriptenJoystickProduct,
    /** @export */ Rd: SDL_GetEmscriptenJoystickVendor,
    /** @export */ Qd: SDL_IsEmscriptenJoystickXInput,
    /** @export */ P: ___assert_fail,
    /** @export */ Pd: ___call_sighandler,
    /** @export */ Od: ___pthread_create_js,
    /** @export */ Nd: ___syscall_getuid32,
    /** @export */ Hd: __abort_js,
    /** @export */ Gd: __emscripten_init_main_thread_js,
    /** @export */ Fd: __emscripten_log_formatted,
    /** @export */ Ed: __emscripten_notify_mailbox_postmessage,
    /** @export */ O: __emscripten_receive_on_main_thread_js,
    /** @export */ Dd: __emscripten_runtime_keepalive_clear,
    /** @export */ N: __emscripten_thread_cleanup,
    /** @export */ Cd: __emscripten_thread_mailbox_await,
    /** @export */ M: __emscripten_thread_set_strongref,
    /** @export */ Bd: __gmtime_js,
    /** @export */ Ad: __localtime_js,
    /** @export */ zd: __timegm_js,
    /** @export */ yd: __tzset_js,
    /** @export */ xd: __wasmfs_copy_preloaded_file_data,
    /** @export */ wd: __wasmfs_get_num_preloaded_dirs,
    /** @export */ vd: __wasmfs_get_num_preloaded_files,
    /** @export */ ud: __wasmfs_get_preloaded_child_path,
    /** @export */ td: __wasmfs_get_preloaded_file_mode,
    /** @export */ sd: __wasmfs_get_preloaded_file_size,
    /** @export */ rd: __wasmfs_get_preloaded_parent_path,
    /** @export */ qd: __wasmfs_get_preloaded_path_name,
    /** @export */ pd: __wasmfs_jsimpl_alloc_file,
    /** @export */ L: __wasmfs_jsimpl_free_file,
    /** @export */ od: __wasmfs_jsimpl_get_size,
    /** @export */ nd: __wasmfs_jsimpl_read,
    /** @export */ md: __wasmfs_jsimpl_set_size,
    /** @export */ ld: __wasmfs_jsimpl_write,
    /** @export */ kd: __wasmfs_stdin_get_char,
    /** @export */ Md: _clock_time_get,
    /** @export */ K: _emscripten_asm_const_async_on_main_thread,
    /** @export */ J: _emscripten_asm_const_double_sync_on_main_thread,
    /** @export */ g: _emscripten_asm_const_int,
    /** @export */ b: _emscripten_asm_const_int_sync_on_main_thread,
    /** @export */ jd: _emscripten_asm_const_ptr_sync_on_main_thread,
    /** @export */ I: _emscripten_check_blocking_allowed,
    /** @export */ id: _emscripten_clear_timeout,
    /** @export */ c: _emscripten_date_now,
    /** @export */ f: _emscripten_err,
    /** @export */ hd: _emscripten_exit_fullscreen,
    /** @export */ gd: _emscripten_exit_pointerlock,
    /** @export */ fd: _emscripten_exit_with_live_runtime,
    /** @export */ k: _emscripten_get_device_pixel_ratio,
    /** @export */ d: _emscripten_get_element_css_size,
    /** @export */ ed: _emscripten_get_fullscreen_status,
    /** @export */ H: _emscripten_get_gamepad_status,
    /** @export */ dd: _emscripten_get_heap_max,
    /** @export */ cd: _emscripten_get_main_loop_timing,
    /** @export */ j: _emscripten_get_now,
    /** @export */ bd: _emscripten_get_num_gamepads,
    /** @export */ ad: _emscripten_get_screen_size,
    /** @export */ $c: _emscripten_glActiveTexture,
    /** @export */ _c: _emscripten_glAttachShader,
    /** @export */ Zc: _emscripten_glBeginQueryEXT,
    /** @export */ Yc: _emscripten_glBindAttribLocation,
    /** @export */ Xc: _emscripten_glBindBuffer,
    /** @export */ Wc: _emscripten_glBindFramebuffer,
    /** @export */ Vc: _emscripten_glBindRenderbuffer,
    /** @export */ Uc: _emscripten_glBindTexture,
    /** @export */ Tc: _emscripten_glBindVertexArrayOES,
    /** @export */ Sc: _emscripten_glBlendColor,
    /** @export */ Rc: _emscripten_glBlendEquation,
    /** @export */ Qc: _emscripten_glBlendEquationSeparate,
    /** @export */ Pc: _emscripten_glBlendFunc,
    /** @export */ Oc: _emscripten_glBlendFuncSeparate,
    /** @export */ Nc: _emscripten_glBufferData,
    /** @export */ Mc: _emscripten_glBufferSubData,
    /** @export */ Lc: _emscripten_glCheckFramebufferStatus,
    /** @export */ Kc: _emscripten_glClear,
    /** @export */ Jc: _emscripten_glClearColor,
    /** @export */ Ic: _emscripten_glClearDepthf,
    /** @export */ Hc: _emscripten_glClearStencil,
    /** @export */ Gc: _emscripten_glClipControlEXT,
    /** @export */ Fc: _emscripten_glColorMask,
    /** @export */ Ec: _emscripten_glCompileShader,
    /** @export */ Dc: _emscripten_glCompressedTexImage2D,
    /** @export */ Cc: _emscripten_glCompressedTexSubImage2D,
    /** @export */ Bc: _emscripten_glCopyTexImage2D,
    /** @export */ Ac: _emscripten_glCopyTexSubImage2D,
    /** @export */ zc: _emscripten_glCreateProgram,
    /** @export */ yc: _emscripten_glCreateShader,
    /** @export */ xc: _emscripten_glCullFace,
    /** @export */ wc: _emscripten_glDeleteBuffers,
    /** @export */ vc: _emscripten_glDeleteFramebuffers,
    /** @export */ uc: _emscripten_glDeleteProgram,
    /** @export */ tc: _emscripten_glDeleteQueriesEXT,
    /** @export */ sc: _emscripten_glDeleteRenderbuffers,
    /** @export */ rc: _emscripten_glDeleteShader,
    /** @export */ qc: _emscripten_glDeleteTextures,
    /** @export */ pc: _emscripten_glDeleteVertexArraysOES,
    /** @export */ oc: _emscripten_glDepthFunc,
    /** @export */ nc: _emscripten_glDepthMask,
    /** @export */ mc: _emscripten_glDepthRangef,
    /** @export */ lc: _emscripten_glDetachShader,
    /** @export */ kc: _emscripten_glDisable,
    /** @export */ jc: _emscripten_glDisableVertexAttribArray,
    /** @export */ ic: _emscripten_glDrawArrays,
    /** @export */ hc: _emscripten_glDrawArraysInstancedANGLE,
    /** @export */ gc: _emscripten_glDrawBuffersWEBGL,
    /** @export */ fc: _emscripten_glDrawElements,
    /** @export */ ec: _emscripten_glDrawElementsInstancedANGLE,
    /** @export */ dc: _emscripten_glEnable,
    /** @export */ cc: _emscripten_glEnableVertexAttribArray,
    /** @export */ bc: _emscripten_glEndQueryEXT,
    /** @export */ ac: _emscripten_glFinish,
    /** @export */ $b: _emscripten_glFlush,
    /** @export */ _b: _emscripten_glFramebufferRenderbuffer,
    /** @export */ Zb: _emscripten_glFramebufferTexture2D,
    /** @export */ Yb: _emscripten_glFrontFace,
    /** @export */ Xb: _emscripten_glGenBuffers,
    /** @export */ Wb: _emscripten_glGenFramebuffers,
    /** @export */ Vb: _emscripten_glGenQueriesEXT,
    /** @export */ Ub: _emscripten_glGenRenderbuffers,
    /** @export */ Tb: _emscripten_glGenTextures,
    /** @export */ Sb: _emscripten_glGenVertexArraysOES,
    /** @export */ Rb: _emscripten_glGenerateMipmap,
    /** @export */ Qb: _emscripten_glGetActiveAttrib,
    /** @export */ Pb: _emscripten_glGetActiveUniform,
    /** @export */ Ob: _emscripten_glGetAttachedShaders,
    /** @export */ Nb: _emscripten_glGetAttribLocation,
    /** @export */ Mb: _emscripten_glGetBooleanv,
    /** @export */ Lb: _emscripten_glGetBufferParameteriv,
    /** @export */ Kb: _emscripten_glGetError,
    /** @export */ Jb: _emscripten_glGetFloatv,
    /** @export */ Ib: _emscripten_glGetFramebufferAttachmentParameteriv,
    /** @export */ Hb: _emscripten_glGetIntegerv,
    /** @export */ Gb: _emscripten_glGetProgramInfoLog,
    /** @export */ Fb: _emscripten_glGetProgramiv,
    /** @export */ Eb: _emscripten_glGetQueryObjecti64vEXT,
    /** @export */ Db: _emscripten_glGetQueryObjectivEXT,
    /** @export */ Cb: _emscripten_glGetQueryObjectui64vEXT,
    /** @export */ Bb: _emscripten_glGetQueryObjectuivEXT,
    /** @export */ Ab: _emscripten_glGetQueryivEXT,
    /** @export */ zb: _emscripten_glGetRenderbufferParameteriv,
    /** @export */ yb: _emscripten_glGetShaderInfoLog,
    /** @export */ xb: _emscripten_glGetShaderPrecisionFormat,
    /** @export */ wb: _emscripten_glGetShaderSource,
    /** @export */ vb: _emscripten_glGetShaderiv,
    /** @export */ ub: _emscripten_glGetString,
    /** @export */ tb: _emscripten_glGetTexParameterfv,
    /** @export */ sb: _emscripten_glGetTexParameteriv,
    /** @export */ rb: _emscripten_glGetUniformLocation,
    /** @export */ qb: _emscripten_glGetUniformfv,
    /** @export */ pb: _emscripten_glGetUniformiv,
    /** @export */ ob: _emscripten_glGetVertexAttribPointerv,
    /** @export */ nb: _emscripten_glGetVertexAttribfv,
    /** @export */ mb: _emscripten_glGetVertexAttribiv,
    /** @export */ lb: _emscripten_glHint,
    /** @export */ kb: _emscripten_glIsBuffer,
    /** @export */ jb: _emscripten_glIsEnabled,
    /** @export */ ib: _emscripten_glIsFramebuffer,
    /** @export */ hb: _emscripten_glIsProgram,
    /** @export */ gb: _emscripten_glIsQueryEXT,
    /** @export */ fb: _emscripten_glIsRenderbuffer,
    /** @export */ eb: _emscripten_glIsShader,
    /** @export */ db: _emscripten_glIsTexture,
    /** @export */ cb: _emscripten_glIsVertexArrayOES,
    /** @export */ bb: _emscripten_glLineWidth,
    /** @export */ ab: _emscripten_glLinkProgram,
    /** @export */ $a: _emscripten_glPixelStorei,
    /** @export */ _a: _emscripten_glPolygonModeWEBGL,
    /** @export */ Za: _emscripten_glPolygonOffset,
    /** @export */ Ya: _emscripten_glPolygonOffsetClampEXT,
    /** @export */ Xa: _emscripten_glQueryCounterEXT,
    /** @export */ Wa: _emscripten_glReadPixels,
    /** @export */ Va: _emscripten_glReleaseShaderCompiler,
    /** @export */ Ua: _emscripten_glRenderbufferStorage,
    /** @export */ Ta: _emscripten_glSampleCoverage,
    /** @export */ Sa: _emscripten_glScissor,
    /** @export */ Ra: _emscripten_glShaderBinary,
    /** @export */ Qa: _emscripten_glShaderSource,
    /** @export */ Pa: _emscripten_glStencilFunc,
    /** @export */ Oa: _emscripten_glStencilFuncSeparate,
    /** @export */ Na: _emscripten_glStencilMask,
    /** @export */ Ma: _emscripten_glStencilMaskSeparate,
    /** @export */ La: _emscripten_glStencilOp,
    /** @export */ Ka: _emscripten_glStencilOpSeparate,
    /** @export */ Ja: _emscripten_glTexImage2D,
    /** @export */ Ia: _emscripten_glTexParameterf,
    /** @export */ Ha: _emscripten_glTexParameterfv,
    /** @export */ Ga: _emscripten_glTexParameteri,
    /** @export */ Fa: _emscripten_glTexParameteriv,
    /** @export */ Ea: _emscripten_glTexSubImage2D,
    /** @export */ Da: _emscripten_glUniform1f,
    /** @export */ Ca: _emscripten_glUniform1fv,
    /** @export */ Ba: _emscripten_glUniform1i,
    /** @export */ Aa: _emscripten_glUniform1iv,
    /** @export */ za: _emscripten_glUniform2f,
    /** @export */ ya: _emscripten_glUniform2fv,
    /** @export */ xa: _emscripten_glUniform2i,
    /** @export */ wa: _emscripten_glUniform2iv,
    /** @export */ va: _emscripten_glUniform3f,
    /** @export */ ua: _emscripten_glUniform3fv,
    /** @export */ ta: _emscripten_glUniform3i,
    /** @export */ sa: _emscripten_glUniform3iv,
    /** @export */ ra: _emscripten_glUniform4f,
    /** @export */ qa: _emscripten_glUniform4fv,
    /** @export */ pa: _emscripten_glUniform4i,
    /** @export */ oa: _emscripten_glUniform4iv,
    /** @export */ na: _emscripten_glUniformMatrix2fv,
    /** @export */ ma: _emscripten_glUniformMatrix3fv,
    /** @export */ la: _emscripten_glUniformMatrix4fv,
    /** @export */ ka: _emscripten_glUseProgram,
    /** @export */ ja: _emscripten_glValidateProgram,
    /** @export */ ia: _emscripten_glVertexAttrib1f,
    /** @export */ ha: _emscripten_glVertexAttrib1fv,
    /** @export */ ga: _emscripten_glVertexAttrib2f,
    /** @export */ fa: _emscripten_glVertexAttrib2fv,
    /** @export */ ea: _emscripten_glVertexAttrib3f,
    /** @export */ da: _emscripten_glVertexAttrib3fv,
    /** @export */ ca: _emscripten_glVertexAttrib4f,
    /** @export */ ba: _emscripten_glVertexAttrib4fv,
    /** @export */ aa: _emscripten_glVertexAttribDivisorANGLE,
    /** @export */ $: _emscripten_glVertexAttribPointer,
    /** @export */ _: _emscripten_glViewport,
    /** @export */ m: _emscripten_has_asyncify,
    /** @export */ Z: _emscripten_num_logical_cores,
    /** @export */ Y: _emscripten_out,
    /** @export */ X: _emscripten_request_fullscreen_strategy,
    /** @export */ G: _emscripten_request_pointerlock,
    /** @export */ W: _emscripten_resize_heap,
    /** @export */ V: _emscripten_runtime_keepalive_check,
    /** @export */ F: _emscripten_sample_gamepad_data,
    /** @export */ E: _emscripten_set_beforeunload_callback_on_thread,
    /** @export */ D: _emscripten_set_blur_callback_on_thread,
    /** @export */ e: _emscripten_set_canvas_element_size,
    /** @export */ i: _emscripten_set_element_css_size,
    /** @export */ C: _emscripten_set_focus_callback_on_thread,
    /** @export */ B: _emscripten_set_fullscreenchange_callback_on_thread,
    /** @export */ A: _emscripten_set_gamepadconnected_callback_on_thread,
    /** @export */ z: _emscripten_set_gamepaddisconnected_callback_on_thread,
    /** @export */ y: _emscripten_set_keydown_callback_on_thread,
    /** @export */ x: _emscripten_set_keypress_callback_on_thread,
    /** @export */ w: _emscripten_set_keyup_callback_on_thread,
    /** @export */ v: _emscripten_set_main_loop_timing,
    /** @export */ u: _emscripten_set_orientationchange_callback_on_thread,
    /** @export */ t: _emscripten_set_pointerlockchange_callback_on_thread,
    /** @export */ s: _emscripten_set_resize_callback_on_thread,
    /** @export */ n: _emscripten_set_timeout,
    /** @export */ r: _emscripten_set_visibilitychange_callback_on_thread,
    /** @export */ q: _emscripten_set_wheel_callback_on_thread,
    /** @export */ U: _emscripten_set_window_title,
    /** @export */ h: _emscripten_sleep,
    /** @export */ T: _emscripten_unwind_to_js_event_loop,
    /** @export */ S: _emscripten_webgl_create_context,
    /** @export */ p: _emscripten_webgl_destroy_context,
    /** @export */ o: _emscripten_webgl_make_context_current,
    /** @export */ Ld: _environ_get,
    /** @export */ Kd: _environ_sizes_get,
    /** @export */ l: _exit,
    /** @export */ R: liberty_fetch_text_sync,
    /** @export */ Q: liberty_gpu_fetch_text_sync,
    /** @export */ a: wasmMemory,
    /** @export */ Jd: _proc_exit,
    /** @export */ Id: _random_get
  };
}

// Argument name here must shadow the `wasmExports` global so
// that it is recognised by metadce and minify-import-export-names
// passes.
function applySignatureConversions(wasmExports) {
  // First, make a copy of the incoming exports object
  wasmExports = Object.assign({}, wasmExports);
  var makeWrapper__p = f => a0 => f(BigInt(a0));
  var makeWrapper_pp = f => a0 => Number(f(BigInt(a0)));
  var makeWrapper_p = f => () => Number(f());
  var makeWrapper___PP = f => (a0, a1, a2) => f(a0, BigInt(a1 ? a1 : 0), BigInt(a2 ? a2 : 0));
  var makeWrapper_ppp = f => (a0, a1) => Number(f(BigInt(a0), BigInt(a1)));
  var makeWrapper__pp_ppp = f => (a0, a1, a2, a3, a4, a5) => f(BigInt(a0), BigInt(a1), a2, BigInt(a3), BigInt(a4), BigInt(a5));
  var makeWrapper__pp__ = f => (a0, a1, a2, a3) => f(BigInt(a0), BigInt(a1), a2, a3);
  var makeWrapper__p_____ = f => (a0, a1, a2, a3, a4, a5) => f(BigInt(a0), a1, a2, a3, a4, a5);
  var makeWrapper__p___ = f => (a0, a1, a2, a3) => f(BigInt(a0), a1, a2, a3);
  var makeWrapper__pp_ = f => (a0, a1, a2) => f(BigInt(a0), BigInt(a1), a2);
  var makeWrapper___p_p_ = f => (a0, a1, a2, a3, a4) => f(a0, BigInt(a1), a2, BigInt(a3), a4);
  var makeWrapper__pp = f => (a0, a1) => f(BigInt(a0), BigInt(a1));
  var makeWrapper__ppp = f => (a0, a1, a2) => f(BigInt(a0), BigInt(a1), BigInt(a2));
  var makeWrapper__p_ = f => (a0, a1) => f(BigInt(a0), a1);
  var makeWrapper__p__ = f => (a0, a1, a2) => f(BigInt(a0), a1, a2);
  var makeWrapper___pp = f => (a0, a1, a2) => f(a0, BigInt(a1), BigInt(a2));
  var makeWrapper___pp_ = f => (a0, a1, a2, a3) => f(a0, BigInt(a1), BigInt(a2), a3);
  var makeWrapper_pp____ = f => (a0, a1, a2, a3, a4) => Number(f(BigInt(a0), a1, a2, a3, a4));
  var makeWrapper__p_p = f => (a0, a1, a2) => f(BigInt(a0), a1, BigInt(a2));
  wasmExports["Xd"] = makeWrapper__p(wasmExports["Xd"]);
  wasmExports["Yd"] = makeWrapper_pp(wasmExports["Yd"]);
  wasmExports["_d"] = makeWrapper_p(wasmExports["_d"]);
  wasmExports["fflush"] = makeWrapper__p(wasmExports["fflush"]);
  wasmExports["de"] = makeWrapper___PP(wasmExports["de"]);
  wasmExports["realloc"] = makeWrapper_ppp(wasmExports["realloc"]);
  wasmExports["calloc"] = makeWrapper_ppp(wasmExports["calloc"]);
  wasmExports["Ae"] = makeWrapper__p(wasmExports["Ae"]);
  wasmExports["Be"] = makeWrapper_p(wasmExports["Be"]);
  wasmExports["emscripten_builtin_memalign"] = makeWrapper_ppp(wasmExports["emscripten_builtin_memalign"]);
  wasmExports["De"] = makeWrapper__pp_ppp(wasmExports["De"]);
  wasmExports["Ee"] = makeWrapper__pp__(wasmExports["Ee"]);
  wasmExports["Fe"] = makeWrapper_pp(wasmExports["Fe"]);
  wasmExports["He"] = makeWrapper_ppp(wasmExports["He"]);
  wasmExports["Ie"] = makeWrapper__p(wasmExports["Ie"]);
  wasmExports["Je"] = makeWrapper_pp(wasmExports["Je"]);
  wasmExports["Ke"] = makeWrapper__p_____(wasmExports["Ke"]);
  wasmExports["Le"] = makeWrapper__p___(wasmExports["Le"]);
  wasmExports["Ne"] = makeWrapper__pp_(wasmExports["Ne"]);
  wasmExports["Oe"] = makeWrapper___p_p_(wasmExports["Oe"]);
  wasmExports["Pe"] = makeWrapper__p(wasmExports["Pe"]);
  wasmExports["Qe"] = makeWrapper__p(wasmExports["Qe"]);
  wasmExports["Re"] = makeWrapper_ppp(wasmExports["Re"]);
  wasmExports["Ve"] = makeWrapper_ppp(wasmExports["Ve"]);
  wasmExports["We"] = makeWrapper_ppp(wasmExports["We"]);
  wasmExports["Xe"] = makeWrapper_ppp(wasmExports["Xe"]);
  wasmExports["Ze"] = makeWrapper_pp(wasmExports["Ze"]);
  wasmExports["af"] = makeWrapper__pp(wasmExports["af"]);
  wasmExports["bf"] = makeWrapper__p(wasmExports["bf"]);
  wasmExports["cf"] = makeWrapper_pp(wasmExports["cf"]);
  wasmExports["df"] = makeWrapper_p(wasmExports["df"]);
  wasmExports["ef"] = makeWrapper__ppp(wasmExports["ef"]);
  wasmExports["ff"] = makeWrapper__ppp(wasmExports["ff"]);
  wasmExports["gf"] = makeWrapper__p_(wasmExports["gf"]);
  wasmExports["hf"] = makeWrapper__p(wasmExports["hf"]);
  wasmExports["jf"] = makeWrapper__p__(wasmExports["jf"]);
  wasmExports["kf"] = makeWrapper__p__(wasmExports["kf"]);
  wasmExports["lf"] = makeWrapper__p(wasmExports["lf"]);
  wasmExports["mf"] = makeWrapper__p(wasmExports["mf"]);
  wasmExports["nf"] = makeWrapper__pp(wasmExports["nf"]);
  wasmExports["of"] = makeWrapper__pp(wasmExports["of"]);
  wasmExports["pf"] = makeWrapper___pp(wasmExports["pf"]);
  wasmExports["qf"] = makeWrapper___pp_(wasmExports["qf"]);
  wasmExports["rf"] = makeWrapper__p_(wasmExports["rf"]);
  wasmExports["tf"] = makeWrapper__p_(wasmExports["tf"]);
  wasmExports["vf"] = makeWrapper__pp(wasmExports["vf"]);
  wasmExports["wf"] = makeWrapper___pp(wasmExports["wf"]);
  wasmExports["xf"] = makeWrapper___pp_(wasmExports["xf"]);
  wasmExports["yf"] = makeWrapper__p_(wasmExports["yf"]);
  wasmExports["Bf"] = makeWrapper_pp____(wasmExports["Bf"]);
  wasmExports["Cf"] = makeWrapper__pp_(wasmExports["Cf"]);
  wasmExports["Df"] = makeWrapper__pp(wasmExports["Df"]);
  wasmExports["Ef"] = makeWrapper__p__(wasmExports["Ef"]);
  wasmExports["Ff"] = makeWrapper__pp(wasmExports["Ff"]);
  wasmExports["Gf"] = makeWrapper__pp(wasmExports["Gf"]);
  wasmExports["Hf"] = makeWrapper__pp(wasmExports["Hf"]);
  wasmExports["If"] = makeWrapper_pp(wasmExports["If"]);
  wasmExports["Jf"] = makeWrapper_pp(wasmExports["Jf"]);
  wasmExports["Kf"] = makeWrapper__p(wasmExports["Kf"]);
  wasmExports["Lf"] = makeWrapper_p(wasmExports["Lf"]);
  wasmExports["Mf"] = makeWrapper_p(wasmExports["Mf"]);
  wasmExports["wasmfs_create_memory_backend"] = makeWrapper_p(wasmExports["wasmfs_create_memory_backend"]);
  wasmExports["Nf"] = makeWrapper__p_p(wasmExports["Nf"]);
  wasmExports["Of"] = makeWrapper__p(wasmExports["Of"]);
  return wasmExports;
}

// include: postamble.js
// === Auto-generated postamble setup entry stuff ===
function callMain(args = []) {
  var entryFunction = __emscripten_proxy_main;
  // With PROXY_TO_PTHREAD make sure we keep the runtime alive until the
  // proxied main calls exit (see exitOnMainThread() for where Pop is called).
  runtimeKeepalivePush();
  args.unshift(thisProgram);
  var argc = args.length;
  var argv = stackAlloc((argc + 1) * 8);
  var argv_ptr = argv;
  for (var arg of args) {
    (growMemViews(), HEAPU64)[((argv_ptr) / 8)] = BigInt(stringToUTF8OnStack(arg));
    argv_ptr += 8;
  }
  (growMemViews(), HEAPU64)[((argv_ptr) / 8)] = 0n;
  try {
    var ret = entryFunction(argc, BigInt(argv));
    // if we're not running an evented main loop, it's time to exit
    exitJS(ret, /* implicit = */ true);
    return ret;
  } catch (e) {
    return handleException(e);
  }
}

async function run(args = programArgs) {
  if ((ENVIRONMENT_IS_PTHREAD)) {
    initRuntime();
    return;
  }
  preRun();
  if (runDependencies) {
    await resolveRunDependencies();
  }
  var setStatus = Module["setStatus"];
  if (setStatus) {
    setStatus("Running...");
    // Yield to the event loop to allow the browser to paint "Running..."
    await new Promise(resolve => setTimeout(resolve, 1));
    // Then we want to clear the status text, but only after the rest of this function runs.
    setTimeout(setStatus, 1, "");
  }
  if (ABORT) return;
  initRuntime();
  // No ATMAINS hooks
  Module["onRuntimeInitialized"]?.();
  var noInitialRun = Module["noInitialRun"] || false;
  if (!noInitialRun) callMain(args);
  postRun();
}

var wasmExports;

if ((!(ENVIRONMENT_IS_PTHREAD))) {
  // Call createWasm on startup if we are the main thread.
  // Worker threads call this once they receive the module via postMessage
  // In modularize mode the generated code is within a factory function so we
  // can use await here (since it's not top-level-await).
  wasmExports = await createWasm();
  await run();
}


    return Module;
  };
})();

// Export using a UMD style export, or ES6 exports if selected
if (typeof exports === 'object' && typeof module === 'object') {
  module.exports = createLibertyModule;
  // This default export looks redundant, but it allows TS to import this
  // commonjs style module.
  module.exports.default = createLibertyModule;
} else if (typeof define === 'function' && define['amd'])
  define([], () => createLibertyModule);

// Create code for detecting if we are running in a pthread.
// Normally this detection is done when the module is itself run but
// when running in MODULARIZE mode we need use this to know if we should
// run the module constructor on startup (true only for pthreads).
var isPthread = globalThis.name == 'em-pthread';

isPthread && createLibertyModule();

