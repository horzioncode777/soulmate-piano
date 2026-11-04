const fs=require('node:fs');const path=require('node:path');
function configurePortable(app,executableDirectory=path.dirname(process.execPath)){
  const requested=app.commandLine.getSwitchValue('soulmate-portable-root');
  const marked=app.isPackaged&&fs.existsSync(path.join(executableDirectory,'soulmate-portable.json'));
  if(!requested&&!marked)return null;
  const root=requested?path.resolve(requested):path.resolve(executableDirectory,'..');
  const data=app.commandLine.hasSwitch('user-data-dir')?app.getPath('userData'):path.join(root,'Datos');
  const temp=path.join(root,'Temporal'),recordings=path.join(root,'Grabaciones');
  for(const directory of [data,temp,recordings,path.join(data,'Logs'),path.join(data,'Crashpad')])fs.mkdirSync(directory,{recursive:true});
  app.setPath('userData',data);app.setPath('sessionData',data);app.setPath('temp',temp);app.setPath('crashDumps',path.join(data,'Crashpad'));app.setAppLogsPath(path.join(data,'Logs'));
  process.env.TEMP=temp;process.env.TMP=temp;
  return {root,data,temp,recordings};
}
module.exports={configurePortable};
