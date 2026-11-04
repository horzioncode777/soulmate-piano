"""Build-only adapter for the user's downloaded B290 Lite; no source files modified."""
import io,json,pathlib,re,sys,zipfile,threading,traceback
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'.tooling'/'python'))
import soundfile as sf

archive=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2]);target.mkdir(parents=True,exist_ok=True)
def values(text):
    return {m.group(1):m.group(2).strip() for m in re.finditer(r'(\w+)\s*=\s*(.*?)(?=\s+\w+\s*=|$)',text,flags=re.S)}
def key(value):
    if re.fullmatch(r'-?\d+',value):return int(value)
    m=re.fullmatch(r'([a-gA-G])([#b]?)(-?\d+)',value);assert m,value
    return (int(m[3])+1)*12+dict(c=0,d=2,e=4,f=5,g=7,a=9,b=11)[m[1].lower()]+dict({'':0,'#':1,'b':-1})[m[2]]
def prepare():
    with zipfile.ZipFile(archive) as source:
        text=source.read('SFZ/The Experience - Austrian Concert B290 v1.0 Lite.sfz').decode('utf-8-sig')
        clean=re.sub(r'//[^\r\n]*','',text);global_settings={};master={};group={};regions=[]
        for tag,body in re.findall(r'<(\w+)>([^<]*)',clean):
            v=values(body)
            if tag=='global':global_settings=v
            elif tag=='master':master=v;group={}
            elif tag=='group':group=v
            elif tag=='region':
                r={**global_settings,**master,**group,**v}
                root=key(r['key']);lo=key(r.get('lokey',r['key']));hi=key(r.get('hikey',r['key']))
                regions.append(dict(sample=r['sample'],root=root,lo=lo,hi=hi,vLo=int(r.get('lovel',0)),vHi=int(r.get('hivel',127)),trigger=r.get('trigger','attack'),volume=float(r.get('volume',0)),pedal=int(r.get('locc64',0))>=16,attack=float(r['ampeg_attack']),decay=float(r['ampeg_decay']),sustain=float(r['ampeg_sustain']),release=float(r['ampeg_release'])))
        print(f'B290 Lite: {len(regions)} regions, preserving pedal-up and pedal-down.',flush=True)
        for i,r in enumerate(regions):
            channels=[]
            for channel in range(2):channels.append(f'{i:04d}-{channel}.ogg')
            if not all((target/n).exists() for n in channels):
                audio,rate=sf.read(io.BytesIO(source.read('SFZ/Samples/'+r['sample'])),dtype='float32',always_2d=True)
                assert audio.shape[1]==2
                for channel,name in enumerate(channels):sf.write(target/name,audio[:,channel],rate,format='OGG',subtype='VORBIS',compression_level=.05)
                r.update(rate=rate,frames=audio.shape[0])
            else:
                info=sf.info(target/channels[0]);r.update(rate=info.samplerate,frames=info.frames)
            r['channels']=channels
            if (i+1)%30==0:print(f'Prepared {i+1}/{len(regions)}',flush=True)
        (target/'regions.json').write_text(json.dumps(regions,indent=2),encoding='utf-8')
        (target/'Readme-original.txt').write_bytes(source.read('Readme.txt'))
        (target/'Original-Lite.sfz').write_text(text,encoding='utf-8')
    print('B290 audio preparation complete.',flush=True)

# Windows libsndfile/Vorbis needs more stack than the Python main thread provides.
if __name__=='__main__':
    failures=[]
    def run():
        try:prepare()
        except BaseException as error:failures.append(error);traceback.print_exc()
    threading.stack_size(64*1024*1024)
    worker=threading.Thread(target=run);worker.start();worker.join()
    if failures:sys.exit(1)
