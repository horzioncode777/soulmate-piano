"""Render the app's existing piano/lyre motif as a Windows icon."""
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]/'assets';scale=4
image=Image.new('RGBA',(256*scale,256*scale),(0,0,0,0));draw=ImageDraw.Draw(image)
def rect(box,fill,outline=None,width=1,radius=0):
 box=tuple(round(x*scale) for x in box)
 if radius:draw.rounded_rectangle(box,radius=radius*scale,fill=fill,outline=outline,width=width*scale)
 else:draw.rectangle(box,fill=fill,outline=outline,width=width*scale)
gold='#e6c68d';dark='#101315'
rect((5,5,251,251),dark,'#77613e',3,52)
def curve(points):
 pts=[]
 for i in range(121):
  t=i/120;u=1-t
  pts.append(tuple(scale*(u**3*points[0][a]+3*u*u*t*points[1][a]+3*u*t*t*points[2][a]+t**3*points[3][a]) for a in (0,1)))
 draw.line(pts,fill=gold,width=6*scale,joint='curve')
curve([(68,193),(37,195),(55,153),(58,132)])
curve([(58,132),(61,99),(50,43),(128,36)])
curve([(128,36),(206,43),(195,99),(198,132)])
curve([(198,132),(201,153),(219,195),(188,193)])
for x in [88,112,144,168]:rect((x,64,x+5,204),gold)
rect((76,183,180,220),dark,gold,5)
for x in [102,128,154]:rect((x,185,x+3,219),gold)
for x in [96,122,148]:rect((x,185,x+10,203),gold)
image=image.resize((256,256),Image.Resampling.LANCZOS);image.save(root/'soulmate-icon.png');image.save(root/'soulmate-icon.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
(root/'soulmate-icon.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect x="5" y="5" width="246" height="246" rx="52" fill="#101315" stroke="#77613e" stroke-width="3"/><g fill="none" stroke="#e6c68d" stroke-width="6" stroke-linecap="round"><path d="M68 193C37 195 55 153 58 132C61 99 50 43 128 36C206 43 195 99 198 132C201 153 219 195 188 193M90 64V204M114 64V204M146 64V204M170 64V204"/><path d="M76 183H180V220H76ZM104 185V219M130 185V219M156 185V219"/></g><g fill="#e6c68d"><path d="M96 185H106V203H96ZM122 185H132V203H122ZM148 185H158V203H148Z"/></g></svg>''',encoding='utf-8')
print('Soulmate Windows icons generated.')
