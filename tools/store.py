import base64, json, sys
from pathlib import Path
from io import BytesIO
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / '.cache/imaging'))
from PIL import Image, ImageDraw, ImageFont
store = root / 'release/store'
store.mkdir(exist_ok=True, parents=True)
public = root / 'public'
public.mkdir(exist_ok=True)
icon = Image.new('RGB', (512, 512), '#f1dec1')
d = ImageDraw.Draw(icon)
d.ellipse((228,48,441,261),fill='#ed905b')
d.polygon([(0,289),(89,206),(117,218),(228,84),(337,215),(384,183),(512,268),(512,512),(0,512)],fill='#72978a')
d.polygon([(117,218),(228,84),(204,155),(175,177),(184,151)],fill='#faf0d4')
d.polygon([(0,317),(120,259),(219,305),(391,223),(512,207),(512,512),(0,512)],fill='#345f51')
d.polygon([(0,360),(84,371),(205,339),(295,400),(512,442),(512,512),(0,512)],fill='#e7e9ce')
d.line([(83,284),(155,294),(211,277)],fill='#f18545',width=12)
d.line([(110,281),(135,250),(164,252),(158,280)],fill='#1a4035',width=13)
d.line([(147,250),(156,211)],fill='#214a3f',width=28)
d.line([(151,218),(175,233),(190,221)],fill='#1a4035',width=12)
d.ellipse((148,185,177,215),fill='#173d34')
d.line([(163,199),(182,195)],fill='#fca451',width=8)
d.polygon([(205,271),(202,196),(240,199),(226,209),(236,216),(207,213)],fill='#e87843')
icon.save(store/'图标.png')
icon.resize((48,48),Image.Resampling.LANCZOS).save(public/'ski.png')
capture=root/'.cache/frames/capture.json'
if capture.exists():
    frames=[]
    font=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc',16)
    for raw, label in json.loads(capture.read_text(encoding='utf-8')):
        frame=Image.new('RGB',(240,442),'#204438')
        frame.paste(Image.open(BytesIO(base64.b64decode(raw))), (0,0))
        ImageDraw.Draw(frame).text((13,409),label,fill='#fff4db',font=font)
        frames.append(frame)
    if frames:
        frames[0].save(store/'摔倒与重试.gif',save_all=True,append_images=frames[1:],loop=0,duration=140,optimize=True)

