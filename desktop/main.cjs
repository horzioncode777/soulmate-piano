const {app, BrowserWindow, session, screen,ipcMain,dialog} = require('electron');
const path=require('node:path');
const {LibraryStore}=require('./library-store.cjs');
const {SettingsStore}=require('./settings-store.cjs');
const {RecordingStore}=require('./recording-store.cjs');
const {start} = require('./server.cjs');
const {configurePortable}=require('./portable-mode.cjs');
app.setName('Soulmate');
const portable=configurePortable(app);
// Keep the established profile when renaming the product. Explicit test/custom
// profiles still take precedence; no user banks or settings are moved/deleted.
if(!portable&&!app.commandLine.hasSwitch('user-data-dir'))app.setPath('userData',path.join(app.getPath('appData'),'aurea-piano'));
if(process.platform==='win32')app.setAppUserModelId('local.aurea.piano');
let server;
app.whenReady().then(async () => {
  const running = await start(); server = running.server;
  // Chromium checks midiSysex even for requestMIDIAccess({sysex:false}).
  // Grant only to this local app origin; the renderer drops system/SysEx messages.
  const allowed = new Set(['midi', 'midiSysex', 'audio', 'speaker-selection']);
  const trusted = value => {try{return new URL(value).origin === running.url;}catch{return false;}};
  const library=new LibraryStore(path.join(app.getPath('userData'),'PianoLibrary'));
  const settings=new SettingsStore(path.join(app.getPath('userData'),'piano-settings.json'));
  const recordings=new RecordingStore(path.join(app.getPath('userData'),'RecordingDrafts'));
  const checkRecordingSender=event=>{if(!trusted(event.senderFrame?.url)||event.senderFrame!==event.sender.mainFrame)throw new Error('Origen no autorizado.');return event.sender.id;};
  for(const [action,handler] of Object.entries({start:(owner,rate)=>recordings.start(owner,rate),append:(owner,id,data)=>recordings.append(owner,id,data),finish:(owner,id)=>recordings.finish(owner,id)}))ipcMain.handle('piano-recording:'+action,(event,...args)=>handler(checkRecordingSender(event),...args));
  ipcMain.handle('piano-recording:save',async(event,id)=>{
    const owner=checkRecordingSender(event);recordings.get(owner,id);const parent=BrowserWindow.fromWebContents(event.sender);
    const result=await dialog.showSaveDialog(parent,{title:'Guardar grabación de piano',defaultPath:path.join(portable?.recordings||app.getPath('music'),'Grabación de piano.wav'),buttonLabel:'Guardar grabación',filters:[{name:'Audio WAV estéreo',extensions:['wav']}],properties:['showOverwriteConfirmation','createDirectory']});
    if(result.canceled||!result.filePath)return {canceled:true};return {canceled:false,...await recordings.save(owner,id,result.filePath)};
  });
  ipcMain.handle('piano-recording:discard',async(event,id)=>{
    const owner=checkRecordingSender(event);recordings.get(owner,id);const result=await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender),{type:'question',title:'Descartar grabación',message:'¿Descartar esta grabación sin guardarla?',buttons:['Conservar','Descartar'],defaultId:0,cancelId:0,noLink:true});
    if(result.response!==1)return {canceled:true};await recordings.discard(owner,id);return {canceled:false};
  });
  for(const [action,handler] of Object.entries({load:()=>settings.load(),save:value=>settings.save(value)}))ipcMain.handle('piano-settings:'+action,(event,...args)=>{
    if(!trusted(event.senderFrame?.url)||event.senderFrame!==event.sender.mainFrame)throw new Error('Origen no autorizado.');return handler(...args);
  });
  for(const [action,handler] of Object.entries({list:()=>library.list(),save:entry=>library.save(entry),read:id=>library.read(id),rename:(id,name)=>library.rename(id,name),remove:id=>library.remove(id)}))ipcMain.handle('piano-library:'+action,(event,...args)=>{
    if(!trusted(event.senderFrame?.url)||event.senderFrame!==event.sender.mainFrame)throw new Error('Origen no autorizado.');return handler(...args);
  });
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(trusted(wc.getURL()) && allowed.has(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => trusted(origin) && allowed.has(permission));
  const area=screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({width:Math.min(1536,area.width),height:Math.min(1024,area.height),minWidth:1000,minHeight:750,backgroundColor:'#090b0d',title:'Soulmate · Concert Experience',icon:path.join(__dirname,'../assets/soulmate-icon.png'),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  let closing=false,deciding=false;
  win.on('close',event=>{
    if(closing)return;event.preventDefault();if(deciding)return;deciding=true;
    setImmediate(async()=>{try{
      if(recordings.hasPending(win.webContents.id)){
        const result=await dialog.showMessageBox(win,{type:'question',title:'Grabación sin guardar',message:'Hay una grabación sin guardar.',detail:'Vuelve a la aplicación para detenerla y guardarla, o descártala para cerrar.',buttons:['Volver','Descartar y cerrar'],defaultId:0,cancelId:0,noLink:true});
        if(result.response!==1)return;await recordings.discardOwner(win.webContents.id);
      }
      await settings.queue;closing=true;if(!win.isDestroyed())win.destroy();
    }catch(error){await dialog.showMessageBox(win,{type:'error',message:'No se pudo cerrar la grabación.',detail:error.message});}finally{deciding=false;}});
  });
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', (event, url) => {if(new URL(url).origin !== running.url) event.preventDefault();});
  await win.loadURL(running.url);
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => server?.close());
